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
import { loadAllFixtures, loadAllVersions } from "./common.ts";
import {
  injectState as injectStateOriginal,
  deserializeStrOriginal,
} from "oxc-parser/src-js/generated/deserialize/ts.js";

const BASELINE = "current";

const versions = await loadAllVersions(BASELINE);

// Include oxc-parser's original `deserializeStr` as a reference version
versions.unshift({
  name: "original",
  injectState: injectStateOriginal,
  deserializeStr: deserializeStrOriginal,
});

const fixtures = loadAllFixtures();

let allPassed = true;

for (const version of versions) {
  console.log(`====================\n${version.name}\n====================`);

  for (const fixture of fixtures) {
    const { name, dirPath, uint8, sourceText, sourceEndPos, strBinOffsets } = fixture;
    const strings: string[] = JSON.parse(
      fs.readFileSync(pathJoin(dirPath, "strings.json"), "utf8"),
    );

    console.log(`  ${name}`);

    version.injectState(uint8, sourceText, sourceEndPos);

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
