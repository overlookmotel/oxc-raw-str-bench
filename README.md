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

Using latest `oxc-parser` from main branch after https://github.com/oxc-project/oxc/pull/20923.

On Mac Mini M4 Pro, 48 GB RAM:

100ms per fixture per version, minimum of best rounds.

- Timings are in nanoseconds per string.
- % changes are vs the baseline (1st column).
- strings column is number of strings in the fixture.
- ASCII column is % of source length which is before first non-ASCII byte.
  "100%" for files which are 100% ASCII.
- non-src column is % of strings which are outside the source region.
  "-" for files where all strings are in the source region.

| File                     | strings |  ASCII | non-src | current |       pr20834 |  pr20834-fnap | simpler-branch |  fromCharCode |         switch |       switch30 |         apply |       apply30 |         latin |       latin30 |       latin64 | latin-source64 | latin-4-chunk64 | latin-8-chunk64 | latin-16-chunk64 | fastest          |   by |
| ------------------------ | ------: | -----: | ------: | ------: | ------------: | ------------: | -------------: | ------------: | -------------: | -------------: | ------------: | ------------: | ------------: | ------------: | ------------: | -------------: | --------------: | --------------: | ---------------: | ---------------- | ---: |
| TypeScript-binder        |    8681 | 100.0% |       - |   2.1ns |  2.2ns (+ 5%) |  2.3ns (+ 6%) |   2.1ns (- 3%) |  1.9ns (-11%) |  5.9ns (+177%) |  6.4ns (+199%) |  2.0ns (- 8%) |  2.2ns (+ 5%) |  1.9ns (-12%) |  1.9ns (-11%) |  2.0ns (- 8%) |   2.0ns (- 7%) |    2.0ns (- 8%) |    2.0ns (- 5%) |     1.9ns (-11%) | latin            | -12% |
| next.js-index            |    1618 | 100.0% |       - |   2.3ns |  2.2ns (- 1%) |  2.8ns (+23%) |   2.2ns (- 1%) |  2.0ns (-14%) |  5.8ns (+155%) |  6.0ns (+165%) |  2.0ns (-10%) |  2.0ns (-12%) |  2.0ns (-12%) |  2.0ns (-11%) |  2.3ns (+ 3%) |   2.0ns (-12%) |    2.0ns (-13%) |    2.0ns (-13%) |     2.1ns (- 7%) | fromCharCode     | -14% |
| next.js-next             |     938 | 100.0% |       - |   2.2ns |  2.3ns (+ 4%) |  2.2ns (+ 0%) |   2.1ns (- 4%) |  1.9ns (-13%) |  5.9ns (+164%) |  5.9ns (+166%) |  2.0ns (- 9%) |  2.0ns (-12%) |  2.0ns (-12%) |  1.9ns (-13%) |  1.9ns (-12%) |   2.0ns (-12%) |    1.9ns (-12%) |    1.9ns (-12%) |     2.0ns (-12%) | fromCharCode     | -13% |
| prettier-handle-comments |    1297 | 100.0% |       - |   2.2ns |  2.2ns (- 0%) |  2.3ns (+ 4%) |   1.9ns (-10%) |  2.0ns (- 7%) |  5.9ns (+173%) |  5.7ns (+161%) |  1.9ns (-10%) |  2.1ns (- 3%) |  1.9ns (-12%) |  2.0ns (- 7%) |  2.0ns (-10%) |   1.9ns (-10%) |    2.0ns (- 9%) |    2.0ns (- 8%) |     1.9ns (-10%) | latin            | -12% |
| moment                   |    9044 | 100.0% |   0.09% |   2.3ns |  2.4ns (+ 4%) |  2.5ns (+ 9%) |   2.3ns (- 1%) |  2.2ns (- 6%) |  6.3ns (+173%) |  6.6ns (+184%) |  2.4ns (+ 5%) |  2.2ns (- 7%) |  2.0ns (-14%) |  1.9ns (-17%) |  2.0ns (-12%) |   2.2ns (- 6%) |    2.0ns (-16%) |    1.9ns (-17%) |     1.9ns (-17%) | latin30          | -17% |
| jquery                   |   14696 | 100.0% |   0.27% |   2.7ns |  2.8ns (+ 3%) |  2.8ns (+ 6%) |   2.4ns (- 9%) |  2.5ns (- 7%) |  9.1ns (+243%) |  8.9ns (+233%) |  2.3ns (-12%) |  2.5ns (- 6%) |  2.5ns (- 6%) |  2.5ns (- 8%) |  2.3ns (-14%) |   2.5ns (- 6%) |    2.0ns (-23%) |    2.1ns (-22%) |     2.1ns (-22%) | latin-4-chunk64  | -23% |
| react-react.development  |    2733 | 100.0% |   0.37% |   3.0ns |  2.8ns (- 5%) |  2.8ns (- 5%) |   2.5ns (-15%) |  2.5ns (-14%) |  6.1ns (+106%) |  6.0ns (+105%) |  2.6ns (-13%) |  2.5ns (-14%) |  2.5ns (-14%) |  2.5ns (-15%) |  2.4ns (-18%) |   2.6ns (-13%) |    2.3ns (-23%) |    2.4ns (-17%) |     2.4ns (-19%) | latin-4-chunk64  | -23% |
| core-errors              |     343 | 100.0% |   0.87% |   3.2ns |  3.2ns (- 2%) |  3.3ns (+ 0%) |   3.0ns (- 9%) |  3.0ns (- 8%) |   5.9ns (+81%) |   6.1ns (+88%) |  3.0ns (- 8%) |  3.0ns (- 7%) |  3.0ns (- 8%) |  3.0ns (- 9%) |  3.0ns (- 9%) |   3.0ns (- 8%) |    2.9ns (-10%) |    3.0ns (- 9%) |     3.0ns (- 8%) | latin-4-chunk64  | -10% |
| prettier-core            |     752 | 100.0% |   0.93% |   2.8ns |  2.8ns (- 3%) |  2.8ns (- 0%) |   2.5ns (-11%) |  2.5ns (-10%) |  6.3ns (+122%) |  6.1ns (+114%) |  2.5ns (-11%) |  2.6ns (- 9%) |  2.8ns (- 3%) |  2.5ns (-11%) |  2.6ns (- 8%) |   2.6ns (- 9%) |    2.5ns (-13%) |    2.7ns (- 4%) |     3.0ns (+ 5%) | latin-4-chunk64  | -13% |
| vue                      |   19091 | 100.0% |   0.99% |   3.2ns |  3.0ns (- 6%) |  3.0ns (- 6%) |   2.8ns (-12%) |  2.9ns (- 8%) | 10.6ns (+235%) | 10.2ns (+222%) |  2.7ns (-14%) |  2.7ns (-14%) |  2.8ns (-13%) |  2.6ns (-19%) |  2.5ns (-20%) |   2.7ns (-14%) |    2.5ns (-22%) |    2.5ns (-22%) |     2.5ns (-20%) | latin-8-chunk64  | -22% |
| hono-types               |    7901 |  98.6% |       - |  16.3ns | 17.4ns (+ 7%) |  2.9ns (-82%) |   2.6ns (-84%) |  2.6ns (-84%) |   6.6ns (-59%) |   6.9ns (-57%) |  2.6ns (-84%) |  2.5ns (-84%) |  2.5ns (-85%) |  2.4ns (-85%) |  2.4ns (-85%) |   2.5ns (-85%) |    2.4ns (-85%) |    2.4ns (-85%) |     2.4ns (-85%) | latin64          | -85% |
| pdfjs-dist-pdf           |   34823 |  97.9% |   0.09% |  35.1ns | 38.1ns (+ 8%) |  3.6ns (-90%) |   3.3ns (-91%) |  3.3ns (-91%) |  11.3ns (-68%) |  11.2ns (-68%) |  3.2ns (-91%) |  3.0ns (-91%) |  3.2ns (-91%) |  2.7ns (-92%) |  2.6ns (-93%) |   2.5ns (-93%) |    2.5ns (-93%) |    2.5ns (-93%) |     2.5ns (-93%) | latin-4-chunk64  | -93% |
| lodash                   |   14084 |  83.4% |   1.68% |  30.8ns | 34.1ns (+11%) |  9.5ns (-69%) |   9.1ns (-70%) |  9.0ns (-71%) |  12.3ns (-60%) |  10.3ns (-66%) |  8.2ns (-73%) |  7.0ns (-77%) |  6.3ns (-80%) |  3.8ns (-88%) |  4.1ns (-87%) |   3.9ns (-87%) |    3.5ns (-89%) |    3.6ns (-88%) |     3.4ns (-89%) | latin-16-chunk64 | -89% |
| TypeScript-checker       |  119352 |  72.9% |   0.01% |  44.2ns | 50.0ns (+13%) | 14.5ns (-67%) |  14.3ns (-68%) | 14.4ns (-67%) |  22.5ns (-49%) |  16.8ns (-62%) | 13.9ns (-69%) |  9.6ns (-78%) | 12.8ns (-71%) |  4.5ns (-90%) |  3.8ns (-91%) |   4.7ns (-89%) |    3.1ns (-93%) |    2.9ns (-93%) |     3.1ns (-93%) | latin-8-chunk64  | -93% |
| RadixUIAdoptionSection   |     210 |  71.9% |   0.48% |  26.5ns | 26.1ns (- 1%) |  6.8ns (-74%) |   6.6ns (-75%) |  6.5ns (-76%) |   9.5ns (-64%) |   8.5ns (-68%) |  6.6ns (-75%) |  5.8ns (-78%) |  5.4ns (-80%) |  4.1ns (-84%) |  4.0ns (-85%) |   4.0ns (-85%) |    3.5ns (-87%) |    3.6ns (-86%) |     3.6ns (-86%) | latin-4-chunk64  | -87% |
| excalidraw-App           |   16992 |  68.5% |   0.01% |  42.0ns | 46.8ns (+11%) | 15.1ns (-64%) |  14.5ns (-65%) | 14.4ns (-66%) |  17.9ns (-57%) |  10.8ns (-74%) | 14.0ns (-67%) |  9.1ns (-78%) | 11.9ns (-72%) |  3.7ns (-91%) |  3.7ns (-91%) |   4.1ns (-90%) |    2.7ns (-94%) |    2.7ns (-93%) |     3.1ns (-93%) | latin-4-chunk64  | -94% |
| three                    |   74857 |  59.9% |   0.25% |  31.0ns | 34.7ns (+12%) | 16.5ns (-47%) |  16.5ns (-47%) | 16.4ns (-47%) |  21.3ns (-31%) |  15.8ns (-49%) | 15.4ns (-50%) | 11.4ns (-63%) | 11.9ns (-62%) |  4.6ns (-85%) |  4.1ns (-87%) |   4.5ns (-85%) |    3.9ns (-87%) |    3.6ns (-88%) |     3.3ns (-89%) | latin-16-chunk64 | -89% |
| outline-Search           |     798 |  56.2% |       - |  40.2ns | 45.5ns (+13%) | 17.5ns (-57%) |  16.8ns (-58%) | 17.3ns (-57%) |  18.4ns (-54%) |  11.4ns (-72%) | 16.4ns (-59%) | 10.5ns (-74%) | 13.5ns (-67%) |  5.1ns (-87%) |  4.9ns (-88%) |   4.7ns (-88%) |    3.6ns (-91%) |    3.5ns (-91%) |     3.7ns (-91%) | latin-8-chunk64  | -91% |
| echarts                  |  161227 |   4.3% |   0.05% |  31.8ns | 38.1ns (+20%) | 37.7ns (+19%) |  38.2ns (+20%) | 37.7ns (+19%) |  35.5ns (+12%) |  22.0ns (-31%) | 35.1ns (+10%) | 25.2ns (-21%) | 28.7ns (-10%) | 10.4ns (-67%) | 11.0ns (-65%) |  11.0ns (-65%) |    7.8ns (-75%) |    6.0ns (-81%) |     3.9ns (-88%) | latin-16-chunk64 | -88% |
| victory                  |  103377 |   2.8% |   0.10% |  38.6ns | 38.7ns (+ 0%) | 38.9ns (+ 1%) |  38.0ns (- 2%) | 37.2ns (- 4%) |  36.5ns (- 5%) |  24.8ns (-36%) | 36.0ns (- 7%) | 27.4ns (-29%) | 29.7ns (-23%) | 13.7ns (-64%) |  9.5ns (-75%) |  10.7ns (-72%) |    5.8ns (-85%) |    4.9ns (-87%) |     3.9ns (-90%) | latin-16-chunk64 | -90% |
| d3                       |   47207 |   1.9% |   0.06% |  20.3ns | 22.6ns (+11%) | 22.6ns (+11%) |  22.6ns (+11%) | 22.0ns (+ 8%) |  20.5ns (+ 1%) |  16.2ns (-20%) | 22.8ns (+12%) | 19.3ns (- 5%) | 13.5ns (-33%) |  6.7ns (-67%) |  5.5ns (-73%) |   6.7ns (-67%) |    6.6ns (-68%) |    4.4ns (-78%) |     3.2ns (-84%) | latin-16-chunk64 | -84% |
| antd                     |  230650 |   1.3% |   0.03% |  44.1ns | 44.7ns (+ 1%) | 45.0ns (+ 2%) |  44.8ns (+ 1%) | 43.6ns (- 1%) |  42.4ns (- 4%) |  28.0ns (-36%) | 42.1ns (- 5%) | 30.2ns (-31%) | 37.9ns (-14%) | 18.5ns (-58%) | 12.8ns (-71%) |  12.6ns (-71%) |    9.1ns (-79%) |    7.6ns (-83%) |     6.3ns (-86%) | latin-16-chunk64 | -86% |
| typescript               |  405969 |   0.6% |   0.06% |  40.5ns | 44.4ns (+10%) | 45.9ns (+13%) |  45.7ns (+13%) | 45.4ns (+12%) |  44.2ns (+ 9%) |  26.9ns (-34%) | 44.1ns (+ 9%) | 28.5ns (-30%) | 38.5ns (- 5%) | 14.9ns (-63%) | 13.9ns (-66%) |  13.9ns (-66%) |   10.4ns (-74%) |    8.4ns (-79%) |     5.7ns (-86%) | latin-16-chunk64 | -86% |
| terser-bundle.min        |   52283 |   0.2% |   0.21% |  32.8ns | 38.1ns (+16%) | 38.0ns (+16%) |  37.5ns (+14%) | 37.1ns (+13%) |  35.6ns (+ 8%) |  21.0ns (-36%) | 36.8ns (+12%) | 24.9ns (-24%) | 28.6ns (-13%) |  8.7ns (-73%) |  7.2ns (-78%) |   9.2ns (-72%) |    5.7ns (-83%) |    4.9ns (-85%) |     4.0ns (-88%) | latin-16-chunk64 | -88% |
| cal.com                  |   72373 |   0.1% |   0.00% |  41.0ns | 45.8ns (+12%) | 46.3ns (+13%) |  45.5ns (+11%) | 46.2ns (+13%) |  42.4ns (+ 4%) |  24.9ns (-39%) | 43.2ns (+ 5%) | 29.2ns (-29%) | 37.0ns (-10%) | 11.3ns (-72%) | 10.1ns (-75%) |  10.6ns (-74%) |    6.4ns (-84%) |    5.2ns (-87%) |     4.6ns (-89%) | latin-16-chunk64 | -89% |
| ------------------------ | ------- | ------ | ------- | ------- | ------------- | ------------- | -------------- | ------------- | -------------- | -------------- | ------------- | ------------- | ------------- | ------------- | ------------- | -------------- | --------------- | --------------- | ---------------- | ---------------- | ---- |
| Average                  |   56052 |  64.8% |   0.26% |  21.6ns | 23.6ns (+ 9%) | 15.5ns (-28%) |  15.2ns (-30%) | 15.1ns (-30%) |  17.8ns (-18%) |  12.9ns (-40%) | 14.6ns (-33%) | 10.7ns (-51%) | 12.2ns (-44%) |  5.5ns (-75%) |  4.9ns (-77%) |   5.2ns (-76%) |    4.0ns (-82%) |    3.6ns (-84%) |     3.2ns (-85%) | latin-16-chunk64 | -85% |

