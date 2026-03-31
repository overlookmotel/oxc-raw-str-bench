// Shared fixture loading and version compilation for verify and bench scripts.

import fs from "node:fs";
import { join as pathJoin } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert";

export interface Fixture {
  name: string;
  dirPath: string;
  // Combined buffer: [sourceBytes | strDataBytes | padding | strBin]
  uint8: Uint8Array;
  sourceText: string;
  sourceEndPos: number;
  // Byte offsets into `uint8` for each string's descriptor (pos, 0, len, 0)
  strBinOffsets: number[];
}

export interface Version {
  name: string;
  id: number;
  injectState(buffer: Uint8Array, sourceText: string, sourceByteLen: number): void;
  deserializeStr(this: void, pos: number): string;
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
  const files = fs.readdirSync(FIXTURES_DIR_PATH, { withFileTypes: true });

  const fixtures: Fixture[] = [];
  for (const file of files) {
    if (file.isDirectory()) fixtures.push(loadFixture(file.name));
  }

  fixtures.sort((fixture1, fixture2) => (fixture1.name < fixture2.name ? -1 : 1));

  return fixtures;
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

  // Each strBin entry is 16 bytes (4 x uint32)
  const numStrings = strBinBytes.length / 16;
  const strBinOffsets: number[] = [];
  for (let i = 0; i < numStrings; i++) {
    strBinOffsets.push(strBinStart + i * 16);
  }

  return {
    name,
    dirPath,
    uint8,
    sourceText,
    sourceEndPos,
    strBinOffsets,
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
 * @param filter - Names of versions to use (optional).
 *   If provided, returned array of versions is sorted in this order. `baseline` is ignored.
 * @returns - Array of versions, sorted by ID with baseline first, or in order of `filter` if provided.
 */
export async function loadAllVersions(
  baseline: string,
  filter?: string[] | null,
): Promise<Version[]> {
  fs.mkdirSync(COMPILED_DIR, { recursive: true });

  let filterSet: Set<string> | null = null;
  if (filter != null) filterSet = new Set(filter);

  const filenames = fs.readdirSync(VERSIONS_DIR);

  const versions: Version[] = [];
  for (const filename of filenames) {
    const match = filename.match(/^(\d+)\s+(.+)\.mjs$/);
    if (!match) continue;

    const id = parseInt(match[1], 10);
    const name = match[2];

    if (filterSet !== null && !filterSet.has(name)) continue;

    const source = fs.readFileSync(pathJoin(VERSIONS_DIR, filename), "utf8");
    const compiledPath = pathJoin(COMPILED_DIR, filename);
    fs.writeFileSync(compiledPath, BOILERPLATE_HEAD + source);

    const url = pathToFileURL(compiledPath).href;
    // oxlint-disable-next-line no-await-in-loop
    const mod = await import(url);
    versions.push({ name, id, injectState: mod.injectState, deserializeStr: mod.deserializeStr });
  }

  if (filter != null) {
    assert(versions.length === filter.length, "Some versions specified in `filter` not found");

    versions.sort(
      (version1, version2) => filter.indexOf(version1.name) - filter.indexOf(version2.name),
    );
  } else {
    versions.sort((version1, version2) => {
      if (version1.name === baseline) return -1;
      if (version2.name === baseline) return 1;
      return version1.id - version2.id;
    });
  }

  return versions;
}
