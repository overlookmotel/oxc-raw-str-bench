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

  for (let f = 0; f < fixtures.length; f++) {
    const fixture = fixtures[f];
    console.log(`Benchmarking ${f + 1}/${fixtures.length} ${fixture.name}`);

    const { uint8, sourceText, sourceEndPos, strBinOffsets } = fixture;
    const callsLen = strBinOffsets.length;
    const row: number[] = [];

    for (const version of versions) {
      version.injectState(uint8, sourceText, sourceEndPos);

      // Warmup: run a few cycles to let JIT stabilize, and measure how long
      // a single cycle takes so we can decide how many cycles per timed round
      let warmupTotal = 0;
      for (let r = 0; r < WARMUP_ROUNDS; r++) {
        const start = performance.now();
        for (let i = 0; i < callsLen; i++) {
          version.deserializeStr(strBinOffsets[i]);
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
        for (let c = 0; c < cyclesPerRound; c++) {
          for (let i = 0; i < callsLen; i++) {
            version.deserializeStr(strBinOffsets[i]);
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
  const versionNames = versions.map((v) => v.name);
  const fixtureNames = fixtures.map((f) => f.name);
  const formatted = rawTimes.map((row) => {
    const baselineTime = row[0];
    return row.map((t, col) => {
      const time = t.toFixed(3) + "ms";
      if (col === 0) return time;
      const pct = ((t - baselineTime) / baselineTime) * 100;
      return `${time} ${formatPctDiff(pct)}`;
    });
  });

  // "Fastest" column: best version name + its % diff
  const fastestNames: string[] = [];
  const fastestPcts: string[] = [];
  for (const row of rawTimes) {
    const baselineTime = row[0];
    const bestTime = Math.min(...row);
    const bestIdx = row.indexOf(bestTime);
    fastestNames.push(versionNames[bestIdx]);
    if (bestIdx === 0) {
      fastestPcts.push("");
    } else {
      const pct = ((bestTime - baselineTime) / baselineTime) * 100;
      fastestPcts.push(formatPctDiff(pct));
    }
  }

  // Non-ASCII position as percentage of source length.
  // 100% means file is entirely ASCII, lower values mean non-ASCII bytes appear earlier.
  const nonAsciiPcts = fixtures.map((f) => {
    const { uint8, sourceEndPos } = f;
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
  const nonSourcePcts = fixtures.map((f) => {
    const { uint8, sourceEndPos, strBinOffsets } = f;
    const uint32 = new Uint32Array(uint8.buffer, uint8.byteOffset, uint8.byteLength >> 2);
    let nonSourceCount = 0;
    for (const offset of strBinOffsets) {
      if (uint32[offset >> 2] >= sourceEndPos) nonSourceCount++;
    }
    if (nonSourceCount === 0) return "-";
    return ((nonSourceCount / strBinOffsets.length) * 100).toFixed(1) + "%";
  });

  // Print table
  console.log(`\nString deserialization benchmark`);
  console.log(`${BENCH_TIME_MS / 1000}s per fixture per version, minimum of best rounds\n`);

  // Compute minimum column widths
  const sep = " | ";
  const sepLine = "-+-";
  const nameColWidth = Math.max("File".length, ...fixtureNames.map((n) => n.length));
  const nonAsciiHeader = "ASCII";
  const nonAsciiColWidth = Math.max(nonAsciiHeader.length, ...nonAsciiPcts.map((s) => s.length));
  const nonSourceHeader = "non-src";
  const nonSourceColWidth = Math.max(nonSourceHeader.length, ...nonSourcePcts.map((s) => s.length));
  const colWidths = versionNames.map((name, col) => {
    const maxVal = Math.max(...formatted.map((row) => row[col].length));
    return Math.max(name.length, maxVal);
  });
  const fastestHeader = "fastest";
  const fastestNameWidth = Math.max(fastestHeader.length, ...fastestNames.map((s) => s.length));
  const fastestPctWidth = Math.max(...fastestPcts.map((s) => s.length));
  const fastestColWidth = fastestNameWidth + (fastestPctWidth > 0 ? 1 + fastestPctWidth : 0);

  // Header
  const headerParts = [
    "File".padEnd(nameColWidth),
    nonAsciiHeader.padStart(nonAsciiColWidth),
    nonSourceHeader.padStart(nonSourceColWidth),
    ...versionNames.map((name, c) => name.padStart(colWidths[c])),
    fastestHeader.padEnd(fastestColWidth),
  ];
  console.log(headerParts.join(sep));

  // Separator
  const sepParts = [
    "-".repeat(nameColWidth),
    "-".repeat(nonAsciiColWidth),
    "-".repeat(nonSourceColWidth),
    ...colWidths.map((w) => "-".repeat(w)),
    "-".repeat(fastestColWidth),
  ];
  console.log(sepParts.join(sepLine));

  // Rows
  for (let r = 0; r < fixtureNames.length; r++) {
    const rowParts = [
      fixtureNames[r].padEnd(nameColWidth),
      nonAsciiPcts[r].padStart(nonAsciiColWidth),
      nonSourcePcts[r].padStart(nonSourceColWidth),
      ...colWidths.map((w, c) => formatted[r][c].padStart(w)),
      fastestNames[r].padEnd(fastestNameWidth) +
        (fastestPcts[r] ? " " + fastestPcts[r] : "").padEnd(fastestColWidth - fastestNameWidth),
    ];
    console.log(rowParts.join(sep));
  }
}

await main();
