/**
 * Benchmark different `deserializeStr` implementations using real fixture data.
 *
 * Reads all `.mjs` files from `versions` directory, wraps each with boilerplate that
 * provides module-level state (`uint8`, `uint32`, etc.) and `injectState`,
 * writes compiled versions to `versions-compiled` directory, then imports and benchmarks them.
 *
 * To add a new version to the benchmark, just drop a `.mjs` file into `versions` directory.
 *
 * Usage: `node bench.ts`
 */

// eslint-disable no-console

import { loadAllFixtures, loadAllVersions } from "./common.ts";

// Version used as baseline for comparison
const BASELINE = "current";

// Versions to skip
const SKIP: string[] = [];

// Total time budget per fixture, per version
const BENCH_TIME_MS = 100;
// Minimum number of timed rounds
const MIN_ROUNDS = 5;
// Number of warmup rounds
const WARMUP_ROUNDS = 5;

async function main() {
  // Load versions and fixtures
  const versions = await loadAllVersions(BASELINE, SKIP);
  const fixtures = loadAllFixtures();

  // Benchmark all versions against all fixtures.
  // Collect results first, then format the table with tight column widths.
  const rawTimes: number[][] = []; // rawTimes[fixture][version] in ms

  for (let fixtureIndex = 0; fixtureIndex < fixtures.length; fixtureIndex++) {
    const fixture = fixtures[fixtureIndex];
    console.log(`Benchmarking ${fixtureIndex + 1}/${fixtures.length} ${fixture.name}`);

    const { uint8, sourceText, sourceEndPos, strBinOffsets } = fixture;
    const callsLen = strBinOffsets.length;
    const row: number[] = [];

    for (const version of versions) {
      version.injectState(uint8, sourceText, sourceEndPos);

      // Warmup: run a few cycles to let JIT stabilize, and measure how long
      // a single cycle takes so we can decide how many cycles per timed round
      let warmupTotal = 0;
      for (let i = 0; i < WARMUP_ROUNDS; i++) {
        const start = performance.now();
        for (let callIndex = 0; callIndex < callsLen; callIndex++) {
          version.deserializeStr(strBinOffsets[callIndex]);
        }
        const end = performance.now();
        warmupTotal += end - start;
      }
      const avgCycleTime = warmupTotal / WARMUP_ROUNDS;

      // Choose how many cycles per timed round so each round takes ~50ms.
      // This ensures `performance.now()` overhead is negligible.
      const cyclesPerRound = Math.max(1, Math.round(50 / Math.max(avgCycleTime, 0.001)));

      // Timed rounds - use minimum as the result.
      // The fastest run best represents the code's true speed.
      // Slower runs are slower due to external noise (GC, OS scheduling, etc),
      // not because the code is intrinsically slower.
      let best = Infinity;
      let rounds = 0;
      const deadline = performance.now() + BENCH_TIME_MS;
      while (rounds < MIN_ROUNDS || performance.now() < deadline) {
        const start = performance.now();
        for (let i = 0; i < cyclesPerRound; i++) {
          for (let callIndex = 0; callIndex < callsLen; callIndex++) {
            version.deserializeStr(strBinOffsets[callIndex]);
          }
        }
        const end = performance.now();
        const elapsed = (end - start) / cyclesPerRound;
        best = Math.min(best, elapsed);
        rounds++;
      }

      row.push(best);
    }

    rawTimes.push(row);
  }

  // Format % difference vs baseline, with sign padded to 2 digits
  function formatPctDiff(pct: number): string {
    const sign = pct <= 0 ? "-" : "+";
    const digits = Math.abs(pct).toFixed(0);
    return `(${sign}${digits.padStart(2)}%)`;
  }

  // Format results: time + % difference vs baseline for non-baseline columns
  const versionNames = versions.map((version) => version.name);
  const fixtureNames = fixtures.map((fixture) => fixture.name);
  const formatted = rawTimes.map((row) => {
    const baselineMs = row[0];
    return row.map((ms, colIndex) => {
      const msStr = ms.toFixed(3) + "ms";
      if (colIndex === 0) return msStr;
      const pct = ((ms - baselineMs) / baselineMs) * 100;
      return `${msStr} ${formatPctDiff(pct)}`;
    });
  });

  // "Fastest" column: best version name + its % diff
  const fastestNames: string[] = [];
  const fastestPcts: string[] = [];
  for (const row of rawTimes) {
    const baselineTime = row[0];
    const bestTime = Math.min(...row);
    const bestIndex = row.indexOf(bestTime);
    fastestNames.push(versionNames[bestIndex]);
    if (bestIndex === 0) {
      fastestPcts.push("");
    } else {
      const pct = ((bestTime - baselineTime) / baselineTime) * 100;
      fastestPcts.push(formatPctDiff(pct));
    }
  }

  // Non-ASCII position as percentage of source length.
  // 100% means file is entirely ASCII, lower values mean non-ASCII bytes appear earlier.
  const nonAsciiPcts = fixtures.map((fixture) => {
    const { uint8, sourceEndPos } = fixture;
    let firstNonAsciiPos = sourceEndPos;
    for (let i = 0; i < sourceEndPos; i++) {
      if (uint8[i] >= 128) {
        firstNonAsciiPos = i;
        break;
      }
    }
    return ((firstNonAsciiPos / sourceEndPos) * 100).toFixed(1) + "%";
  });

  // Percentage of strings whose pos is outside the source region
  const nonSourcePcts = fixtures.map((fixture) => {
    const { uint8, sourceEndPos, strBinOffsets } = fixture;
    const uint32 = new Uint32Array(uint8.buffer, uint8.byteOffset, uint8.byteLength >> 2);
    let nonSourceCount = 0;
    for (const offset of strBinOffsets) {
      if (uint32[offset >> 2] >= sourceEndPos) nonSourceCount++;
    }
    if (nonSourceCount === 0) return "-";
    return ((nonSourceCount / strBinOffsets.length) * 100).toFixed(1) + "%";
  });

  // Print table
  console.log();
  console.log("String deserialization benchmark");
  console.log("--------------------------------\n");
  console.log(`${BENCH_TIME_MS}ms per fixture per version, minimum of best rounds.\n`);
  console.log("* ASCII column is % of source length which is before first non-ASCII byte.");
  console.log('  "100%" for files which are 100% ASCII.');
  console.log("* non-src column is % of strings which are outside the source region.");
  console.log('  "-" for files where all strings are in the source region.\n');

  // Compute minimum column widths
  const nameColWidth = Math.max("File".length, ...fixtureNames.map((name) => name.length));
  const nonAsciiHeader = "ASCII";
  const nonAsciiColWidth = Math.max(
    nonAsciiHeader.length,
    ...nonAsciiPcts.map((pct) => pct.length),
  );
  const nonSourceHeader = "non-src";
  const nonSourceColWidth = Math.max(
    nonSourceHeader.length,
    ...nonSourcePcts.map((pct) => pct.length),
  );
  const colWidths = versionNames.map((name, colIndex) => {
    const maxVal = Math.max(...formatted.map((row) => row[colIndex].length));
    return Math.max(name.length, maxVal);
  });
  const fastestHeader = "fastest";
  const fastestNameWidth = Math.max(
    fastestHeader.length,
    ...fastestNames.map((name) => name.length),
  );
  const fastestPctWidth = Math.max(...fastestPcts.map((pct) => pct.length));
  const fastestColWidth = fastestNameWidth + (fastestPctWidth > 0 ? 1 + fastestPctWidth : 0);

  function markdownRow(parts: string[]): string {
    return `| ${parts.join(" | ")} |`;
  }

  // Header
  console.log(
    markdownRow([
      "File".padEnd(nameColWidth),
      nonAsciiHeader.padStart(nonAsciiColWidth),
      nonSourceHeader.padStart(nonSourceColWidth),
      ...versionNames.map((name, colIndex) => name.padStart(colWidths[colIndex])),
      fastestHeader.padEnd(fastestColWidth),
    ]),
  );

  // Separator
  console.log(
    markdownRow([
      "-".repeat(nameColWidth),
      "-".repeat(nonAsciiColWidth - 1) + ":",
      "-".repeat(nonSourceColWidth - 1) + ":",
      ...colWidths.map((width) => "-".repeat(width - 1) + ":"),
      "-".repeat(fastestColWidth),
    ]),
  );

  // Rows
  for (let rowIndex = 0; rowIndex < fixtureNames.length; rowIndex++) {
    console.log(
      markdownRow([
        fixtureNames[rowIndex].padEnd(nameColWidth),
        nonAsciiPcts[rowIndex].padStart(nonAsciiColWidth),
        nonSourcePcts[rowIndex].padStart(nonSourceColWidth),
        ...colWidths.map((width, colIndex) => formatted[rowIndex][colIndex].padStart(width)),
        fastestNames[rowIndex].padEnd(fastestNameWidth) +
          (fastestPcts[rowIndex] ? " " + fastestPcts[rowIndex] : "").padEnd(
            fastestColWidth - fastestNameWidth,
          ),
      ]),
    );
  }
}

await main();