### `apply30` vs `switch30`

| File                     | strings |  ASCII | non-src | apply30 |       switch30 | fastest  |   by |
| ------------------------ | ------: | -----: | ------: | ------: | -------------: | -------- | ---: |
| TypeScript-binder        |    8681 | 100.0% |       - |   2.0ns |  6.4ns (+222%) | apply30  |      |
| next.js-index            |    1618 | 100.0% |       - |   1.9ns |  6.0ns (+212%) | apply30  |      |
| next.js-next             |     938 | 100.0% |       - |   1.9ns |  5.7ns (+192%) | apply30  |      |
| prettier-handle-comments |    1297 | 100.0% |       - |   1.9ns |  5.7ns (+203%) | apply30  |      |
| moment                   |    9044 | 100.0% |   0.09% |   2.0ns |  6.4ns (+218%) | apply30  |      |
| jquery                   |   14696 | 100.0% |   0.27% |   2.3ns |  8.5ns (+265%) | apply30  |      |
| react-react.development  |    2733 | 100.0% |   0.37% |   2.5ns |  6.1ns (+144%) | apply30  |      |
| core-errors              |     343 | 100.0% |   0.87% |   2.9ns |  5.8ns (+100%) | apply30  |      |
| prettier-core            |     752 | 100.0% |   0.93% |   2.6ns |  6.2ns (+142%) | apply30  |      |
| vue                      |   19091 | 100.0% |   0.99% |   2.7ns |  9.8ns (+268%) | apply30  |      |
| hono-types               |    7901 |  98.6% |       - |   2.4ns |  6.7ns (+177%) | apply30  |      |
| pdfjs-dist-pdf           |   34823 |  97.9% |   0.09% |   3.0ns | 11.4ns (+286%) | apply30  |      |
| lodash                   |   14084 |  83.4% |   1.68% |   6.6ns |  11.0ns (+67%) | apply30  |      |
| TypeScript-checker       |  119352 |  72.9% |   0.01% |   9.0ns |  16.5ns (+83%) | apply30  |      |
| RadixUIAdoptionSection   |     210 |  71.9% |   0.48% |   5.7ns |   8.5ns (+49%) | apply30  |      |
| excalidraw-App           |   16992 |  68.5% |   0.01% |   8.7ns |  11.1ns (+27%) | apply30  |      |
| three                    |   74857 |  59.9% |   0.25% |  11.1ns |  15.4ns (+39%) | apply30  |      |
| outline-Search           |     798 |  56.2% |       - |  10.0ns |  11.3ns (+13%) | apply30  |      |
| echarts                  |  161227 |   4.3% |   0.05% |  22.2ns |  21.1ns (- 5%) | switch30 | - 5% |
| victory                  |  103377 |   2.8% |   0.10% |  25.7ns |  23.3ns (- 9%) | switch30 | - 9% |
| d3                       |   47207 |   1.9% |   0.06% |  18.2ns |  15.4ns (-15%) | switch30 | -15% |
| antd                     |  230650 |   1.3% |   0.03% |  29.6ns |  27.9ns (- 6%) | switch30 | - 6% |
| typescript               |  405969 |   0.6% |   0.06% |  28.0ns |  25.1ns (-10%) | switch30 | -10% |
| terser-bundle.min        |   52283 |   0.2% |   0.21% |  23.5ns |  20.2ns (-14%) | switch30 | -14% |
| cal.com                  |   72373 |   0.1% |   0.00% |  26.9ns |  24.1ns (-11%) | switch30 | -11% |
| ------------------------ | ------- | ------ | ------- | ------- | -------------- | -------- | ---- |
| Average                  |   56052 |  64.8% |   0.26% |  10.1ns |  12.6ns (+25%) | apply30  |      |

