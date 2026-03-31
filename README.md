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
- `latin-4-chunk64` - `latin64` with bytes checked for ASCII in blocks of 4 bytes
- `latin-8-chunk64` - `latin64` with bytes checked for ASCII in blocks of 8 bytes
- `latin-16-chunk64` - `latin64` with bytes checked for ASCII in blocks of 16 bytes

Notes:

- `switch30` beats `apply30` in files which hit the slow path often, but `apply30` wins by a mile in pure-ASCII files.
- `latin*` variants have larger set-up cost (likely acceptable given the huge speedups for many files).
- `latin-source64` is a bit slower than `latin64`, but does not rely on all strings being clustered together in memory (which they are in this benchmark, but are not in Oxc at present).
- `latin-4-chunk64`, `latin-8-chunk64`, and `latin-16-chunk64` are a large gain on many files, but unclear which is optimal. No outright winner across all fixtures.
- `latin-*-chunk64` versions require padding bytes after string data to avoid regression on some small fixtures, due to "string is not all ASCII" false positives. We can ensure that in Oxc no problem.

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

| File                     | strings |  ASCII | non-src | current |       pr20834 |  pr20834-fnap | simpler-branch |  fromCharCode |        switch |       switch30 |         apply |       apply30 |         latin |       latin30 |       latin64 | latin-source64 | latin-4-chunk64 | latin-8-chunk64 | latin-16-chunk64 | fastest          |   by |
| ------------------------ | ------: | -----: | ------: | ------: | ------------: | ------------: | -------------: | ------------: | ------------: | -------------: | ------------: | ------------: | ------------: | ------------: | ------------: | -------------: | --------------: | --------------: | ---------------: | ---------------- | ---: |
| TypeScript-binder        |    8758 | 100.0% |       - |   2.2ns |  2.7ns (+24%) |  2.2ns (+ 0%) |   2.0ns (-11%) |  1.9ns (-15%) | 5.8ns (+165%) |  6.2ns (+184%) |  1.9ns (-15%) |  2.1ns (- 6%) |  1.8ns (-18%) |  2.2ns (- 1%) |  1.8ns (-17%) |   2.0ns (- 7%) |    2.2ns (+ 1%) |    1.9ns (-14%) |     1.9ns (-15%) | latin            | -18% |
| next.js-index            |    1768 | 100.0% |       - |   2.1ns |  2.1ns (+ 1%) |  2.2ns (+ 6%) |   1.9ns (-10%) |  2.1ns (- 1%) | 5.8ns (+176%) |  5.9ns (+180%) |  1.9ns (- 8%) |  2.0ns (- 7%) |  2.1ns (+ 0%) |  2.1ns (+ 1%) |  2.3ns (+ 9%) |   2.0ns (- 5%) |    2.1ns (- 2%) |    2.0ns (- 6%) |     2.0ns (- 7%) | simpler-branch   | -10% |
| next.js-next             |    1027 | 100.0% |       - |   2.2ns |  2.3ns (+ 4%) |  2.2ns (- 0%) |   1.9ns (-16%) |  1.9ns (-14%) | 5.5ns (+150%) |  5.7ns (+160%) |  2.0ns (-10%) |  1.9ns (-15%) |  1.9ns (-14%) |  1.9ns (-12%) |  2.0ns (-10%) |   2.1ns (- 5%) |    2.0ns (-12%) |    2.3ns (+ 6%) |     1.9ns (-15%) | simpler-branch   | -16% |
| prettier-handle-comments |    1456 | 100.0% |       - |   2.2ns |  2.2ns (- 1%) |  2.3ns (+ 7%) |   1.9ns (-14%) |  1.9ns (-13%) | 5.6ns (+154%) |  5.9ns (+168%) |  2.0ns (-10%) |  1.9ns (-15%) |  1.9ns (-15%) |  1.9ns (-11%) |  1.9ns (-14%) |   2.0ns (-11%) |    1.9ns (-13%) |    1.9ns (-13%) |     1.9ns (-13%) | apply30          | -15% |
| moment                   |   10796 | 100.0% |   0.07% |   2.1ns |  2.3ns (+ 9%) |  2.5ns (+18%) |   2.4ns (+13%) |  2.5ns (+18%) | 6.2ns (+193%) |  6.7ns (+215%) |  2.4ns (+13%) |  2.0ns (- 7%) |  2.0ns (- 7%) |  1.9ns (-10%) |  2.4ns (+15%) |   2.2ns (+ 3%) |    1.8ns (-13%) |    2.0ns (- 5%) |     2.0ns (- 6%) | latin-4-chunk64  | -13% |
| jquery                   |   16517 | 100.0% |   0.24% |   2.5ns |  2.5ns (- 0%) |  2.6ns (+ 3%) |   2.3ns (- 7%) |  2.4ns (- 6%) | 8.2ns (+226%) |  8.7ns (+246%) |  2.3ns (- 8%) |  2.2ns (-11%) |  2.3ns (-10%) |  2.3ns (- 8%) |  2.3ns (- 9%) |   2.3ns (-10%) |    2.5ns (- 2%) |    1.9ns (-25%) |     2.1ns (-18%) | latin-8-chunk64  | -25% |
| react-react.development  |    3117 | 100.0% |   0.32% |   2.8ns |  2.7ns (- 2%) |  2.7ns (- 1%) |   2.5ns (-10%) |  2.5ns (- 9%) | 6.0ns (+117%) |  6.0ns (+116%) |  2.5ns (-11%) |  2.5ns (-10%) |  2.5ns (-10%) |  2.5ns (-10%) |  2.3ns (-18%) |   2.6ns (- 7%) |    2.2ns (-19%) |    2.2ns (-20%) |     2.3ns (-18%) | latin-8-chunk64  | -20% |
| core-errors              |     372 | 100.0% |   0.81% |   3.1ns |  3.1ns (- 1%) |  3.1ns (+ 0%) |   2.8ns (- 9%) |  2.8ns (-10%) |  5.7ns (+82%) |   5.6ns (+81%) |  2.9ns (- 5%) |  2.8ns (-10%) |  2.8ns (- 9%) |  2.8ns (- 8%) |  2.9ns (- 8%) |   2.8ns (- 9%) |    2.9ns (- 6%) |    2.8ns (- 9%) |     2.8ns (- 9%) | apply30          | -10% |
| prettier-core            |     817 | 100.0% |   0.86% |   2.7ns |  2.7ns (- 0%) |  2.7ns (+ 1%) |   2.5ns (- 8%) |  2.4ns (-10%) | 5.8ns (+115%) |  5.9ns (+121%) |  2.6ns (- 4%) |  2.5ns (- 8%) |  2.4ns (- 9%) |  2.5ns (- 8%) |  2.5ns (- 7%) |   2.6ns (- 4%) |    2.4ns (-10%) |    2.6ns (- 2%) |     2.8ns (+ 3%) | fromCharCode     | -10% |
| vue                      |   21172 | 100.0% |   0.89% |   3.1ns |  2.9ns (- 5%) |  2.9ns (- 5%) |   2.7ns (-12%) |  2.7ns (-11%) | 9.7ns (+217%) | 10.3ns (+239%) |  2.7ns (-13%) |  2.6ns (-14%) |  2.7ns (-12%) |  2.5ns (-18%) |  2.4ns (-22%) |   2.6ns (-13%) |    2.5ns (-18%) |    2.5ns (-19%) |     2.5ns (-19%) | latin64          | -22% |
| hono-types               |    7936 |  98.6% |       - |  17.0ns | 16.7ns (- 1%) |  2.9ns (-83%) |   2.5ns (-85%) |  2.6ns (-85%) |  6.5ns (-61%) |   6.8ns (-60%) |  2.5ns (-85%) |  2.5ns (-85%) |  2.4ns (-86%) |  2.3ns (-86%) |  2.4ns (-86%) |   2.3ns (-87%) |    2.3ns (-86%) |    2.4ns (-86%) |     2.3ns (-86%) | latin-source64   | -87% |
| pdfjs-dist-pdf           |   39688 |  97.9% |   0.08% |  32.8ns | 36.0ns (+10%) |  3.4ns (-89%) |   3.1ns (-91%) |  3.1ns (-90%) | 11.0ns (-66%) |  11.3ns (-66%) |  3.1ns (-91%) |  2.9ns (-91%) |  3.1ns (-91%) |  2.6ns (-92%) |  2.5ns (-92%) |   2.4ns (-93%) |    2.5ns (-92%) |    2.4ns (-93%) |     2.4ns (-93%) | latin-source64   | -93% |
| lodash                   |   15794 |  83.4% |   1.50% |  28.7ns | 31.8ns (+10%) |  8.8ns (-70%) |   8.5ns (-70%) |  8.4ns (-71%) | 11.0ns (-62%) |  10.0ns (-65%) |  7.6ns (-73%) |  6.3ns (-78%) |  5.8ns (-80%) |  3.7ns (-87%) |  3.6ns (-88%) |   3.7ns (-87%) |    3.3ns (-88%) |    3.4ns (-88%) |     3.3ns (-88%) | latin-16-chunk64 | -88% |
| TypeScript-checker       |  121791 |  72.9% |   0.01% |  44.9ns | 47.3ns (+ 5%) | 14.2ns (-69%) |  14.1ns (-69%) | 13.5ns (-70%) | 22.1ns (-51%) |  16.7ns (-63%) | 13.3ns (-70%) |  9.3ns (-79%) | 12.2ns (-73%) |  4.7ns (-90%) |  3.8ns (-92%) |   5.0ns (-89%) |    2.9ns (-93%) |    3.0ns (-93%) |     3.1ns (-93%) | latin-4-chunk64  | -93% |
| RadixUIAdoptionSection   |     291 |  71.9% |   0.34% |  29.4ns | 28.9ns (- 2%) |  8.0ns (-73%) |   7.6ns (-74%) |  7.6ns (-74%) | 11.0ns (-63%) |   9.4ns (-68%) |  7.9ns (-73%) |  6.7ns (-77%) |  6.4ns (-78%) |  4.6ns (-84%) |  4.4ns (-85%) |   4.4ns (-85%) |    3.9ns (-87%) |    3.9ns (-87%) |     3.9ns (-87%) | latin-4-chunk64  | -87% |
| excalidraw-App           |   17956 |  68.5% |   0.01% |  42.5ns | 43.4ns (+ 2%) | 14.0ns (-67%) |  13.7ns (-68%) | 14.2ns (-67%) | 17.1ns (-60%) |  12.8ns (-70%) | 13.7ns (-68%) |  9.2ns (-78%) | 11.9ns (-72%) |  3.8ns (-91%) |  3.4ns (-92%) |   3.6ns (-92%) |    2.7ns (-94%) |    2.7ns (-94%) |     3.1ns (-93%) | latin-8-chunk64  | -94% |
| three                    |   84014 |  59.9% |   0.22% |  30.7ns | 33.1ns (+ 8%) | 15.4ns (-50%) |  15.3ns (-50%) | 15.5ns (-50%) | 20.0ns (-35%) |  15.4ns (-50%) | 15.0ns (-51%) | 11.1ns (-64%) | 11.1ns (-64%) |  4.8ns (-84%) |  4.9ns (-84%) |   4.9ns (-84%) |    4.2ns (-86%) |    3.6ns (-88%) |     3.4ns (-89%) | latin-16-chunk64 | -89% |
| outline-Search           |     921 |  56.2% |       - |  43.2ns | 44.0ns (+ 2%) | 18.3ns (-58%) |  18.3ns (-58%) | 17.9ns (-58%) | 19.1ns (-56%) |  11.0ns (-74%) | 16.9ns (-61%) | 10.8ns (-75%) | 15.2ns (-65%) |  5.3ns (-88%) |  4.6ns (-89%) |   4.7ns (-89%) |    3.3ns (-92%) |    3.4ns (-92%) |     3.5ns (-92%) | latin-4-chunk64  | -92% |
| echarts                  |  182793 |   4.3% |   0.05% |  30.8ns | 35.0ns (+14%) | 35.5ns (+15%) |  34.6ns (+12%) | 34.0ns (+10%) | 34.3ns (+11%) |  20.9ns (-32%) | 33.4ns (+ 8%) | 23.4ns (-24%) | 27.0ns (-12%) | 11.3ns (-63%) | 10.9ns (-64%) |  10.9ns (-65%) |    7.9ns (-74%) |    5.9ns (-81%) |     3.9ns (-87%) | latin-16-chunk64 | -87% |
| victory                  |  121588 |   2.8% |   0.08% |  39.7ns | 37.1ns (- 7%) | 36.3ns (- 9%) |  35.1ns (-12%) | 36.0ns (- 9%) | 35.0ns (-12%) |  23.6ns (-41%) | 34.5ns (-13%) | 25.7ns (-35%) | 28.2ns (-29%) | 13.4ns (-66%) | 10.2ns (-74%) |   9.4ns (-76%) |    6.3ns (-84%) |    4.7ns (-88%) |     3.9ns (-90%) | latin-16-chunk64 | -90% |
| d3                       |   53554 |   1.9% |   0.05% |  19.8ns | 21.7ns (+ 9%) | 21.8ns (+10%) |  21.0ns (+ 6%) | 21.2ns (+ 7%) | 19.4ns (- 2%) |  15.4ns (-22%) | 22.6ns (+14%) | 18.6ns (- 6%) | 13.0ns (-35%) |  6.2ns (-69%) |  6.8ns (-66%) |   7.0ns (-65%) |    6.5ns (-67%) |    4.2ns (-79%) |     3.2ns (-84%) | latin-16-chunk64 | -84% |
| antd                     |  291269 |   1.3% |   0.02% |  43.1ns | 42.9ns (- 1%) | 43.6ns (+ 1%) |  42.4ns (- 2%) | 41.5ns (- 4%) | 41.2ns (- 4%) |  27.6ns (-36%) | 40.7ns (- 6%) | 30.3ns (-30%) | 35.1ns (-19%) | 19.1ns (-56%) | 13.4ns (-69%) |  12.4ns (-71%) |    9.3ns (-78%) |    8.2ns (-81%) |     6.6ns (-85%) | latin-16-chunk64 | -85% |
| typescript               |  461346 |   0.6% |   0.05% |  38.4ns | 41.7ns (+ 9%) | 41.2ns (+ 7%) |  41.3ns (+ 8%) | 42.2ns (+10%) | 40.7ns (+ 6%) |  25.6ns (-33%) | 41.1ns (+ 7%) | 27.8ns (-28%) | 36.1ns (- 6%) | 14.4ns (-62%) | 13.1ns (-66%) |  13.5ns (-65%) |   10.3ns (-73%) |    8.5ns (-78%) |     5.7ns (-85%) | latin-16-chunk64 | -85% |
| terser-bundle.min        |   64495 |   0.2% |   0.17% |  37.1ns | 39.1ns (+ 5%) | 39.4ns (+ 6%) |  38.5ns (+ 4%) | 38.8ns (+ 5%) | 36.8ns (- 1%) |  21.1ns (-43%) | 38.0ns (+ 2%) | 25.1ns (-32%) | 31.3ns (-16%) |  8.3ns (-78%) |  9.4ns (-75%) |   9.6ns (-74%) |    6.3ns (-83%) |    4.6ns (-88%) |     4.3ns (-89%) | latin-16-chunk64 | -89% |
| cal.com                  |   86205 |   0.1% |   0.00% |  46.0ns | 47.1ns (+ 2%) | 45.7ns (- 1%) |  46.1ns (+ 0%) | 44.4ns (- 4%) | 43.4ns (- 6%) |  25.4ns (-45%) | 43.2ns (- 6%) | 29.4ns (-36%) | 37.9ns (-18%) | 12.5ns (-73%) | 10.9ns (-76%) |  11.7ns (-75%) |    6.5ns (-86%) |    5.3ns (-89%) |     4.9ns (-89%) | latin-16-chunk64 | -89% |
| ------------------------ | ------- | ------ | ------- | ------- | ------------- | ------------- | -------------- | ------------- | ------------- | -------------- | ------------- | ------------- | ------------- | ------------- | ------------- | -------------- | --------------- | --------------- | ---------------- | ---------------- | ---- |
| Average                  |   64618 |  64.8% |   0.23% |  22.0ns | 22.9ns (+ 4%) | 15.0ns (-32%) |  14.6ns (-34%) | 14.6ns (-34%) | 17.3ns (-21%) |  12.8ns (-42%) | 14.3ns (-35%) | 10.5ns (-52%) | 12.0ns (-46%) |  5.6ns (-75%) |  5.1ns (-77%) |   5.1ns (-77%) |    4.0ns (-82%) |    3.5ns (-84%) |     3.2ns (-85%) | latin-16-chunk64 | -85% |

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

