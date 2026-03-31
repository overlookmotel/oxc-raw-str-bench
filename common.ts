// Shared fixture loading and version compilation for verify and bench scripts.

import fs from "node:fs";
import { join as pathJoin } from "node:path";
import { pathToFileURL } from "node:url";

export interface Fixture {
  name: string;
  // Combined buffer: [sourceBytes | strDataBytes | padding | strBin]
  uint8: Uint8Array;
  sourceText: string;
  sourceIsAscii: boolean;
  sourceEndPos: number;
  // Byte offsets into `uint8` for each string's descriptor (pos, 0, len, 0)
  strBinOffsets: number[];
  // Expected strings for verification
  strings: string[];
}

export interface Version {
  name: string;
  injectState(buffer: Uint8Array, sourceText: string, sourceByteLen: number): void;
  deserializeStr(pos: number): string;
}

export const ROOT_DIR_PATH = import.meta.dirname;
export const FIXTURES_DIR_PATH = pathJoin(ROOT_DIR_PATH, "fixtures");
const VERSIONS_DIR = pathJoin(ROOT_DIR_PATH, "versions");
const COMPILED_DIR = pathJoin(ROOT_DIR_PATH, "versions-compiled");

const textDecoder = new TextDecoder("utf-8", { ignoreBOM: true });
export const decodeStr = textDecoder.decode.bind(textDecoder);

/**
 * Load all fixtures from the fixtures directory.
 */
export function loadAllFixtures(): Fixture[] {
  return fs
    .readdirSync(FIXTURES_DIR_PATH, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => loadFixture(d.name));
}

/**
 * Load a single fixture by name.
 *
 * Builds a combined buffer:
 *   [source bytes] [strData bytes] [padding to 8-byte boundary] [strBin entries]
 *
 * Each strBin entry is 4 x uint32: [pos, 0, len, 0]
 * which matches the layout `deserializeStr` reads from the real buffer.
 */
function loadFixture(name: string): Fixture {
  const dirPath = pathJoin(FIXTURES_DIR_PATH, name);

  const sourceBytes = fs.readFileSync(pathJoin(dirPath, "source.txt"));
  const strDataBytes = fs.readFileSync(pathJoin(dirPath, "strData.txt"));
  const strBinBytes = fs.readFileSync(pathJoin(dirPath, "strBin.bin"));
  const strings: string[] = JSON.parse(fs.readFileSync(pathJoin(dirPath, "strings.json"), "utf8"));

  const stringDataLen = sourceBytes.length + strDataBytes.length;
  // Align strBin start to 8-byte boundary (required for Float64Array view)
  const strBinStart = (stringDataLen + 7) & ~7;
  const totalLen = strBinStart + strBinBytes.length;

  const uint8 = new Uint8Array(totalLen);
  uint8.set(sourceBytes, 0);
  uint8.set(strDataBytes, sourceBytes.length);
  uint8.set(strBinBytes, strBinStart);

  const sourceEndPos = sourceBytes.length;
  const sourceText = decodeStr(sourceBytes);
  const sourceIsAscii = sourceText.length === sourceEndPos;

  // Each strBin entry is 16 bytes (4 x uint32)
  const numStrings = strBinBytes.length / 16;
  const strBinOffsets: number[] = [];
  for (let i = 0; i < numStrings; i++) {
    strBinOffsets.push(strBinStart + i * 16);
  }

  return {
    name,
    uint8,
    sourceText,
    sourceIsAscii,
    sourceEndPos,
    strBinOffsets,
    strings,
  };
}

const BOILERPLATE_HEAD = `
// oxlint-disable

let uint8, uint32, float64, sourceText, sourceIsAscii, sourceEndPos;

export function injectState(buffer, sourceTextInput, sourceByteLen) {
  uint8 = buffer;
  uint32 = new Uint32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength >> 2);
  float64 = new Float64Array(buffer.buffer, buffer.byteOffset, buffer.byteLength >> 3);

  sourceText = sourceTextInput;
  sourceIsAscii = sourceText.length === sourceByteLen;
  sourceEndPos = sourceByteLen;

  setup();
}

`;

/**
 * Compile versions and dynamically import them.
 *
 * Wraps each `.mjs` file in `versions` directory with boilerplate,
 * writes compiled versions to `versions-compiled` directory,
 * then imports and returns them.
 *
 * @param baseline - Name of the version to put first. Remaining versions are sorted alphabetically.
 * @param skip - Names of versions to skip.
 * @returns - Array of versions, sorted by name with baseline first.
 */
export async function loadAllVersions(baseline: string, skip: string[] = []): Promise<Version[]> {
  fs.mkdirSync(COMPILED_DIR, { recursive: true });

  const skipSet = new Set(skip);
  const filenames = fs.readdirSync(VERSIONS_DIR);

  const versions: Version[] = [];
  for (const filename of filenames) {
    if (!filename.endsWith(".mjs")) continue;
    const name = filename.slice(0, -4);
    if (skipSet.has(name)) continue;

    const source = fs.readFileSync(pathJoin(VERSIONS_DIR, filename), "utf8");
    const compiledPath = pathJoin(COMPILED_DIR, filename);
    fs.writeFileSync(compiledPath, BOILERPLATE_HEAD + source);

    const url = pathToFileURL(compiledPath).href;
    // oxlint-disable-next-line no-await-in-loop
    const mod = await import(url);
    versions.push({ name, injectState: mod.injectState, deserializeStr: mod.deserializeStr });
  }

  versions.sort((a, b) => {
    if (a.name === baseline) return -1;
    if (b.name === baseline) return 1;
    return a.name.localeCompare(b.name);
  });

  return versions;
}
