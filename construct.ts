/**
 * Construct benchmark fixture data from real parser output.
 *
 * For each URL in `urls.json`:
 * 1. Downloads the source file (if not already present)
 * 2. Runs the parser with raw transfer
 * 3. Captures every `deserializeStr` call
 * 4. Saves captured data to `fixtures` directory
 *
 * The captured data can be replayed by the benchmark script.
 *
 * Usage: `node construct.ts`
 */

// oxlint-disable no-console, no-await-in-loop

import assert from "node:assert";
import fs from "node:fs";
import { basename, join as pathJoin } from "path";
import { ROOT_DIR_PATH, FIXTURES_DIR_PATH } from "./common.ts";

const DESERIALIZER_PATH = pathJoin(
  ROOT_DIR_PATH,
  "node_modules/oxc-parser/src-js/generated/deserialize/ts.js",
);

async function main(): Promise<void> {
  patchDeserializer();

  // Dynamic import after patching, so Node loads the patched version
  const { parseSync } = await import("oxc-parser");
  const { getInstrData } = await import("oxc-parser/src-js/generated/deserialize/ts.js");

  const urls: string[] = JSON.parse(fs.readFileSync(pathJoin(ROOT_DIR_PATH, "urls.json"), "utf8"));

  for (const url of urls) {
    const filename = basename(new URL(url).pathname),
      fixtureName = getFixtureName(url),
      dirPath = pathJoin(FIXTURES_DIR_PATH, fixtureName),
      sourcePath = pathJoin(dirPath, "source.txt"),
      strDataPath = pathJoin(dirPath, "strData.txt"),
      strBinPath = pathJoin(dirPath, "strBin.bin"),
      stringsPath = pathJoin(dirPath, "strings.json");

    console.log(`--------------------\n${fixtureName}\n--------------------`);

    // Skip if all fixture files already present
    if (
      fs.existsSync(sourcePath) &&
      fs.existsSync(strDataPath) &&
      fs.existsSync(strBinPath) &&
      fs.existsSync(stringsPath)
    ) {
      console.log("Fixture already constructed, skipping\n");
      continue;
    }

    // Download source file if not already present, or read from file
    let code: string;
    if (!fs.existsSync(sourcePath)) {
      console.log(`Downloading from ${url}...`);
      fs.mkdirSync(dirPath, { recursive: true });

      const response = await fetch(url);
      assert(response.ok, `Failed to fetch ${url}: status ${response.status}`);
      code = await response.text();

      fs.writeFileSync(sourcePath, code);
    } else {
      console.log("Reading source from file...");
      code = fs.readFileSync(sourcePath, "utf8");
    }

    console.log("Parsing...");
    parseSync(filename, code, { astType: "ts", experimentalRawTransfer: true } as any);

    console.log("Constructing fixture data...");
    const { calls, sourceEndPos } = getInstrData();

    // Separate source-region strings from other strings.
    // Sort a copy by data position to pack non-source strings in same order
    // they were in the original buffer.
    const callsCloned = calls.slice();
    callsCloned.sort((call1, call2) => call1.pos - call2.pos);

    let otherStrings = "",
      otherStringsPos = sourceEndPos;

    for (const call of callsCloned) {
      if (call.pos >= sourceEndPos) {
        call.pos = otherStringsPos;
        otherStringsPos += call.len;
        otherStrings += call.str;
      }
    }

    const strings = calls.map((call) => call.str);

    // Build strBin.bin: 4 x uint32 per string [pos, 0, len, 0]
    const strBin = new Uint32Array(calls.length * 4);
    for (let i = 0; i < calls.length; i++) {
      const offset = i * 4;
      strBin[offset] = calls[i].pos;
      strBin[offset + 1] = 0;
      strBin[offset + 2] = calls[i].len;
      strBin[offset + 3] = 0;
    }

    fs.writeFileSync(strDataPath, otherStrings);
    fs.writeFileSync(strBinPath, Buffer.from(strBin.buffer));
    fs.writeFileSync(stringsPath, JSON.stringify(strings));

    console.log(
      `${calls.length} deserializeStr calls, ` +
        `source ${(sourceEndPos / 1024).toFixed(1)} KB, ` +
        `strData ${(otherStrings.length / 1024).toFixed(1)} KB\n`,
    );
  }
}

/**
 * Derive a fixture name from a jsdelivr URL.
 * e.g. "https://cdn.jsdelivr.net/gh/honojs/hono@v4.10.5/src/types.ts" -> "hono-types"
 * e.g. "https://cdn.jsdelivr.net/npm/antd@4.16.1/dist/antd.js" -> "antd"
 */
function getFixtureName(url: string): string {
  const parts = new URL(url).pathname.split("/");
  const isGithub = parts[1] === "gh";
  const pkg = (isGithub ? parts[3] : parts[2]).replace(/@.*$/, "");
  const filenameWithoutExt = parts.at(-1)!.replace(/\.[^.]+$/, "");
  if (pkg === filenameWithoutExt) return pkg;
  if (pkg === "benchmark-files") return filenameWithoutExt;
  return `${pkg}-${filenameWithoutExt}`;
}

const PATCH_CODE = `
function deserializeStr(pos) {
  const str = deserializeStrOriginal(pos);

  instrCalls.push({
    pos: uint32[pos >> 2],
    len: uint32[(pos >> 2) + 2],
    str
  });

  return str;
}

let instrCalls = [];
export function getInstrData() {
  const result = { calls: instrCalls, sourceEndPos };
  instrCalls = [];
  return result;
}

export function injectState(buffer, sourceTextInput, sourceByteLen) {
  uint8 = buffer;
  uint32 = new Uint32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength >> 2);
  float64 = new Float64Array(buffer.buffer, buffer.byteOffset, buffer.byteLength >> 3);
  sourceText = sourceTextInput;
  sourceIsAscii = sourceText.length === sourceByteLen;
  sourceEndPos = sourceByteLen;
}

export function deserializeStrOriginal(pos) {
`.trim();

const PATCH_CODE_LINES = PATCH_CODE.split("\n");
const FN_START_BEFORE = PATCH_CODE_LINES[0];
const FN_START_AFTER = PATCH_CODE_LINES.at(-1)!;

/**
 * Patch `oxc-parser`'s `ts.js` deserializer to capture `deserializeStr` calls.
 *
 * - Inserts instrumented `deserializeStr` + `getInstrData` + `injectState`.
 * - Renames original `deserializeStr` to `deserializeStrOriginal` and exports it.
 */
function patchDeserializer(): void {
  console.log("Patching `oxc-parser` deserializer for instrumentation...");

  const code = fs.readFileSync(DESERIALIZER_PATH, "utf8");

  // Exit if already patched
  if (code.includes(FN_START_AFTER)) {
    console.log("Already patched.\n");
    return;
  }

  const startIdx = code.indexOf(FN_START_BEFORE);
  assert(startIdx !== -1, "Cannot patch oxc-parser: `deserializeStr` function not found.");

  // Replace original function: insert patch code before, rename original
  const patchedCode =
    code.slice(0, startIdx) + PATCH_CODE + code.slice(startIdx + FN_START_BEFORE.length);

  fs.writeFileSync(DESERIALIZER_PATH, patchedCode);

  console.log("Patched.\n");
}

await main();