### `apply30` vs `latin*` vs `latin-source64`

| File                     | strings |  ASCII | non-src | apply30 |       latin30 |       latin64 | latin-source64 | fastest        |   by |
| ------------------------ | ------: | -----: | ------: | ------: | ------------: | ------------: | -------------: | -------------- | ---: |
| TypeScript-binder        |    8681 | 100.0% |       - |   2.0ns |  1.8ns (- 6%) |  2.1ns (+ 6%) |   2.1ns (+ 6%) | latin30        | - 6% |
| next.js-index            |    1618 | 100.0% |       - |   1.9ns |  2.0ns (+ 2%) |  2.0ns (+ 2%) |   2.0ns (+ 5%) | apply30        |      |
| next.js-next             |     938 | 100.0% |       - |   1.9ns |  2.2ns (+13%) |  1.9ns (+ 0%) |   2.0ns (+ 5%) | apply30        |      |
| prettier-handle-comments |    1297 | 100.0% |       - |   2.0ns |  2.2ns (+14%) |  1.9ns (- 3%) |   1.8ns (- 8%) | latin-source64 | - 8% |
| moment                   |    9044 | 100.0% |   0.09% |   2.1ns |  2.1ns (- 0%) |  1.8ns (-12%) |   2.1ns (- 0%) | latin64        | -12% |
| jquery                   |   14696 | 100.0% |   0.27% |   2.4ns |  2.3ns (- 5%) |  2.3ns (- 5%) |   2.3ns (- 5%) | latin-source64 | - 5% |
| react-react.development  |    2733 | 100.0% |   0.37% |   2.5ns |  2.6ns (+ 1%) |  2.4ns (- 7%) |   2.4ns (- 7%) | latin-source64 | - 7% |
| core-errors              |     343 | 100.0% |   0.87% |   2.9ns |  2.9ns (- 0%) |  2.9ns (+ 2%) |   2.9ns (- 0%) | latin-source64 | - 0% |
| prettier-core            |     752 | 100.0% |   0.93% |   2.6ns |  2.5ns (- 5%) |  2.5ns (- 4%) |   2.6ns (+ 0%) | latin30        | - 5% |
| vue                      |   19091 | 100.0% |   0.99% |   2.7ns |  2.5ns (- 5%) |  2.5ns (- 6%) |   2.7ns (+ 0%) | latin64        | - 6% |
| hono-types               |    7901 |  98.6% |       - |   2.5ns |  2.5ns (- 1%) |  2.4ns (- 2%) |   2.3ns (- 9%) | latin-source64 | - 9% |
| pdfjs-dist-pdf           |   34823 |  97.9% |   0.09% |   3.0ns |  2.7ns (-12%) |  2.6ns (-13%) |   2.4ns (-19%) | latin-source64 | -19% |
| lodash                   |   14084 |  83.4% |   1.68% |   6.7ns |  3.6ns (-46%) |  3.8ns (-42%) |   3.8ns (-43%) | latin30        | -46% |
| TypeScript-checker       |  119352 |  72.9% |   0.01% |   9.2ns |  4.4ns (-53%) |  3.7ns (-60%) |   4.4ns (-52%) | latin64        | -60% |
| RadixUIAdoptionSection   |     210 |  71.9% |   0.48% |   5.8ns |  4.0ns (-31%) |  3.9ns (-32%) |   4.0ns (-31%) | latin64        | -32% |
| excalidraw-App           |   16992 |  68.5% |   0.01% |   9.1ns |  3.7ns (-59%) |  3.5ns (-61%) |   3.5ns (-61%) | latin-source64 | -61% |
| three                    |   74857 |  59.9% |   0.25% |  11.4ns |  4.3ns (-62%) |  4.2ns (-63%) |   4.6ns (-60%) | latin64        | -63% |
| outline-Search           |     798 |  56.2% |       - |  10.1ns |  4.8ns (-53%) |  4.5ns (-55%) |   4.6ns (-55%) | latin64        | -55% |
| echarts                  |  161227 |   4.3% |   0.05% |  22.8ns | 10.2ns (-55%) | 10.2ns (-55%) |  10.2ns (-55%) | latin30        | -55% |
| victory                  |  103377 |   2.8% |   0.10% |  26.4ns | 13.1ns (-51%) |  8.7ns (-67%) |   9.2ns (-65%) | latin64        | -67% |
| d3                       |   47207 |   1.9% |   0.06% |  19.0ns |  5.6ns (-70%) |  5.4ns (-72%) |   7.6ns (-60%) | latin64        | -72% |
| antd                     |  230650 |   1.3% |   0.03% |  30.9ns | 18.7ns (-39%) | 12.4ns (-60%) |  13.7ns (-56%) | latin64        | -60% |
| typescript               |  405969 |   0.6% |   0.06% |  28.0ns | 15.3ns (-45%) | 12.2ns (-56%) |  12.7ns (-55%) | latin64        | -56% |
| terser-bundle.min        |   52283 |   0.2% |   0.21% |  24.0ns |  7.2ns (-70%) |  6.9ns (-71%) |   8.7ns (-64%) | latin64        | -71% |
| cal.com                  |   72373 |   0.1% |   0.00% |  27.5ns | 11.1ns (-59%) |  9.1ns (-67%) |   9.8ns (-64%) | latin64        | -67% |
| ------------------------ | ------- | ------ | ------- | ------- | ------------- | ------------- | -------------- | -------------- | ---- |
| Average                  |   56052 |  64.8% |   0.26% |  10.4ns |  5.4ns (-48%) |  4.6ns (-55%) |   5.0ns (-52%) | latin64        | -55% |