### `latin-4-chunk64` vs `latin-8-chunk64` vs `latin-16-chunk64`

| File                     | strings |  ASCII | non-src | latin64 | latin-4-chunk64 | latin-8-chunk64 | latin-16-chunk64 | fastest          |   by |
| ------------------------ | ------: | -----: | ------: | ------: | --------------: | --------------: | ---------------: | ---------------- | ---: |
| TypeScript-binder        |    8758 | 100.0% |       - |   1.8ns |    1.8ns (- 0%) |    1.8ns (- 2%) |     1.9ns (+ 6%) | latin-8-chunk64  | - 2% |
| next.js-index            |    1768 | 100.0% |       - |   1.9ns |    1.9ns (+ 1%) |    2.0ns (+ 3%) |     1.9ns (+ 0%) | latin64          |      |
| next.js-next             |    1027 | 100.0% |       - |   2.0ns |    1.9ns (- 4%) |    1.9ns (- 2%) |     2.2ns (+11%) | latin-4-chunk64  | - 4% |
| prettier-handle-comments |    1456 | 100.0% |       - |   1.9ns |    2.2ns (+12%) |    2.2ns (+14%) |     1.9ns (- 0%) | latin-16-chunk64 | - 0% |
| moment                   |   10796 | 100.0% |   0.07% |   1.9ns |    1.9ns (+ 1%) |    1.9ns (- 0%) |     1.9ns (+ 4%) | latin-8-chunk64  | - 0% |
| jquery                   |   16517 | 100.0% |   0.24% |   2.1ns |    2.2ns (+ 2%) |    1.9ns (-10%) |     2.0ns (- 8%) | latin-8-chunk64  | -10% |
| react-react.development  |    3117 | 100.0% |   0.32% |   2.3ns |    2.4ns (+ 4%) |    2.3ns (- 1%) |     2.2ns (- 2%) | latin-16-chunk64 | - 2% |
| core-errors              |     372 | 100.0% |   0.81% |   3.0ns |    2.9ns (- 4%) |    2.9ns (- 4%) |     2.9ns (- 3%) | latin-8-chunk64  | - 4% |
| prettier-core            |     817 | 100.0% |   0.86% |   2.5ns |    2.5ns (- 1%) |    2.7ns (+ 6%) |     2.8ns (+11%) | latin-4-chunk64  | - 1% |
| vue                      |   21172 | 100.0% |   0.89% |   2.5ns |    2.4ns (- 5%) |    2.5ns (- 2%) |     2.4ns (- 6%) | latin-16-chunk64 | - 6% |
| hono-types               |    7936 |  98.6% |       - |   2.3ns |    2.3ns (+ 0%) |    2.4ns (+ 2%) |     2.3ns (- 2%) | latin-16-chunk64 | - 2% |
| pdfjs-dist-pdf           |   39688 |  97.9% |   0.08% |   2.5ns |    2.4ns (- 1%) |    2.4ns (- 2%) |     2.4ns (- 2%) | latin-8-chunk64  | - 2% |
| lodash                   |   15794 |  83.4% |   1.50% |   3.6ns |    3.4ns (- 5%) |    3.4ns (- 6%) |     3.2ns (-11%) | latin-16-chunk64 | -11% |
| TypeScript-checker       |  121791 |  72.9% |   0.01% |   3.5ns |    3.1ns (-12%) |    3.1ns (-12%) |     3.0ns (-15%) | latin-16-chunk64 | -15% |
| RadixUIAdoptionSection   |     291 |  71.9% |   0.34% |   4.1ns |    3.7ns (- 9%) |    3.7ns (-11%) |     3.9ns (- 5%) | latin-8-chunk64  | -11% |
| excalidraw-App           |   17956 |  68.5% |   0.01% |   3.3ns |    2.6ns (-20%) |    2.6ns (-21%) |     3.1ns (- 6%) | latin-8-chunk64  | -21% |
| three                    |   84014 |  59.9% |   0.22% |   4.0ns |    4.2ns (+ 5%) |    3.7ns (- 7%) |     3.3ns (-17%) | latin-16-chunk64 | -17% |
| outline-Search           |     921 |  56.2% |       - |   4.4ns |    3.5ns (-21%) |    3.4ns (-23%) |     3.6ns (-19%) | latin-8-chunk64  | -23% |
| echarts                  |  182793 |   4.3% |   0.05% |   9.6ns |    7.7ns (-20%) |    6.1ns (-37%) |     3.7ns (-62%) | latin-16-chunk64 | -62% |
| victory                  |  121588 |   2.8% |   0.08% |   8.3ns |    6.3ns (-24%) |    5.2ns (-38%) |     3.9ns (-53%) | latin-16-chunk64 | -53% |
| d3                       |   53554 |   1.9% |   0.05% |   5.5ns |    6.4ns (+18%) |    4.1ns (-26%) |     3.2ns (-42%) | latin-16-chunk64 | -42% |
| antd                     |  291269 |   1.3% |   0.02% |  12.0ns |    9.1ns (-24%) |    8.1ns (-32%) |     6.6ns (-45%) | latin-16-chunk64 | -45% |
| typescript               |  461346 |   0.6% |   0.05% |  11.9ns |   10.1ns (-15%) |    8.2ns (-31%) |     5.6ns (-53%) | latin-16-chunk64 | -53% |
| terser-bundle.min        |   64495 |   0.2% |   0.17% |   8.3ns |    5.8ns (-30%) |    4.6ns (-45%) |     4.2ns (-49%) | latin-16-chunk64 | -49% |
| cal.com                  |   86205 |   0.1% |   0.00% |   9.8ns |    6.2ns (-36%) |    5.0ns (-49%) |     5.0ns (-49%) | latin-16-chunk64 | -49% |
| ------------------------ | ------- | ------ | ------- | ------- | --------------- | --------------- | ---------------- | ---------------- | ---- |
| Average                  |   64618 |  64.8% |   0.23% |   4.6ns |    4.0ns (-14%) |    3.5ns (-24%) |     3.2ns (-31%) | latin-16-chunk64 | -31% |

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
