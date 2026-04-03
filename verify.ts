/**
 * Verify that fixture data created by `construct.ts` produces the correct strings for all fixtures,
 * by reference to the original oxc-parser `deserializeStr` implementation.
 *
 * Also verify that all versions produce the same strings.
 *
 * Loads each fixture, injects its buffer into each version's `deserializeStr`,
 * and compares each result against the expected string.
 *
 * Usage: `node verify.ts`
 */

// oxlint-disable no-console

import fs from "node:fs";
import { join as pathJoin } from "node:path";
import { /* importDeserializer, */ loadAllFixtures, loadAllVersions } from "./common.ts";

const BASELINE = "current";

const LINTER_VERSIONS = new Set([
  "current-linter",
  "simpler-branch-linter",
  "simpler-branch-linter2",
  "simpler-branch-linter3",
  "simpler-branch-linter4",
]);

// const { injectState: injectStateOriginal, deserializeStrOriginal } = await importDeserializer();

const versions = await loadAllVersions(BASELINE);

// Include oxc-parser's original `deserializeStr` as a reference version
/*
versions.unshift({
  name: "original",
  id: 0,
  injectState: injectStateOriginal,
  deserializeStr: deserializeStrOriginal,
});
*/

const fixtures = loadAllFixtures();

let allPassed = true;

for (const version of versions) {
  console.log(`====================\n${version.name}\n====================`);

  if (!LINTER_VERSIONS.has(version.name)) continue;

  for (const fixture of fixtures) {
    const { name, dirPath, uint8, sourceText, sourceStartPos, sourceByteLen, strBinOffsets } =
      fixture;
    const strings: string[] = JSON.parse(
      fs.readFileSync(pathJoin(dirPath, "strings.json"), "utf8"),
    );

    console.log(`  ${name}`);

    version.injectState(uint8, sourceText, sourceStartPos, sourceByteLen);

    let failures = 0;

    for (let i = 0; i < strBinOffsets.length; i++) {
      const str = version.deserializeStr(strBinOffsets[i]);
      if (str !== strings[i]) {
        if (failures < 5) {
          console.error(
            `    MISMATCH [${i}]:\n` +
              `      pos:      ${strBinOffsets[i]}\n` +
              `      expected: ${JSON.stringify(strings[i])}\n` +
              `      got:      ${JSON.stringify(str)}\n`,
          );
        }
        failures++;
      }
    }

    if (failures === 0) {
      console.log(`    ${strings.length} strings OK`);
    } else {
      console.error(`    ${failures}/${strings.length} FAILED`);
      allPassed = false;
    }
  }
}

console.log("====================");
if (allPassed) {
  console.log("All versions verified OK");
} else {
  console.log("Some versions FAILED verification");
  process.exitCode = 1;
}