### `latin64` vs `latin-4-chunk64` vs `latin-8-chunk64` vs `latin-16-chunk64`

| File                     | strings |  ASCII | non-src | latin64 | latin-4-chunk64 | latin-8-chunk64 | latin-16-chunk64 | fastest          |   by |
| ------------------------ | ------: | -----: | ------: | ------: | --------------: | --------------: | ---------------: | ---------------- | ---: |
| TypeScript-binder        |    8681 | 100.0% |       - |   1.8ns |    2.0ns (+12%) |    2.0ns (+ 9%) |     2.3ns (+25%) | latin64          |      |
| next.js-index            |    1618 | 100.0% |       - |   2.2ns |    2.3ns (+ 5%) |    2.0ns (-11%) |     2.0ns (-10%) | latin-8-chunk64  | -11% |
| next.js-next             |     938 | 100.0% |       - |   2.0ns |    1.9ns (- 0%) |    2.0ns (+ 2%) |     2.0ns (+ 1%) | latin-4-chunk64  | - 0% |
| prettier-handle-comments |    1297 | 100.0% |       - |   2.0ns |    2.0ns (- 0%) |    1.9ns (- 1%) |     2.0ns (- 0%) | latin-8-chunk64  | - 1% |
| moment                   |    9044 | 100.0% |   0.09% |   1.8ns |    1.9ns (+ 1%) |    2.0ns (+ 9%) |     2.0ns (+ 7%) | latin64          |      |
| jquery                   |   14696 | 100.0% |   0.27% |   2.0ns |    2.1ns (+ 7%) |    2.1ns (+ 4%) |     2.1ns (+ 2%) | latin64          |      |
| react-react.development  |    2733 | 100.0% |   0.37% |   2.4ns |    2.3ns (- 1%) |    2.3ns (- 3%) |     2.4ns (+ 2%) | latin-8-chunk64  | - 3% |
| core-errors              |     343 | 100.0% |   0.87% |   3.0ns |    2.9ns (- 4%) |    2.9ns (- 4%) |     3.0ns (- 1%) | latin-8-chunk64  | - 4% |
| prettier-core            |     752 | 100.0% |   0.93% |   2.5ns |    2.5ns (+ 1%) |    2.7ns (+11%) |     2.9ns (+18%) | latin64          |      |
| vue                      |   19091 | 100.0% |   0.99% |   2.5ns |    2.4ns (- 4%) |    2.5ns (- 1%) |     2.5ns (- 2%) | latin-4-chunk64  | - 4% |
| hono-types               |    7901 |  98.6% |       - |   2.4ns |    2.4ns (- 2%) |    2.4ns (- 2%) |     2.4ns (- 1%) | latin-4-chunk64  | - 2% |
| pdfjs-dist-pdf           |   34823 |  97.9% |   0.09% |   2.6ns |    2.4ns (- 5%) |    2.5ns (- 4%) |     2.4ns (- 5%) | latin-4-chunk64  | - 5% |
| lodash                   |   14084 |  83.4% |   1.68% |   3.7ns |    3.5ns (- 5%) |    3.6ns (- 3%) |     3.3ns (- 9%) | latin-16-chunk64 | - 9% |
| TypeScript-checker       |  119352 |  72.9% |   0.01% |   3.8ns |    3.1ns (-19%) |    2.9ns (-25%) |     3.1ns (-19%) | latin-8-chunk64  | -25% |
| RadixUIAdoptionSection   |     210 |  71.9% |   0.48% |   3.8ns |    3.6ns (- 5%) |    3.6ns (- 5%) |     3.5ns (- 6%) | latin-16-chunk64 | - 6% |
| excalidraw-App           |   16992 |  68.5% |   0.01% |   3.5ns |    2.7ns (-22%) |    2.8ns (-19%) |     3.1ns (-12%) | latin-4-chunk64  | -22% |
| three                    |   74857 |  59.9% |   0.25% |   5.0ns |    4.0ns (-20%) |    3.6ns (-28%) |     3.3ns (-34%) | latin-16-chunk64 | -34% |
| outline-Search           |     798 |  56.2% |       - |   4.5ns |    3.5ns (-22%) |    3.5ns (-23%) |     3.7ns (-18%) | latin-8-chunk64  | -23% |
| echarts                  |  161227 |   4.3% |   0.05% |  10.3ns |    7.6ns (-26%) |    5.9ns (-43%) |     3.7ns (-64%) | latin-16-chunk64 | -64% |
| victory                  |  103377 |   2.8% |   0.10% |   9.1ns |    5.7ns (-37%) |    4.5ns (-50%) |     3.9ns (-57%) | latin-16-chunk64 | -57% |
| d3                       |   47207 |   1.9% |   0.06% |   6.3ns |    6.3ns (- 0%) |    4.3ns (-32%) |     3.2ns (-50%) | latin-16-chunk64 | -50% |
| antd                     |  230650 |   1.3% |   0.03% |  12.4ns |    9.3ns (-25%) |    8.1ns (-35%) |     6.3ns (-49%) | latin-16-chunk64 | -49% |
| typescript               |  405969 |   0.6% |   0.06% |  12.4ns |   10.5ns (-16%) |    8.4ns (-33%) |     5.7ns (-54%) | latin-16-chunk64 | -54% |
| terser-bundle.min        |   52283 |   0.2% |   0.21% |   6.7ns |    6.1ns (- 8%) |    5.0ns (-25%) |     4.0ns (-40%) | latin-16-chunk64 | -40% |
| cal.com                  |   72373 |   0.1% |   0.00% |   9.0ns |    6.2ns (-31%) |    6.2ns (-32%) |     4.6ns (-49%) | latin-16-chunk64 | -49% |
| ------------------------ | ------- | ------ | ------- | ------- | --------------- | --------------- | ---------------- | ---------------- | ---- |
| Average                  |   56052 |  64.8% |   0.26% |   4.7ns |    4.0ns (-16%) |    3.6ns (-24%) |     3.2ns (-33%) | latin-16-chunk64 | -33% |

