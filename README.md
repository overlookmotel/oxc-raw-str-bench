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
- `latin` - `simpler-branch` with slice of Latin1-decoded string for ASCII strings
- `latin30` - `latin` with the crossover point to `TextDecoder` at 30 bytes
- `latin-source64` - `latin64` with strings outside source text region using `fromCharCode.apply`
- `latin64` - `latin` with the crossover point to `TextDecoder` at 64 bytes

Notes:

- `switch30` beats `apply30` in files which hit the slow path often, but `apply30` wins by a mile in pure-ASCII files.
- `latin*` variants have larger set-up cost (likely acceptable given the huge speedups for many files).
- `latin-source64` is a bit slower than `latin64`, but does not rely on all strings being clustered together in memory (which they are in this benchmark, but are not in Oxc at present).

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

| File                     | strings |  ASCII | non-src | current |       pr20834 |  pr20834-fnap | simpler-branch |  fromCharCode |         switch |      switch30 |         apply |       apply30 |         latin |       latin30 |       latin64 | latin-source64 | fastest        |   by |
| ------------------------ | ------: | -----: | ------: | ------: | ------------: | ------------: | -------------: | ------------: | -------------: | ------------: | ------------: | ------------: | ------------: | ------------: | ------------: | -------------: | -------------- | ---: |
| TypeScript-binder        |    8758 | 100.0% |       - |   2.2ns |  2.2ns (- 1%) |  2.1ns (- 1%) |   1.8ns (-17%) |  1.9ns (-12%) |  5.7ns (+161%) | 6.1ns (+183%) |  1.8ns (-16%) |  2.1ns (- 5%) |  2.4ns (+10%) |  1.9ns (-14%) |  2.0ns (- 9%) |   1.8ns (-17%) | simpler-branch | -17% |
| next.js-index            |    1768 | 100.0% |       - |   2.2ns |  2.9ns (+32%) |  2.2ns (+ 0%) |   1.9ns (-10%) |  1.9ns (-13%) |  5.7ns (+163%) | 6.0ns (+178%) |  1.9ns (-12%) |  2.0ns (- 9%) |  2.0ns (- 7%) |  1.9ns (-11%) |  2.1ns (- 3%) |   2.1ns (- 4%) | fromCharCode   | -13% |
| next.js-next             |    1027 | 100.0% |       - |   2.1ns |  2.2ns (+ 1%) |  2.2ns (+ 0%) |   2.0ns (- 9%) |  2.0ns (- 7%) |  5.4ns (+153%) | 5.8ns (+170%) |  2.2ns (+ 4%) |  2.3ns (+ 7%) |  1.9ns (-11%) |  1.9ns (-12%) |  1.9ns (-12%) |   1.9ns (-11%) | latin30        | -12% |
| prettier-handle-comments |    1456 | 100.0% |       - |   2.2ns |  2.1ns (- 4%) |  2.2ns (+ 0%) |   2.0ns (-12%) |  2.0ns (-11%) |  5.6ns (+151%) | 5.6ns (+153%) |  2.2ns (- 1%) |  1.9ns (-14%) |  1.9ns (-13%) |  1.9ns (-15%) |  1.9ns (-15%) |   1.9ns (-14%) | latin30        | -15% |
| moment                   |   10796 | 100.0% |   0.07% |   2.1ns |  2.3ns (+ 8%) |  2.5ns (+16%) |   2.1ns (- 2%) |  2.1ns (- 3%) |  7.3ns (+240%) | 6.8ns (+219%) |  2.2ns (+ 3%) |  2.0ns (- 8%) |  2.2ns (+ 2%) |  1.9ns (-10%) |  1.8ns (-14%) |   2.2ns (+ 4%) | latin64        | -14% |
| jquery                   |   16517 | 100.0% |   0.24% |   2.6ns |  2.5ns (- 2%) |  2.5ns (- 2%) |   2.3ns (-10%) |  2.3ns (- 9%) |  9.1ns (+254%) | 8.7ns (+238%) |  2.4ns (- 8%) |  2.3ns (-10%) |  2.3ns (- 9%) |  2.5ns (- 3%) |  1.9ns (-26%) |   2.4ns (- 6%) | latin64        | -26% |
| react-react.development  |    3117 | 100.0% |   0.32% |   2.9ns |  2.7ns (- 6%) |  2.8ns (- 2%) |   2.5ns (-13%) |  2.5ns (-12%) |  5.9ns (+103%) | 5.8ns (+102%) |  2.6ns (-11%) |  2.5ns (-15%) |  2.5ns (-14%) |  2.5ns (-14%) |  2.5ns (-13%) |   2.4ns (-18%) | latin-source64 | -18% |
| core-errors              |     372 | 100.0% |   0.81% |   3.0ns |  3.1ns (+ 2%) |  3.1ns (+ 1%) |   2.8ns (- 7%) |  2.8ns (- 8%) |   5.8ns (+90%) |  5.6ns (+85%) |  2.9ns (- 5%) |  2.9ns (- 6%) |  2.9ns (- 6%) |  2.8ns (- 9%) |  2.9ns (- 6%) |   2.9ns (- 6%) | latin30        | - 9% |
| prettier-core            |     817 | 100.0% |   0.86% |   2.6ns |  2.7ns (+ 2%) |  2.7ns (+ 1%) |   2.4ns (- 8%) |  2.5ns (- 6%) |  6.0ns (+127%) | 6.1ns (+128%) |  2.5ns (- 6%) |  2.5ns (- 6%) |  2.4ns (- 9%) |  2.5ns (- 5%) |  2.5ns (- 7%) |   2.5ns (- 7%) | latin          | - 9% |
| vue                      |   21172 | 100.0% |   0.89% |   2.9ns |  2.9ns (- 2%) |  2.9ns (- 3%) |   2.7ns (- 7%) |  2.7ns (- 7%) | 10.5ns (+255%) | 9.5ns (+224%) |  2.6ns (-10%) |  2.6ns (-13%) |  2.8ns (- 6%) |  2.5ns (-16%) |  2.5ns (-15%) |   2.6ns (-11%) | latin30        | -16% |
| hono-types               |    7936 |  98.6% |       - |  15.7ns | 17.3ns (+10%) |  2.8ns (-82%) |   2.5ns (-84%) |  2.5ns (-84%) |   6.7ns (-58%) |  7.0ns (-56%) |  2.5ns (-84%) |  2.5ns (-84%) |  2.5ns (-84%) |  2.3ns (-85%) |  2.3ns (-85%) |   2.4ns (-85%) | latin30        | -85% |
| pdfjs-dist-pdf           |   39688 |  97.9% |   0.08% |  33.2ns | 35.2ns (+ 6%) |  3.4ns (-90%) |   3.2ns (-90%) |  3.2ns (-90%) |  11.4ns (-66%) | 12.1ns (-64%) |  3.2ns (-90%) |  2.9ns (-91%) |  3.0ns (-91%) |  2.6ns (-92%) |  2.6ns (-92%) |   2.3ns (-93%) | latin-source64 | -93% |
| lodash                   |   15794 |  83.4% |   1.50% |  28.1ns | 31.4ns (+12%) |  8.5ns (-70%) |   8.5ns (-70%) |  8.3ns (-70%) |  11.4ns (-59%) |  9.7ns (-65%) |  7.6ns (-73%) |  6.4ns (-77%) |  5.9ns (-79%) |  3.6ns (-87%) |  3.5ns (-88%) |   3.9ns (-86%) | latin64        | -88% |
| TypeScript-checker       |  121791 |  72.9% |   0.01% |  43.6ns | 48.2ns (+11%) | 14.3ns (-67%) |  13.3ns (-69%) | 13.4ns (-69%) |  21.8ns (-50%) | 16.6ns (-62%) | 13.4ns (-69%) |  9.0ns (-79%) | 12.2ns (-72%) |  4.3ns (-90%) |  4.3ns (-90%) |   4.7ns (-89%) | latin64        | -90% |
| RadixUIAdoptionSection   |     291 |  71.9% |   0.34% |  28.3ns | 27.4ns (- 3%) |  7.9ns (-72%) |   7.6ns (-73%) |  7.5ns (-73%) |  10.5ns (-63%) |  9.2ns (-68%) |  7.9ns (-72%) |  6.7ns (-76%) |  6.6ns (-77%) |  4.6ns (-84%) |  4.3ns (-85%) |   4.2ns (-85%) | latin-source64 | -85% |
| excalidraw-App           |   17956 |  68.5% |   0.01% |  40.6ns | 45.5ns (+12%) | 14.2ns (-65%) |  13.4ns (-67%) | 13.8ns (-66%) |  17.2ns (-58%) | 11.2ns (-72%) | 13.2ns (-68%) |  8.7ns (-79%) | 12.0ns (-70%) |  3.7ns (-91%) |  3.4ns (-92%) |   3.8ns (-91%) | latin64        | -92% |
| three                    |   84014 |  59.9% |   0.22% |  29.7ns | 31.7ns (+ 6%) | 15.4ns (-48%) |  15.1ns (-49%) | 15.1ns (-49%) |  19.9ns (-33%) | 15.7ns (-47%) | 14.6ns (-51%) | 10.9ns (-63%) | 11.5ns (-61%) |  4.5ns (-85%) |  4.6ns (-84%) |   5.2ns (-83%) | latin30        | -85% |
| outline-Search           |     921 |  56.2% |       - |  42.4ns | 43.6ns (+ 3%) | 18.6ns (-56%) |  17.7ns (-58%) | 18.5ns (-56%) |  18.5ns (-56%) | 11.5ns (-73%) | 17.0ns (-60%) | 11.2ns (-74%) | 15.1ns (-64%) |  5.1ns (-88%) |  4.6ns (-89%) |   4.9ns (-88%) | latin64        | -89% |
| echarts                  |  182793 |   4.3% |   0.05% |  29.9ns | 36.0ns (+20%) | 35.4ns (+18%) |  35.2ns (+18%) | 33.9ns (+13%) |  33.5ns (+12%) | 21.3ns (-29%) | 33.0ns (+10%) | 22.9ns (-24%) | 26.3ns (-12%) | 10.1ns (-66%) | 10.6ns (-64%) |  10.4ns (-65%) | latin30        | -66% |
| victory                  |  121588 |   2.8% |   0.08% |  38.0ns | 36.1ns (- 5%) | 37.3ns (- 2%) |  38.9ns (+ 2%) | 35.4ns (- 7%) |  37.2ns (- 2%) | 23.9ns (-37%) | 34.5ns (- 9%) | 25.8ns (-32%) | 28.1ns (-26%) | 13.4ns (-65%) |  9.4ns (-75%) |  10.2ns (-73%) | latin64        | -75% |
| d3                       |   53554 |   1.9% |   0.05% |  20.2ns | 21.4ns (+ 6%) | 21.6ns (+ 7%) |  21.4ns (+ 6%) | 20.9ns (+ 3%) |  19.6ns (- 3%) | 15.1ns (-25%) | 22.6ns (+12%) | 17.9ns (-11%) | 12.9ns (-36%) |  6.2ns (-69%) |  6.4ns (-68%) |   6.6ns (-67%) | latin30        | -69% |
| antd                     |  291269 |   1.3% |   0.02% |  42.4ns | 42.3ns (- 0%) | 43.5ns (+ 2%) |  41.7ns (- 2%) | 41.9ns (- 1%) |  41.0ns (- 3%) | 27.2ns (-36%) | 40.6ns (- 4%) | 29.4ns (-31%) | 35.0ns (-17%) | 17.6ns (-59%) | 12.1ns (-71%) |  12.8ns (-70%) | latin64        | -71% |
| typescript               |  461346 |   0.6% |   0.05% |  39.7ns | 39.8ns (+ 0%) | 40.7ns (+ 2%) |  41.2ns (+ 4%) | 40.9ns (+ 3%) |  41.1ns (+ 3%) | 25.8ns (-35%) | 40.2ns (+ 1%) | 27.5ns (-31%) | 34.9ns (-12%) | 13.8ns (-65%) | 13.3ns (-67%) |  13.1ns (-67%) | latin-source64 | -67% |
| terser-bundle.min        |   64495 |   0.2% |   0.17% |  36.3ns | 38.4ns (+ 6%) | 40.7ns (+12%) |  38.9ns (+ 7%) | 39.1ns (+ 7%) |  37.7ns (+ 4%) | 21.6ns (-40%) | 42.4ns (+17%) | 25.2ns (-31%) | 31.5ns (-13%) |  8.9ns (-75%) |  9.1ns (-75%) |   8.6ns (-76%) | latin-source64 | -76% |
| cal.com                  |   86205 |   0.1% |   0.00% |  44.2ns | 46.9ns (+ 6%) | 45.6ns (+ 3%) |  45.9ns (+ 4%) | 47.1ns (+ 7%) |  44.7ns (+ 1%) | 25.1ns (-43%) | 43.0ns (- 3%) | 29.1ns (-34%) | 38.1ns (-14%) | 12.1ns (-73%) | 10.7ns (-76%) |  11.4ns (-74%) | latin64        | -76% |
| ------------------------ | ------- | ------ | ------- | ------- | ------------- | ------------- | -------------- | ------------- | -------------- | ------------- | ------------- | ------------- | ------------- | ------------- | ------------- | -------------- | -------------- | ---- |
| Average                  |   64618 |  64.8% |   0.23% |  21.5ns | 22.7ns (+ 5%) | 15.0ns (-30%) |  14.7ns (-32%) | 14.6ns (-32%) |  17.6ns (-18%) | 12.8ns (-41%) | 14.4ns (-33%) | 10.4ns (-52%) | 12.0ns (-44%) |  5.4ns (-75%) |  4.9ns (-77%) |   5.1ns (-76%) | latin64        | -77% |

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

