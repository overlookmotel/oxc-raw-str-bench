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
- `switch` - `simpler-branch` with a single `switch` statement on the slow path
- `switch30` - `switch` with the crossover point to `TextDecoder` at 30 bytes
- `apply` - `simpler-branch` with a single `fromCharCode.apply` call on the slow path
- `apply30` - `apply` with the crossover point to `TextDecoder` at 30 bytes

`switch30` beats `apply30` in files which hit the slow path often, but `apply30` wins by a mile in pure-ASCII files.

### Benchmark results

On Mac Mini M4 Pro, 48 GB RAM:

100ms per fixture per version, minimum of best rounds.

- Timings are in nanoseconds per string.
- % changes are vs the baseline (1st column).
- strings column is number of strings in the fixture.
- ASCII column is % of source length which is before first non-ASCII byte.
  "100%" for files which are 100% ASCII.
- non-src column is % of strings which are outside the source region.
  "-" for files where all strings are in the source region.

| File                     | strings |  ASCII | non-src | current |         apply |       apply30 |  fromCharCode |       pr20834 |  pr20834-fnap | simpler-branch |        switch |      switch30 | fastest        |   by |
| ------------------------ | ------: | -----: | ------: | ------: | ------------: | ------------: | ------------: | ------------: | ------------: | -------------: | ------------: | ------------: | -------------- | ---: |
| TypeScript-binder        |    8758 | 100.0% |       - |   2.1ns |  1.9ns (- 8%) |  1.8ns (-14%) |  2.2ns (+ 4%) |  2.2ns (+ 7%) |  2.1ns (- 1%) |   1.8ns (-14%) | 5.7ns (+174%) | 5.9ns (+183%) | simpler-branch | -14% |
| next.js-index            |    1768 | 100.0% |       - |   2.1ns |  2.0ns (- 4%) |  1.9ns (- 9%) |  1.9ns (- 8%) |  2.4ns (+15%) |  2.3ns (+11%) |   2.2ns (+ 4%) | 5.6ns (+167%) | 6.0ns (+186%) | apply30        | - 9% |
| next.js-next             |    1027 | 100.0% |       - |   2.2ns |  1.9ns (-16%) |  1.9ns (-16%) |  1.9ns (-15%) |  2.3ns (+ 5%) |  2.3ns (+ 4%) |   1.9ns (-14%) | 5.6ns (+149%) | 5.8ns (+159%) | apply30        | -16% |
| prettier-handle-comments |    1456 | 100.0% |       - |   2.2ns |  2.0ns (-11%) |  2.3ns (+ 6%) |  2.0ns (-11%) |  2.6ns (+18%) |  2.1ns (- 5%) |   2.3ns (+ 3%) | 5.4ns (+145%) | 5.4ns (+149%) | fromCharCode   | -11% |
| moment                   |   10796 | 100.0% |   0.07% |   2.1ns |  2.2ns (+ 3%) |  1.9ns (-11%) |  2.3ns (+ 7%) |  2.3ns (+ 7%) |  2.3ns (+ 7%) |   2.3ns (+ 7%) | 6.3ns (+195%) | 6.5ns (+207%) | apply30        | -11% |
| jquery                   |   16517 | 100.0% |   0.24% |   2.5ns |  2.4ns (- 5%) |  2.3ns (- 9%) |  2.5ns (- 1%) |  2.6ns (+ 2%) |  2.5ns (- 2%) |   2.3ns (-10%) | 8.6ns (+238%) | 9.1ns (+259%) | simpler-branch | -10% |
| react-react.development  |    3117 | 100.0% |   0.32% |   2.8ns |  2.5ns (- 9%) |  2.4ns (-12%) |  2.7ns (- 3%) |  2.7ns (- 3%) |  2.7ns (- 4%) |   2.5ns (-10%) | 6.1ns (+119%) | 5.9ns (+114%) | apply30        | -12% |
| core-errors              |     372 | 100.0% |   0.81% |   3.1ns |  2.8ns (-10%) |  2.7ns (-12%) |  2.7ns (-13%) |  3.2ns (+ 2%) |  3.1ns (- 0%) |   2.8ns (- 9%) |  5.8ns (+84%) |  5.8ns (+85%) | fromCharCode   | -13% |
| prettier-core            |     817 | 100.0% |   0.86% |   2.7ns |  2.5ns (- 6%) |  2.7ns (- 0%) |  2.4ns (- 9%) |  2.8ns (+ 4%) |  2.8ns (+ 5%) |   2.5ns (- 6%) | 6.0ns (+124%) | 6.0ns (+125%) | fromCharCode   | - 9% |
| vue                      |   21172 | 100.0% |   0.89% |   3.0ns |  2.7ns (-10%) |  2.6ns (-14%) |  2.6ns (-12%) |  2.9ns (- 2%) |  2.9ns (- 2%) |   2.7ns (-10%) | 9.6ns (+224%) | 9.8ns (+229%) | apply30        | -14% |
| hono-types               |    7936 |  98.6% |       - |  16.0ns |  2.5ns (-84%) |  2.4ns (-85%) |  2.5ns (-84%) | 17.9ns (+12%) |  2.9ns (-82%) |   2.6ns (-84%) |  6.5ns (-59%) |  6.7ns (-58%) | apply30        | -85% |
| pdfjs-dist-pdf           |   39688 |  97.9% |   0.08% |  31.6ns |  3.1ns (-90%) |  2.9ns (-91%) |  3.0ns (-90%) | 36.2ns (+14%) |  3.4ns (-89%) |   3.1ns (-90%) | 11.8ns (-63%) | 11.2ns (-64%) | apply30        | -91% |
| lodash                   |   15794 |  83.4% |   1.50% |  27.6ns |  7.8ns (-72%) |  6.1ns (-78%) |  8.1ns (-71%) | 32.0ns (+16%) |  9.1ns (-67%) |   8.3ns (-70%) | 12.1ns (-56%) | 10.0ns (-64%) | apply30        | -78% |
| TypeScript-checker       |  121791 |  72.9% |   0.01% |  43.0ns | 13.5ns (-69%) |  9.6ns (-78%) | 13.7ns (-68%) | 49.2ns (+14%) | 13.9ns (-68%) |  14.4ns (-67%) | 22.8ns (-47%) | 16.3ns (-62%) | apply30        | -78% |
| RadixUIAdoptionSection   |     291 |  71.9% |   0.34% |  29.7ns |  8.1ns (-73%) |  6.5ns (-78%) |  7.8ns (-74%) | 30.1ns (+ 1%) |  8.6ns (-71%) |   7.8ns (-74%) | 10.6ns (-64%) |  9.1ns (-69%) | apply30        | -78% |
| excalidraw-App           |   17956 |  68.5% |   0.01% |  42.4ns | 13.9ns (-67%) |  8.5ns (-80%) | 13.9ns (-67%) | 47.4ns (+12%) | 13.5ns (-68%) |  14.0ns (-67%) | 17.6ns (-58%) | 10.5ns (-75%) | apply30        | -80% |
| three                    |   84014 |  59.9% |   0.22% |  28.4ns | 14.4ns (-49%) | 11.0ns (-61%) | 15.3ns (-46%) | 32.7ns (+15%) | 15.7ns (-45%) |  15.2ns (-47%) | 19.9ns (-30%) | 15.4ns (-46%) | apply30        | -61% |
| outline-Search           |     921 |  56.2% |       - |  40.8ns | 16.6ns (-59%) | 10.8ns (-73%) | 18.2ns (-55%) | 43.0ns (+ 5%) | 17.9ns (-56%) |  17.9ns (-56%) | 18.9ns (-54%) | 11.2ns (-73%) | apply30        | -73% |
| echarts                  |  182793 |   4.3% |   0.05% |  30.5ns | 34.5ns (+13%) | 22.8ns (-25%) | 34.7ns (+14%) | 36.5ns (+20%) | 35.7ns (+17%) |  34.3ns (+12%) | 33.0ns (+ 8%) | 20.6ns (-32%) | switch30       | -32% |
| victory                  |  121588 |   2.8% |   0.08% |  37.7ns | 37.4ns (- 1%) | 26.3ns (-30%) | 37.5ns (- 1%) | 37.9ns (+ 1%) | 37.9ns (+ 1%) |  37.6ns (- 0%) | 36.2ns (- 4%) | 23.9ns (-37%) | switch30       | -37% |
| d3                       |   53554 |   1.9% |   0.05% |  20.2ns | 23.3ns (+15%) | 18.1ns (-10%) | 21.6ns (+ 7%) | 22.0ns (+ 9%) | 22.8ns (+13%) |  21.6ns (+ 7%) | 21.0ns (+ 4%) | 14.7ns (-27%) | switch30       | -27% |
| antd                     |  291269 |   1.3% |   0.02% |  44.7ns | 40.2ns (-10%) | 29.1ns (-35%) | 44.6ns (- 0%) | 42.8ns (- 4%) | 42.8ns (- 4%) |  42.6ns (- 5%) | 40.6ns (- 9%) | 27.3ns (-39%) | switch30       | -39% |
| typescript               |  461346 |   0.6% |   0.05% |  37.5ns | 40.7ns (+ 8%) | 27.4ns (-27%) | 43.4ns (+16%) | 44.9ns (+20%) | 41.0ns (+ 9%) |  43.2ns (+15%) | 43.4ns (+15%) | 25.4ns (-32%) | switch30       | -32% |
| terser-bundle.min        |   64495 |   0.2% |   0.17% |  34.8ns | 41.7ns (+20%) | 24.9ns (-28%) | 40.9ns (+18%) | 41.8ns (+20%) | 41.3ns (+19%) |  40.2ns (+16%) | 37.2ns (+ 7%) | 21.0ns (-40%) | switch30       | -40% |
| cal.com                  |   86205 |   0.1% |   0.00% |  45.6ns | 43.6ns (- 4%) | 28.8ns (-37%) | 46.4ns (+ 2%) | 44.8ns (- 2%) | 48.9ns (+ 7%) |  45.8ns (+ 0%) | 43.6ns (- 4%) | 25.5ns (-44%) | switch30       | -44% |
| ------------------------ | ------- | ------ | ------- | ------- | ------------- | ------------- | ------------- | ------------- | ------------- | -------------- | ------------- | ------------- | -------------- | ---- |
| Average                  |   64618 |  64.8% |   0.23% |  21.4ns | 14.6ns (-32%) | 10.3ns (-52%) | 15.0ns (-30%) | 23.4ns (+ 9%) | 15.2ns (-29%) |  14.9ns (-31%) | 17.6ns (-18%) | 12.6ns (-41%) | apply30        | -52% |

