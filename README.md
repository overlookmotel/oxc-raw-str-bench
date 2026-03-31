# Oxc raw transfer string deserialization benchmark

Benchmarks different implementations of `deserializeStr` using real data
captured from parsing benchmark fixture files.

The buffer layout packs string data tightly (source text followed by non-source strings),
matching the planned allocator revision where strings are stored separately from AST nodes.

## Setup

```bash
pnpm install
```

## Usage

```bash
# 1. Construct fixture data (downloads source files and runs parser)
pnpm run construct

# 2. Verify fixture data is correct - produces correct strings using original impl.
#    Verify all `deserializeStr` implementations produce the correct strings.
pnpm run verify

# 3. Run benchmark
pnpm run bench
```

## Versions (in order of speed)

- `current` - Current implementation
- `pr20834` - PR #20834 without the `firstNonAsciiPos` optimization
- `pr20834-fnap` - PR #20834
- `simpler-branch` - `pr20834-fnap` with a simpler branch condition for "can we use `sourceText.substr`?"
- `fromCharCode` - `simpler-branch` but using `String.fromCharCode` instead of `String.fromCodePoint`
- `apply` - `simpler-branch` with a single `fromCharCode.apply` call on the slow path
- `apply30` - `apply` with the crossover point to `TextDecoder` at 30 bytes

On Mac Mini M4 Pro, 48 GB RAM:

| File                     | strings |  ASCII | non-src | current |         apply |       apply30 |  fromCharCode |       pr20834 |  pr20834-fnap | simpler-branch | fastest        |   by |
| ------------------------ | ------: | -----: | ------: | ------: | ------------: | ------------: | ------------: | ------------: | ------------: | -------------: | -------------- | ---: |
| TypeScript-binder        |    8758 | 100.0% |       - |   2.2ns |  1.9ns (-15%) |  2.1ns (- 5%) |  2.0ns (- 9%) |  2.3ns (+ 5%) |  2.4ns (+ 9%) |   1.8ns (-17%) | simpler-branch | -17% |
| next.js-index            |    1768 | 100.0% |       - |   2.2ns |  2.0ns (- 9%) |  2.0ns (-10%) |  2.0ns (- 8%) |  2.3ns (+ 4%) |  2.1ns (- 2%) |   1.9ns (-13%) | simpler-branch | -13% |
| next.js-next             |    1027 | 100.0% |       - |   2.1ns |  1.9ns (- 9%) |  1.9ns (-11%) |  2.0ns (- 9%) |  2.7ns (+29%) |  2.7ns (+25%) |   1.9ns (- 9%) | apply30        | -11% |
| prettier-handle-comments |    1456 | 100.0% |       - |   2.4ns |  2.0ns (-18%) |  2.0ns (-16%) |  2.0ns (-18%) |  2.2ns (- 7%) |  2.2ns (- 8%) |   1.9ns (-20%) | simpler-branch | -20% |
| moment                   |   10796 | 100.0% |   0.07% |   2.2ns |  2.2ns (+ 3%) |  1.9ns (-13%) |  2.1ns (- 3%) |  2.4ns (+ 9%) |  2.4ns (+13%) |   2.1ns (- 2%) | apply30        | -13% |
| jquery                   |   16517 | 100.0% |   0.24% |   2.6ns |  2.3ns (- 9%) |  2.3ns (-11%) |  2.3ns (-10%) |  2.5ns (- 2%) |  2.6ns (+ 3%) |   2.4ns (- 9%) | apply30        | -11% |
| react-react.development  |    3117 | 100.0% |   0.32% |   2.9ns |  2.5ns (-15%) |  2.5ns (-14%) |  2.5ns (-14%) |  2.8ns (- 4%) |  2.8ns (- 4%) |   2.6ns (-11%) | apply          | -15% |
| core-errors              |     372 | 100.0% |   0.81% |   3.2ns |  2.9ns (- 9%) |  2.8ns (-11%) |  2.9ns (- 9%) |  3.1ns (- 4%) |  3.2ns (+ 0%) |   2.9ns (- 8%) | apply30        | -11% |
| prettier-core            |     817 | 100.0% |   0.86% |   2.7ns |  2.5ns (- 9%) |  2.5ns (- 9%) |  2.5ns (- 8%) |  2.7ns (+ 0%) |  2.8ns (+ 1%) |   2.6ns (- 7%) | apply30        | - 9% |
| vue                      |   21172 | 100.0% |   0.89% |   3.1ns |  2.7ns (-14%) |  2.7ns (-13%) |  2.8ns (- 9%) |  2.9ns (- 5%) |  3.0ns (- 2%) |   2.7ns (-14%) | apply          | -14% |
| hono-types               |    7936 |  98.6% |       - |  16.2ns |  2.5ns (-85%) |  2.5ns (-85%) |  2.5ns (-84%) | 16.8ns (+ 4%) |  3.1ns (-81%) |   2.6ns (-84%) | apply30        | -85% |
| pdfjs-dist-pdf           |   39688 |  97.9% |   0.08% |  33.2ns |  3.1ns (-91%) |  2.9ns (-91%) |  3.1ns (-91%) | 38.4ns (+15%) |  3.5ns (-89%) |   3.1ns (-91%) | apply30        | -91% |
| lodash                   |   15794 |  83.4% |   1.50% |  29.6ns |  7.6ns (-74%) |  6.2ns (-79%) |  8.5ns (-71%) | 33.6ns (+13%) |  8.9ns (-70%) |   8.4ns (-72%) | apply30        | -79% |
| TypeScript-checker       |  121791 |  72.9% |   0.01% |  45.3ns | 13.5ns (-70%) |  9.1ns (-80%) | 14.5ns (-68%) | 52.0ns (+15%) | 14.3ns (-69%) |  13.7ns (-70%) | apply30        | -80% |
| RadixUIAdoptionSection   |     291 |  71.9% |   0.34% |  29.1ns |  7.7ns (-74%) |  6.5ns (-78%) |  7.4ns (-74%) | 29.4ns (+ 1%) |  8.1ns (-72%) |   7.5ns (-74%) | apply30        | -78% |
| excalidraw-App           |   17956 |  68.5% |   0.01% |  44.3ns | 13.3ns (-70%) |  8.9ns (-80%) | 14.1ns (-68%) | 45.3ns (+ 2%) | 14.4ns (-68%) |  14.2ns (-68%) | apply30        | -80% |
| three                    |   84014 |  59.9% |   0.22% |  30.5ns | 14.3ns (-53%) | 11.2ns (-63%) | 14.8ns (-52%) | 32.5ns (+ 7%) | 15.2ns (-50%) |  15.0ns (-51%) | apply30        | -63% |
| outline-Search           |     921 |  56.2% |       - |  43.0ns | 16.9ns (-61%) | 10.9ns (-75%) | 17.7ns (-59%) | 43.8ns (+ 2%) | 18.6ns (-57%) |  18.0ns (-58%) | apply30        | -75% |
| echarts                  |  182793 |   4.3% |   0.05% |  32.3ns | 36.3ns (+12%) | 22.5ns (-30%) | 35.6ns (+10%) | 35.0ns (+ 8%) | 36.4ns (+13%) |  34.7ns (+ 7%) | apply30        | -30% |
| victory                  |  121588 |   2.8% |   0.08% |  36.9ns | 33.9ns (- 8%) | 26.2ns (-29%) | 34.5ns (- 7%) | 35.7ns (- 3%) | 37.1ns (+ 0%) |  38.5ns (+ 4%) | apply30        | -29% |
| d3                       |   53554 |   1.9% |   0.05% |  20.2ns | 21.2ns (+ 5%) | 17.8ns (-12%) | 20.8ns (+ 3%) | 21.7ns (+ 8%) | 22.0ns (+ 9%) |  20.5ns (+ 2%) | apply30        | -12% |
| antd                     |  291269 |   1.3% |   0.02% |  43.0ns | 44.3ns (+ 3%) | 29.6ns (-31%) | 42.6ns (- 1%) | 43.7ns (+ 2%) | 43.2ns (+ 1%) |  43.9ns (+ 2%) | apply30        | -31% |
| typescript               |  461346 |   0.6% |   0.05% |  39.3ns | 40.3ns (+ 3%) | 26.6ns (-32%) | 40.7ns (+ 4%) | 40.9ns (+ 4%) | 41.2ns (+ 5%) |  41.0ns (+ 5%) | apply30        | -32% |
| terser-bundle.min        |   64495 |   0.2% |   0.17% |  36.0ns | 38.2ns (+ 6%) | 24.4ns (-32%) | 38.9ns (+ 8%) | 39.5ns (+10%) | 40.3ns (+12%) |  39.7ns (+10%) | apply30        | -32% |
| cal.com                  |   86205 |   0.1% |   0.00% |  44.9ns | 42.9ns (- 5%) | 29.6ns (-34%) | 45.2ns (+ 1%) | 46.7ns (+ 4%) | 45.6ns (+ 2%) |  46.5ns (+ 3%) | apply30        | -34% |
| ------------------------ | ------- | ------ | ------- | ------- | ------------- | ------------- | ------------- | ------------- | ------------- | -------------- | -------------- | ---- |
| Average                  |   64618 |  64.8% |   0.23% |  22.0ns | 14.4ns (-35%) | 10.3ns (-53%) | 14.6ns (-34%) | 23.2ns (+ 6%) | 15.1ns (-31%) |  14.8ns (-33%) | apply30        | -53% |