### `apply30` vs `latin*` vs `latin-source64`

| File                     | strings |  ASCII | non-src | apply30 |       latin30 |       latin64 | latin-source64 | fastest        |   by |
| ------------------------ | ------: | -----: | ------: | ------: | ------------: | ------------: | -------------: | -------------- | ---: |
| TypeScript-binder        |    8758 | 100.0% |       - |   2.1ns |  1.8ns (-11%) |  1.8ns (-11%) |   1.9ns (- 8%) | latin64        | -11% |
| next.js-index            |    1768 | 100.0% |       - |   1.9ns |  1.9ns (+ 1%) |  1.9ns (+ 1%) |   1.9ns (+ 2%) | apply30        |      |
| next.js-next             |    1027 | 100.0% |       - |   1.9ns |  1.9ns (+ 2%) |  1.9ns (+ 2%) |   2.0ns (+ 5%) | apply30        |      |
| prettier-handle-comments |    1456 | 100.0% |       - |   1.9ns |  1.9ns (+ 2%) |  1.9ns (+ 2%) |   1.9ns (+ 0%) | apply30        |      |
| moment                   |   10796 | 100.0% |   0.07% |   2.1ns |  1.8ns (-14%) |  1.9ns (- 8%) |   2.0ns (- 3%) | latin30        | -14% |
| jquery                   |   16517 | 100.0% |   0.24% |   2.3ns |  2.2ns (- 3%) |  1.9ns (-16%) |   2.3ns (- 2%) | latin64        | -16% |
| react-react.development  |    3117 | 100.0% |   0.32% |   2.5ns |  2.5ns (+ 2%) |  2.3ns (- 9%) |   2.3ns (- 7%) | latin64        | - 9% |
| core-errors              |     372 | 100.0% |   0.81% |   2.9ns |  2.8ns (- 1%) |  2.8ns (- 3%) |   2.7ns (- 4%) | latin-source64 | - 4% |
| prettier-core            |     817 | 100.0% |   0.86% |   2.4ns |  2.5ns (+ 3%) |  2.4ns (- 1%) |   2.6ns (+ 7%) | latin64        | - 1% |
| vue                      |   21172 | 100.0% |   0.89% |   2.6ns |  2.4ns (- 6%) |  2.4ns (- 7%) |   2.6ns (+ 2%) | latin64        | - 7% |
| hono-types               |    7936 |  98.6% |       - |   2.4ns |  2.4ns (- 1%) |  2.4ns (- 0%) |   2.2ns (- 8%) | latin-source64 | - 8% |
| pdfjs-dist-pdf           |   39688 |  97.9% |   0.08% |   2.9ns |  2.7ns (- 4%) |  2.5ns (-11%) |   2.4ns (-16%) | latin-source64 | -16% |
| lodash                   |   15794 |  83.4% |   1.50% |   6.1ns |  3.6ns (-41%) |  3.6ns (-42%) |   3.8ns (-39%) | latin64        | -42% |
| TypeScript-checker       |  121791 |  72.9% |   0.01% |   8.7ns |  4.4ns (-50%) |  3.7ns (-58%) |   3.9ns (-56%) | latin64        | -58% |
| RadixUIAdoptionSection   |     291 |  71.9% |   0.34% |   6.3ns |  4.6ns (-27%) |  4.4ns (-31%) |   4.3ns (-32%) | latin-source64 | -32% |
| excalidraw-App           |   17956 |  68.5% |   0.01% |   8.5ns |  3.7ns (-57%) |  3.8ns (-55%) |   4.0ns (-54%) | latin30        | -57% |
| three                    |   84014 |  59.9% |   0.22% |  10.6ns |  4.7ns (-55%) |  4.1ns (-61%) |   4.5ns (-57%) | latin64        | -61% |
| outline-Search           |     921 |  56.2% |       - |  10.8ns |  5.2ns (-52%) |  4.6ns (-57%) |   4.6ns (-57%) | latin-source64 | -57% |
| echarts                  |  182793 |   4.3% |   0.05% |  21.6ns | 10.2ns (-53%) | 10.7ns (-51%) |  10.9ns (-49%) | latin30        | -53% |
| victory                  |  121588 |   2.8% |   0.08% |  24.6ns | 12.8ns (-48%) |  8.9ns (-64%) |  10.1ns (-59%) | latin64        | -64% |
| d3                       |   53554 |   1.9% |   0.05% |  17.7ns |  5.9ns (-67%) |  5.5ns (-69%) |   6.3ns (-64%) | latin64        | -69% |
| antd                     |  291269 |   1.3% |   0.02% |  29.1ns | 17.5ns (-40%) | 12.1ns (-59%) |  12.0ns (-59%) | latin-source64 | -59% |
| typescript               |  461346 |   0.6% |   0.05% |  26.2ns | 14.8ns (-44%) | 11.9ns (-55%) |  13.3ns (-49%) | latin64        | -55% |
| terser-bundle.min        |   64495 |   0.2% |   0.17% |  23.9ns |  8.6ns (-64%) |  8.0ns (-67%) |   8.4ns (-65%) | latin64        | -67% |
| cal.com                  |   86205 |   0.1% |   0.00% |  28.1ns | 12.4ns (-56%) |  9.6ns (-66%) |  10.0ns (-64%) | latin64        | -66% |
| ------------------------ | ------- | ------ | ------- | ------- | ------------- | ------------- | -------------- | -------------- | ---- |
| Average                  |   64618 |  64.8% |   0.23% |  10.0ns |  5.4ns (-46%) |  4.7ns (-53%) |   4.9ns (-51%) | latin64        | -53% |

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