### `apply30` vs `switch30`

| File                     | strings |  ASCII | non-src | apply30 |       switch30 | fastest  |   by |
| ------------------------ | ------: | -----: | ------: | ------: | -------------: | -------- | ---: |
| TypeScript-binder        |    8758 | 100.0% |       - |   1.8ns |  6.0ns (+235%) | apply30  |      |
| next.js-index            |    1768 | 100.0% |       - |   1.9ns |  5.7ns (+193%) | apply30  |      |
| next.js-next             |    1027 | 100.0% |       - |   1.9ns |  5.6ns (+199%) | apply30  |      |
| prettier-handle-comments |    1456 | 100.0% |       - |   1.9ns |  5.3ns (+181%) | apply30  |      |
| moment                   |   10796 | 100.0% |   0.07% |   2.1ns |  7.1ns (+241%) | apply30  |      |
| jquery                   |   16517 | 100.0% |   0.24% |   2.3ns |  8.3ns (+257%) | apply30  |      |
| react-react.development  |    3117 | 100.0% |   0.32% |   2.4ns |  6.0ns (+151%) | apply30  |      |
| core-errors              |     372 | 100.0% |   0.81% |   2.8ns |  5.8ns (+109%) | apply30  |      |
| prettier-core            |     817 | 100.0% |   0.86% |   2.5ns |  6.0ns (+139%) | apply30  |      |
| vue                      |   21172 | 100.0% |   0.89% |   2.5ns |  9.6ns (+279%) | apply30  |      |
| hono-types               |    7936 |  98.6% |       - |   2.4ns |  6.8ns (+183%) | apply30  |      |
| pdfjs-dist-pdf           |   39688 |  97.9% |   0.08% |   3.0ns | 11.7ns (+290%) | apply30  |      |
| lodash                   |   15794 |  83.4% |   1.50% |   6.2ns |  10.2ns (+65%) | apply30  |      |
| TypeScript-checker       |  121791 |  72.9% |   0.01% |   8.7ns |  15.9ns (+84%) | apply30  |      |
| RadixUIAdoptionSection   |     291 |  71.9% |   0.34% |   6.3ns |   9.4ns (+50%) | apply30  |      |
| excalidraw-App           |   17956 |  68.5% |   0.01% |   8.5ns |  11.1ns (+30%) | apply30  |      |
| three                    |   84014 |  59.9% |   0.22% |  10.5ns |  15.0ns (+43%) | apply30  |      |
| outline-Search           |     921 |  56.2% |       - |  10.9ns |  11.4ns (+ 5%) | apply30  |      |
| echarts                  |  182793 |   4.3% |   0.05% |  22.1ns |  20.4ns (- 8%) | switch30 | - 8% |
| victory                  |  121588 |   2.8% |   0.08% |  24.7ns |  23.3ns (- 6%) | switch30 | - 6% |
| d3                       |   53554 |   1.9% |   0.05% |  17.8ns |  15.1ns (-15%) | switch30 | -15% |
| antd                     |  291269 |   1.3% |   0.02% |  29.3ns |  27.0ns (- 8%) | switch30 | - 8% |
| typescript               |  461346 |   0.6% |   0.05% |  26.7ns |  24.5ns (- 8%) | switch30 | - 8% |
| terser-bundle.min        |   64495 |   0.2% |   0.17% |  23.7ns |  20.5ns (-13%) | switch30 | -13% |
| cal.com                  |   86205 |   0.1% |   0.00% |  27.9ns |  24.5ns (-12%) | switch30 | -12% |
| ------------------------ | ------- | ------ | ------- | ------- | -------------- | -------- | ---- |
| Average                  |   64618 |  64.8% |   0.23% |  10.0ns |  12.5ns (+25%) | apply30  |      |

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
