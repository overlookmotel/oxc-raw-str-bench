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

  // Compute per-fixture stats for sorting and display
  // oxlint-disable-next-line oxc/no-map-spread
  const fixtures = loadAllFixtures().map((fixture) => {
    const { uint8, sourceEndPos, strBinOffsets } = fixture;

    // Position of first non-ASCII byte as % of source length
    let firstNonAsciiPos = sourceEndPos;
    for (let i = 0; i < sourceEndPos; i++) {
      if (uint8[i] >= 128) {
        firstNonAsciiPos = i;
        break;
      }
    }
    const asciiPct = (firstNonAsciiPos / sourceEndPos) * 100;

    // % of strings whose pos is outside the source region
    const uint32 = new Uint32Array(uint8.buffer, uint8.byteOffset, uint8.byteLength >> 2);
    let nonSourceCount = 0;
    for (const offset of strBinOffsets) {
      if (uint32[offset >> 2] >= sourceEndPos) nonSourceCount++;
    }
    const nonSourcePct =
      strBinOffsets.length > 0 ? (nonSourceCount / strBinOffsets.length) * 100 : 0;

    return { ...fixture, asciiPct, nonSourcePct };
  });

  // Sort: ASCII % descending, then non-src % ascending, then name alphabetical
  fixtures.sort((fixture1, fixture2) => {
    if (fixture1.asciiPct !== fixture2.asciiPct) return fixture2.asciiPct - fixture1.asciiPct;
    if (fixture1.nonSourcePct !== fixture2.nonSourcePct) {
      return fixture1.nonSourcePct - fixture2.nonSourcePct;
    }
    return fixture1.name < fixture2.name ? -1 : 1;
  });

  // Create a separate call-loop function for each version using `new Function`.
  //
  // In production, there's only one `deserializeStr`, so V8 has a monomorphic inline cache (IC)
  // and can inline the function for maximum speed. If we benchmarked all versions through
  // a shared call site, V8's IC would go polymorphic after the first version, adding dispatch
  // overhead that doesn't exist in production - and the first version would get an unfair
  // monomorphic advantage while all others pay a polymorphic penalty.
  //
  // `new Function` creates a fresh V8 compilation unit per version, each with its own ICs.
  // Every version gets monomorphic dispatch, matching production conditions.
  // A unique comment per version prevents V8 from sharing compiled code across them.
  const runners = versions.map(
    (_version, index) =>
      // eslint-disable-next-line typescript/no-implied-eval
      new Function(
        "deserializeStr",
        "strBinOffsets",
        `// v${index}\nfor (let i = 0; i < strBinOffsets.length; i++) deserializeStr(strBinOffsets[i]);`,
      ) as (deserializeStr: (pos: number) => string, strBinOffsets: number[]) => void,
  );

  // Benchmark all versions against all fixtures.
  // Collect results first, then format the table with tight column widths.
  const rawTimes: number[][] = []; // rawTimes[fixture][version] in nanoseconds

  for (let fixtureIndex = 0; fixtureIndex < fixtures.length; fixtureIndex++) {
    const fixture = fixtures[fixtureIndex];
    console.log(`Benchmarking ${fixtureIndex + 1}/${fixtures.length} ${fixture.name}`);

    const { uint8, sourceText, sourceEndPos, strBinOffsets } = fixture;
    const row: number[] = [];

    for (let versionIndex = 0; versionIndex < versions.length; versionIndex++) {
      const version = versions[versionIndex];
      const runCalls = runners[versionIndex];

      version.injectState(uint8, sourceText, sourceEndPos);

      const { deserializeStr } = version;

      // Warmup: run a few cycles to let JIT stabilize, and measure how long
      // a single cycle takes so we can decide how many cycles per timed round
      let warmupTotal = 0;
      for (let i = 0; i < WARMUP_ROUNDS; i++) {
        const start = performance.now();
        runCalls(deserializeStr, strBinOffsets);
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
          runCalls(deserializeStr, strBinOffsets);
        }
        const end = performance.now();
        const elapsed = (end - start) / cyclesPerRound;
        best = Math.min(best, elapsed);
        rounds++;
      }

      // Convert ms per file to ns per string
      const nsPerString = (best / strBinOffsets.length) * 1_000_000;
      row.push(nsPerString);
    }

    rawTimes.push(row);
  }

  // Format % difference vs baseline, with sign padded to 2 digits
  function formatPctDiff(pct: number): string {
    const sign = pct <= 0 ? "-" : "+";
    const digits = Math.abs(pct).toFixed(0);
    return `${sign}${digits.padStart(2)}%`;
  }

  // Format results: time + % difference vs baseline for non-baseline columns
  const versionNames = versions.map((version) => version.name);
  const fixtureNames = fixtures.map((fixture) => fixture.name);
  const formatted = rawTimes.map((row) => {
    const baselineNs = row[0];
    return row.map((ns, colIndex) => {
      const nsStr = ns.toFixed(1) + "ns";
      if (colIndex === 0) return nsStr;
      const pct = ((ns - baselineNs) / baselineNs) * 100;
      return `${nsStr} (${formatPctDiff(pct)})`;
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

  // Print table
  console.log();
  console.log("String deserialization benchmark");
  console.log("--------------------------------\n");
  console.log(`${BENCH_TIME_MS}ms per fixture per version, minimum of best rounds.\n`);
  console.log("* Timings are in nanoseconds per string.");
  console.log("* % changes are vs the baseline (1st column).");
  console.log("* strings column is number of strings in the fixture.");
  console.log("* ASCII column is % of source length which is before first non-ASCII byte.");
  console.log('  "100%" for files which are 100% ASCII.');
  console.log("* non-src column is % of strings which are outside the source region.");
  console.log('  "-" for files where all strings are in the source region.\n');

  // Define table columns: header, alignment, and values per row
  interface Column {
    header: string;
    align: "left" | "right";
    values: string[];
  }

  const columns: Column[] = [
    { header: "File", align: "left", values: fixtureNames },
    {
      header: "strings",
      align: "right",
      values: fixtures.map((fixture) => String(fixture.strBinOffsets.length)),
    },
    {
      header: "ASCII",
      align: "right",
      values: fixtures.map((fixture) => fixture.asciiPct.toFixed(1) + "%"),
    },
    {
      header: "non-src",
      align: "right",
      values: fixtures.map((fixture) =>
        fixture.nonSourcePct === 0 ? "-" : fixture.nonSourcePct.toFixed(2) + "%",
      ),
    },
    // One column per version
    ...versionNames.map((name, colIndex) => ({
      header: name,
      align: "right" as const,
      values: formatted.map((row) => row[colIndex]),
    })),
    { header: "fastest", align: "left", values: fastestNames },
    { header: "by", align: "right", values: fastestPcts },
  ];

  // Compute column widths and format table
  const colWidths = columns.map((col) =>
    Math.max(col.header.length, ...col.values.map((value) => value.length)),
  );

  function formatRow(cells: string[]): string {
    const padded = cells.map((cell, colIndex) => {
      const width = colWidths[colIndex];
      return columns[colIndex].align === "right" ? cell.padStart(width) : cell.padEnd(width);
    });
    return `| ${padded.join(" | ")} |`;
  }

  console.log(formatRow(columns.map((col) => col.header)));
  console.log(
    "| " +
      columns
        .map((col, colIndex) => {
          const width = colWidths[colIndex];
          return col.align === "right" ? "-".repeat(width - 1) + ":" : "-".repeat(width);
        })
        .join(" | ") +
      " |",
  );
  for (let rowIndex = 0; rowIndex < fixtureNames.length; rowIndex++) {
    console.log(formatRow(columns.map((col) => col.values[rowIndex])));
  }
}

await main();
