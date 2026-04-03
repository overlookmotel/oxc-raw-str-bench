/**
 * Dump TurboFan-generated assembly for a specific version's `deserializeStr`.
 *
 * Usage: node --print-opt-code --code-comments asm.ts <version-name>
 *
 * Runs the version's `deserializeStr` enough times to trigger TurboFan optimization,
 * then exits. Pipe stderr to a file to capture the assembly.
 */

import assert from "node:assert";
import { loadAllFixtures, loadAllVersions } from "./common.ts";

const versionName = process.argv[2];
assert(versionName != null, "No version name provided");

const versions = await loadAllVersions(versionName, [versionName]);
const version = versions[0];
assert(version !== undefined, `Version "${versionName}" not found`);

const fixtures = loadAllFixtures();
const fixture = fixtures[0]; // Use first fixture

const { uint8, sourceText, sourceStartPos, sourceByteLen, strBinOffsets } = fixture;
version.injectState(uint8, sourceText, sourceStartPos, sourceByteLen);

const { deserializeStr } = version;

// Run enough iterations to trigger TurboFan and wait for compilation to complete
for (let round = 0; round < 1000; round++) {
  for (let i = 0; i < strBinOffsets.length; i++) {
    deserializeStr(strBinOffsets[i]);
  }
}