## Adding a new version

To add a new `deserializeStr` implementation to the benchmark, create a `.mjs` file in the `versions` directory.

The file should export two functions:

- `deserializeStr(pos)` - the implementation to benchmark.
- `setup()` - called once after state is injected for each fixture. Use this for
  any per-fixture initialization (e.g. computing `firstNonAsciiPos`). Can be a no-op.

The bench script wraps each version file with boilerplate that provides the following variables,
available as globals within the version file:

| Variable / function | Type           | Description                                                 |
| ------------------- | -------------- | ----------------------------------------------------------- |
| `uint8`             | `Uint8Array`   | The combined buffer (source + strData + strBin)             |
| `uint32`            | `Uint32Array`  | `Uint32Array` view over `uint8`'s backing buffer            |
| `float64`           | `Float64Array` | `Float64Array` view over `uint8`'s backing buffer           |
| `sourceText`        | `string`       | The source text as a JS string                              |
| `sourceIsAscii`     | `boolean`      | `true` if source is pure ASCII                              |
| `sourceEndPos`      | `number`       | Byte length of source text (end of source region in buffer) |

`deserializeStr(pos)` receives a byte offset into the buffer.
The string descriptor at that offset contains two `uint32` values the function needs to read:

- `uint32[pos >> 2]` - byte offset of the string's UTF-8 data in the buffer
- `uint32[(pos >> 2) + 2]` - byte length of the string (UTF-8 bytes)

See `versions/current.mjs` for the baseline implementation.

## Filtering

While working on different versions, you can alter which versions are benchmarked by:

- Benchmark only some versions: Add them to `FILTER` in `bench.ts`.
- Change the baseline version: Alter `BASELINE` in `bench.ts`.

## Files

- `construct.ts` - Downloads source files, patches `oxc-parser`'s deserializer for instrumentation,
  captures `deserializeStr` calls, produces fixture data.
- `verify.ts` - Validates that the fixture data produces the correct strings,
  and all `deserializeStr` implementations produce the correct strings.
- `bench.ts` - Benchmarks multiple `deserializeStr` implementations.
- `urls.json` - URLs of benchmark source files.
- `versions` directory - `deserializeStr` implementations to benchmark.
- `fixtures` directory - Captured data per benchmark file.