## Adding a new version

To add a new `deserializeStr` implementation to the benchmark, create a `.mjs` file in the `versions` directory.

The file should export two functions:

- `deserializeStr(pos)` - the implementation to benchmark.
- `setup()` - called once after state is injected for each fixture. Use this for
  any per-fixture initialization (e.g. computing `firstNonAsciiPos`). Can be a no-op.

The bench script wraps each version file with boilerplate that provides the following variables,
available as globals within the version file:

| Variable / function | Type           | Description                                       |
| ------------------- | -------------- | ------------------------------------------------- |
| `uint8`             | `Uint8Array`   | The combined buffer (source + strData + strBin)   |
| `uint32`            | `Uint32Array`  | `Uint32Array` view over `uint8`'s backing buffer  |
| `float64`           | `Float64Array` | `Float64Array` view over `uint8`'s backing buffer |
| `sourceText`        | `string`       | The source text as a JS string                    |
| `sourceIsAscii`     | `boolean`      | `true` if source is pure ASCII                    |
| `sourceStartPos`    | `number`       | Start of source region in buffer                  |
| `sourceEndPos`      | `number`       | End of source region in buffer                    |
| `sourceByteLen`     | `number`       | Byte length of source text                        |

`deserializeStr(pos)` receives a byte offset into the buffer.
The string descriptor at that offset contains two `uint32` values the function needs to read:

- `uint32[pos >> 2]` - byte offset of the string's UTF-8 data in the buffer
- `uint32[(pos >> 2) + 2]` - byte length of the string (UTF-8 bytes)

See `versions/current.mjs` for the baseline implementation.

## Filtering

While working on different versions, you can alter which versions are benchmarked by:

- Benchmark only some versions: Add them to `FILTER` in `bench.ts`.
- Change the baseline version: Alter `BASELINE` in `bench.ts`.

## Inspecting assembly for versions

To get the assembly that TurboFan produces for a version:

```bash
pnpm asm <version-name> > dump.txt
```

The output is verbose, but Claude Code seems to be good at analyzing it. Presumably other AIs will be too.

## Files

- `construct.ts` - Downloads source files, patches `oxc-parser`'s deserializer for instrumentation,
  captures `deserializeStr` calls, produces fixture data.
- `verify.ts` - Validates that the fixture data produces the correct strings,
  and all `deserializeStr` implementations produce the correct strings.
- `bench.ts` - Benchmarks multiple `deserializeStr` implementations.
- `urls.json` - URLs of benchmark source files.
- `versions` directory - `deserializeStr` implementations to benchmark.
- `fixtures` directory - Captured data per benchmark file.
