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
- `latin-slice64` - `latin-source64` but using `Buffer.prototype.latin1Slice` instead of `TextDecoder("latin1")`
- `latin-slice-onebyte64` - `latin-slice64` with fast path slicing from `sourceTextLatin` instead of `sourceText`
- `utf8-slice64` - `latin-slice-onebyte64`, but also using `Buffer.prototype.utf8Slice` instead of `TextDecoder`
  for decoding UTF-8.
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
- `latin-slice64` is no faster for decoding than `latin-source64`, but initial decoding of the buffer to latin string
  is likely much faster.
- `latin-slice-onebyte64` is no faster than `latin-source64` or `latin-slice64`, but may have advantages in downstream
  code which consumes the strings, as it will produce `ONE_BYTE` strings consistently for e.g. identifiers,
  where slices of `sourceText` would produce a mix of `ONE_BYTE` and `TWO_BYTE` strings, depending on if source contains
  non-ASCII bytes. The greater consistency may help V8 to optimize code that operates on strings
  e.g. `ident.name === "React"`.

### Benchmark results

Using latest `oxc-parser` from main branch after https://github.com/oxc-project/oxc/pull/20923.

On Mac Mini M4 Pro, 48 GB RAM:

1000ms per fixture per version, minimum of best rounds.

- Timings are in nanoseconds per string.
- % changes are vs the baseline (1st column).
- strings column is number of strings in the fixture.
- ASCII column is % of source length which is before first non-ASCII byte.
  "100%" for files which are 100% ASCII.
- non-src column is % of strings which are outside the source region.
  "-" for files where all strings are in the source region.
- unicode column is % of strings containing at least one non-ASCII byte.
  "-" for files where all strings are ASCII.

| File                     | strings |  ASCII | non-src | unicode | current |       pr20834 |  pr20834-fnap | simpler-branch |  fromCharCode |        switch |      switch30 |         apply |       apply30 |         latin |       latin30 |       latin64 | latin-source64 | latin-slice64 | latin-slice-onebyte64 |  utf8-slice64 | latin-4-chunk64 | latin-8-chunk64 | latin-16-chunk64 | fastest               |   by |
| ------------------------ | ------: | -----: | ------: | ------: | ------: | ------------: | ------------: | -------------: | ------------: | ------------: | ------------: | ------------: | ------------: | ------------: | ------------: | ------------: | -------------: | ------------: | --------------------: | ------------: | --------------: | --------------: | ---------------: | --------------------- | ---: |
| TypeScript-binder        |    8681 | 100.0% |       - |       - |   2.0ns |  2.0ns (- 0%) |  2.0ns (- 0%) |   1.8ns (-12%) |  1.8ns (-10%) | 5.7ns (+184%) | 6.2ns (+206%) |  1.8ns (-11%) |  1.8ns (-11%) |  1.8ns (-11%) |  1.8ns (-12%) |  1.8ns (-10%) |   1.8ns (-10%) |  1.8ns (- 9%) |          1.8ns (-11%) |  1.8ns (-11%) |    1.8ns (-12%) |    1.8ns (-10%) |     1.8ns (-11%) | simpler-branch        | -12% |
| next.js-index            |    1618 | 100.0% |       - |       - |   2.2ns |  2.1ns (- 1%) |  2.1ns (- 2%) |   1.9ns (-13%) |  1.9ns (-13%) | 5.9ns (+172%) | 5.9ns (+171%) |  1.9ns (-11%) |  1.9ns (-11%) |  1.9ns (-13%) |  1.9ns (-11%) |  1.9ns (-12%) |   1.9ns (-13%) |  1.9ns (-12%) |          1.9ns (-13%) |  1.9ns (-12%) |    1.9ns (-13%) |    2.0ns (- 8%) |     1.9ns (-13%) | latin-16-chunk64      | -13% |
| next.js-next             |     938 | 100.0% |       - |       - |   2.1ns |  2.2ns (+ 3%) |  2.1ns (+ 1%) |   2.0ns (- 5%) |  1.9ns (-11%) | 5.5ns (+158%) | 5.8ns (+175%) |  1.9ns (-10%) |  1.9ns (-11%) |  1.9ns (-10%) |  1.9ns (-11%) |  1.9ns (-12%) |   1.9ns (-11%) |  1.9ns (-11%) |          1.9ns (-10%) |  1.9ns (-11%) |    1.9ns (-10%) |    1.9ns (-10%) |     1.9ns (-11%) | latin64               | -12% |
| prettier-handle-comments |    1297 | 100.0% |       - |       - |   2.2ns |  2.2ns (+ 0%) |  2.1ns (- 1%) |   1.9ns (-12%) |  1.9ns (-13%) | 5.5ns (+153%) | 5.8ns (+167%) |  1.9ns (-11%) |  1.9ns (-13%) |  1.9ns (-12%) |  1.9ns (-12%) |  1.9ns (-12%) |   1.9ns (-12%) |  1.9ns (-11%) |          1.9ns (-13%) |  1.9ns (-11%) |    1.9ns (-12%) |    1.9ns (-11%) |     1.9ns (-11%) | latin-slice-onebyte64 | -13% |
| moment                   |    9044 | 100.0% |   0.09% |       - |   2.2ns |  2.3ns (+ 8%) |  2.4ns (+ 9%) |   2.2ns (+ 1%) |  2.1ns (- 2%) | 6.9ns (+218%) | 6.2ns (+189%) |  2.3ns (+ 5%) |  2.0ns (- 8%) |  1.9ns (-10%) |  1.8ns (-15%) |  1.9ns (-14%) |   2.0ns (- 8%) |  2.0ns (- 9%) |          2.0ns (- 8%) |  2.0ns (-10%) |    1.9ns (-12%) |    1.9ns (-12%) |     1.9ns (-12%) | latin30               | -15% |
| jquery                   |   14696 | 100.0% |   0.27% |  0.007% |   2.6ns |  2.6ns (+ 0%) |  2.6ns (+ 2%) |   2.4ns (- 7%) |  2.4ns (- 8%) | 8.6ns (+235%) | 8.1ns (+215%) |  2.4ns (- 7%) |  2.4ns (- 8%) |  2.4ns (- 8%) |  2.3ns (-12%) |  2.0ns (-21%) |   2.4ns (- 7%) |  2.4ns (- 8%) |          2.3ns (- 9%) |  2.3ns (-10%) |    2.0ns (-21%) |    2.0ns (-20%) |     2.0ns (-20%) | latin-4-chunk64       | -21% |
| react-react.development  |    2733 | 100.0% |   0.37% |       - |   2.9ns |  2.7ns (- 5%) |  2.8ns (- 4%) |   2.5ns (-14%) |  2.5ns (-13%) | 6.1ns (+112%) | 6.1ns (+113%) |  2.5ns (-12%) |  2.5ns (-11%) |  2.6ns (-11%) |  2.5ns (-14%) |  2.3ns (-20%) |   2.4ns (-18%) |  2.3ns (-19%) |          2.4ns (-17%) |  2.4ns (-17%) |    2.3ns (-21%) |    2.3ns (-19%) |     2.3ns (-21%) | latin-4-chunk64       | -21% |
| core-errors              |     343 | 100.0% |   0.87% |       - |   3.2ns |  3.2ns (+ 1%) |  3.2ns (- 0%) |   2.9ns (- 8%) |  2.9ns (- 8%) |  5.9ns (+86%) |  6.0ns (+91%) |  2.9ns (- 7%) |  2.9ns (- 7%) |  3.0ns (- 7%) |  2.9ns (- 8%) |  2.9ns (- 8%) |   2.9ns (- 8%) |  3.0ns (- 7%) |          2.9ns (- 8%) |  2.7ns (-15%) |    2.9ns (- 7%) |    2.9ns (- 8%) |     2.9ns (- 8%) | utf8-slice64          | -15% |
| prettier-core            |     752 | 100.0% |   0.93% |  0.133% |   2.7ns |  2.8ns (+ 1%) |  2.8ns (+ 2%) |   2.5ns (- 9%) |  2.5ns (- 9%) | 6.0ns (+120%) | 6.0ns (+121%) |  2.5ns (- 7%) |  2.5ns (- 7%) |  2.5ns (- 8%) |  2.5ns (-10%) |  2.5ns (- 7%) |   2.5ns (- 8%) |  2.5ns (- 8%) |          2.5ns (- 8%) |  2.5ns (- 7%) |    2.5ns (- 9%) |    2.7ns (- 2%) |     2.9ns (+ 7%) | latin30               | -10% |
| vue                      |   19091 | 100.0% |   0.99% |       - |   3.1ns |  3.0ns (- 4%) |  3.0ns (- 4%) |   2.8ns (-10%) |  2.8ns (-11%) | 9.2ns (+195%) | 9.4ns (+203%) |  2.8ns (-11%) |  2.7ns (-13%) |  2.8ns (-11%) |  2.6ns (-18%) |  2.5ns (-18%) |   2.7ns (-13%) |  2.7ns (-14%) |          2.7ns (-13%) |  2.7ns (-15%) |    2.5ns (-21%) |    2.5ns (-21%) |     2.5ns (-20%) | latin-4-chunk64       | -21% |
| hono-types               |    7901 |  98.6% |       - |       - |  16.5ns | 17.0ns (+ 3%) |  2.8ns (-83%) |   2.6ns (-84%) |  2.6ns (-84%) |  6.5ns (-61%) |  6.6ns (-60%) |  2.5ns (-85%) |  2.5ns (-85%) |  2.5ns (-85%) |  2.4ns (-85%) |  2.4ns (-85%) |   2.4ns (-86%) |  2.3ns (-86%) |          2.3ns (-86%) |  2.3ns (-86%) |    2.4ns (-85%) |    2.4ns (-86%) |     2.4ns (-85%) | utf8-slice64          | -86% |
| pdfjs-dist-pdf           |   34823 |  97.9% |   0.09% |  0.029% |  35.0ns | 38.1ns (+ 9%) |  3.6ns (-90%) |   3.3ns (-91%) |  3.3ns (-90%) | 11.4ns (-68%) | 11.2ns (-68%) |  3.3ns (-91%) |  3.0ns (-91%) |  3.2ns (-91%) |  2.7ns (-92%) |  2.6ns (-93%) |   2.5ns (-93%) |  2.5ns (-93%) |          2.5ns (-93%) |  2.5ns (-93%) |    2.4ns (-93%) |    2.5ns (-93%) |     2.5ns (-93%) | latin-4-chunk64       | -93% |
| lodash                   |   14084 |  83.4% |   1.68% |  1.370% |  30.6ns | 34.2ns (+12%) |  9.4ns (-69%) |   9.1ns (-70%) |  9.1ns (-70%) | 12.2ns (-60%) | 10.3ns (-66%) |  8.1ns (-74%) |  6.7ns (-78%) |  6.2ns (-80%) |  3.7ns (-88%) |  3.7ns (-88%) |   3.8ns (-88%) |  3.9ns (-87%) |          3.9ns (-87%) |  3.5ns (-89%) |    3.5ns (-89%) |    3.5ns (-88%) |     3.4ns (-89%) | latin-16-chunk64      | -89% |
| TypeScript-checker       |  119352 |  72.9% |   0.01% |       - |  45.3ns | 49.5ns (+ 9%) | 15.1ns (-67%) |  14.6ns (-68%) | 14.7ns (-68%) | 22.3ns (-51%) | 17.0ns (-63%) | 14.1ns (-69%) |  9.2ns (-80%) | 12.0ns (-73%) |  4.4ns (-90%) |  3.7ns (-92%) |   3.9ns (-91%) |  3.9ns (-91%) |          3.9ns (-91%) |  3.6ns (-92%) |    2.9ns (-94%) |    2.9ns (-94%) |     3.1ns (-93%) | latin-8-chunk64       | -94% |
| RadixUIAdoptionSection   |     210 |  71.9% |   0.48% |  0.952% |  26.3ns | 26.5ns (+ 1%) |  6.8ns (-74%) |   6.4ns (-76%) |  6.4ns (-76%) |  9.4ns (-64%) |  8.6ns (-67%) |  6.6ns (-75%) |  5.8ns (-78%) |  5.4ns (-80%) |  4.1ns (-84%) |  3.9ns (-85%) |   3.9ns (-85%) |  3.9ns (-85%) |          3.9ns (-85%) |  3.5ns (-87%) |    3.6ns (-86%) |    3.6ns (-86%) |     3.6ns (-86%) | utf8-slice64          | -87% |
| excalidraw-App           |   16992 |  68.5% |   0.01% |       - |  44.0ns | 46.5ns (+ 6%) | 15.3ns (-65%) |  14.6ns (-67%) | 14.7ns (-67%) | 17.3ns (-61%) | 10.8ns (-75%) | 14.3ns (-67%) |  9.2ns (-79%) | 12.8ns (-71%) |  3.6ns (-92%) |  3.5ns (-92%) |   3.6ns (-92%) |  3.6ns (-92%) |          3.6ns (-92%) |  3.6ns (-92%) |    2.7ns (-94%) |    2.7ns (-94%) |     3.1ns (-93%) | latin-8-chunk64       | -94% |
| three                    |   74857 |  59.9% |   0.25% |       - |  31.5ns | 35.8ns (+14%) | 17.1ns (-46%) |  16.2ns (-48%) | 16.4ns (-48%) | 20.6ns (-35%) | 15.4ns (-51%) | 15.6ns (-51%) | 11.4ns (-64%) | 11.6ns (-63%) |  4.3ns (-86%) |  4.1ns (-87%) |   4.3ns (-86%) |  4.3ns (-86%) |          4.3ns (-86%) |  4.0ns (-87%) |    3.9ns (-88%) |    3.5ns (-89%) |     3.3ns (-89%) | latin-16-chunk64      | -89% |
| outline-Search           |     798 |  56.2% |       - |  0.501% |  41.6ns | 44.9ns (+ 8%) | 17.4ns (-58%) |  16.4ns (-61%) | 17.5ns (-58%) | 18.6ns (-55%) | 11.2ns (-73%) | 16.1ns (-61%) | 10.4ns (-75%) | 13.8ns (-67%) |  4.8ns (-88%) |  4.5ns (-89%) |   4.6ns (-89%) |  4.6ns (-89%) |          4.6ns (-89%) |  4.2ns (-90%) |    3.5ns (-92%) |    3.5ns (-92%) |     3.7ns (-91%) | latin-8-chunk64       | -92% |
| echarts                  |  161227 |   4.3% |   0.05% |  0.079% |  32.5ns | 38.2ns (+18%) | 38.6ns (+19%) |  37.4ns (+15%) | 37.3ns (+15%) | 35.9ns (+10%) | 21.5ns (-34%) | 35.0ns (+ 8%) | 23.0ns (-29%) | 28.3ns (-13%) | 10.2ns (-69%) | 10.2ns (-69%) |  10.1ns (-69%) | 10.2ns (-69%) |          9.7ns (-70%) | 10.1ns (-69%) |    7.8ns (-76%) |    5.8ns (-82%) |     3.8ns (-88%) | latin-16-chunk64      | -88% |
| victory                  |  103377 |   2.8% |   0.10% |  0.002% |  37.8ns | 38.7ns (+ 2%) | 38.3ns (+ 1%) |  37.8ns (- 0%) | 39.9ns (+ 5%) | 38.4ns (+ 2%) | 24.4ns (-36%) | 36.9ns (- 2%) | 26.6ns (-30%) | 29.9ns (-21%) | 13.2ns (-65%) |  8.6ns (-77%) |   8.9ns (-77%) |  9.0ns (-76%) |          8.9ns (-76%) |  8.6ns (-77%) |    6.2ns (-84%) |    4.4ns (-88%) |     3.9ns (-90%) | latin-16-chunk64      | -90% |
| d3                       |   47207 |   1.9% |   0.06% |  0.004% |  21.0ns | 22.7ns (+ 8%) | 22.8ns (+ 9%) |  22.1ns (+ 5%) | 22.2ns (+ 6%) | 20.0ns (- 5%) | 14.7ns (-30%) | 22.9ns (+ 9%) | 19.0ns (-10%) | 13.1ns (-38%) |  5.9ns (-72%) |  5.0ns (-76%) |   6.0ns (-71%) |  6.6ns (-69%) |          6.1ns (-71%) |  5.2ns (-75%) |    6.6ns (-69%) |    4.3ns (-80%) |     3.2ns (-85%) | latin-16-chunk64      | -85% |
| antd                     |  230650 |   1.3% |   0.03% |  0.012% |  45.5ns | 44.7ns (- 2%) | 44.5ns (- 2%) |  43.8ns (- 4%) | 44.1ns (- 3%) | 43.3ns (- 5%) | 28.4ns (-38%) | 42.7ns (- 6%) | 30.8ns (-32%) | 37.1ns (-18%) | 18.1ns (-60%) | 12.4ns (-73%) |  12.4ns (-73%) | 12.5ns (-72%) |         12.4ns (-73%) | 11.6ns (-74%) |    9.1ns (-80%) |    7.4ns (-84%) |     6.4ns (-86%) | latin-16-chunk64      | -86% |
| typescript               |  405969 |   0.6% |   0.06% |  0.001% |  42.0ns | 45.3ns (+ 8%) | 44.0ns (+ 5%) |  44.8ns (+ 7%) | 45.0ns (+ 7%) | 44.2ns (+ 5%) | 26.3ns (-37%) | 42.1ns (+ 0%) | 28.4ns (-32%) | 38.5ns (- 8%) | 14.5ns (-65%) | 12.7ns (-70%) |  12.9ns (-69%) | 13.0ns (-69%) |         12.6ns (-70%) | 12.5ns (-70%) |   10.3ns (-75%) |    8.1ns (-81%) |     5.7ns (-86%) | latin-16-chunk64      | -86% |
| terser-bundle.min        |   52283 |   0.2% |   0.21% |  0.033% |  33.2ns | 37.9ns (+14%) | 38.0ns (+14%) |  38.3ns (+15%) | 37.8ns (+14%) | 35.4ns (+ 7%) | 20.7ns (-38%) | 36.6ns (+10%) | 24.6ns (-26%) | 28.6ns (-14%) |  8.3ns (-75%) |  6.4ns (-81%) |   8.0ns (-76%) |  8.1ns (-76%) |          7.8ns (-76%) |  6.7ns (-80%) |    5.9ns (-82%) |    4.7ns (-86%) |     4.0ns (-88%) | latin-16-chunk64      | -88% |
| cal.com                  |   72373 |   0.1% |   0.00% |  0.011% |  42.0ns | 45.6ns (+ 9%) | 46.0ns (+ 9%) |  45.1ns (+ 7%) | 45.9ns (+ 9%) | 42.5ns (+ 1%) | 24.4ns (-42%) | 43.0ns (+ 2%) | 28.7ns (-32%) | 36.5ns (-13%) | 10.7ns (-74%) |  8.7ns (-79%) |   9.6ns (-77%) |  9.4ns (-78%) |          9.8ns (-77%) |  8.8ns (-79%) |    6.2ns (-85%) |    4.3ns (-90%) |     4.6ns (-89%) | latin-8-chunk64       | -90% |
| ------------------------ | ------- | ------ | ------- | ------- | ------- | ------------- | ------------- | -------------- | ------------- | ------------- | ------------- | ------------- | ------------- | ------------- | ------------- | ------------- | -------------- | ------------- | --------------------- | ------------- | --------------- | --------------- | ---------------- | --------------------- | ---- |
| Average                  |   56052 |  64.8% |   0.26% |  0.125% |  22.0ns | 23.6ns (+ 7%) | 15.4ns (-30%) |  15.0ns (-32%) | 15.2ns (-31%) | 17.7ns (-19%) | 12.7ns (-42%) | 14.5ns (-34%) | 10.5ns (-52%) | 12.1ns (-45%) |  5.3ns (-76%) |  4.6ns (-79%) |   4.8ns (-78%) |  4.8ns (-78%) |          4.7ns (-78%) |  4.5ns (-79%) |    3.9ns (-82%) |    3.4ns (-84%) |     3.1ns (-86%) | latin-16-chunk64      | -86% |

### `apply30` vs `switch30`

| File                     | strings |  ASCII | non-src | unicode | apply30 |       switch30 | fastest  |   by |
| ------------------------ | ------: | -----: | ------: | ------: | ------: | -------------: | -------- | ---: |
| TypeScript-binder        |    8681 | 100.0% |       - |       - |   1.9ns |  5.7ns (+196%) | apply30  |      |
| next.js-index            |    1618 | 100.0% |       - |       - |   2.0ns |  5.7ns (+193%) | apply30  |      |
| next.js-next             |     938 | 100.0% |       - |       - |   2.0ns |  5.6ns (+185%) | apply30  |      |
| prettier-handle-comments |    1297 | 100.0% |       - |       - |   1.9ns |  5.3ns (+175%) | apply30  |      |
| moment                   |    9044 | 100.0% |   0.09% |       - |   2.0ns |  6.6ns (+226%) | apply30  |      |
| jquery                   |   14696 | 100.0% |   0.27% |  0.007% |   2.4ns |  7.8ns (+220%) | apply30  |      |
| react-react.development  |    2733 | 100.0% |   0.37% |       - |   2.5ns |  6.2ns (+144%) | apply30  |      |
| core-errors              |     343 | 100.0% |   0.87% |       - |   2.9ns |  6.2ns (+110%) | apply30  |      |
| prettier-core            |     752 | 100.0% |   0.93% |  0.133% |   2.6ns |  6.2ns (+140%) | apply30  |      |
| vue                      |   19091 | 100.0% |   0.99% |       - |   2.7ns |  9.2ns (+243%) | apply30  |      |
| hono-types               |    7901 |  98.6% |       - |       - |   2.5ns |  6.9ns (+175%) | apply30  |      |
| pdfjs-dist-pdf           |   34823 |  97.9% |   0.09% |  0.029% |   3.0ns | 11.3ns (+275%) | apply30  |      |
| lodash                   |   14084 |  83.4% |   1.68% |  1.370% |   6.7ns |  10.1ns (+52%) | apply30  |      |
| TypeScript-checker       |  119352 |  72.9% |   0.01% |       - |   9.3ns |  17.0ns (+83%) | apply30  |      |
| RadixUIAdoptionSection   |     210 |  71.9% |   0.48% |  0.952% |   5.8ns |   8.8ns (+52%) | apply30  |      |
| excalidraw-App           |   16992 |  68.5% |   0.01% |       - |   9.1ns |  11.0ns (+20%) | apply30  |      |
| three                    |   74857 |  59.9% |   0.25% |       - |  11.5ns |  15.6ns (+36%) | apply30  |      |
| outline-Search           |     798 |  56.2% |       - |  0.501% |  10.3ns |  11.3ns (+10%) | apply30  |      |
| echarts                  |  161227 |   4.3% |   0.05% |  0.079% |  23.2ns |  21.5ns (- 7%) | switch30 | - 7% |
| victory                  |  103377 |   2.8% |   0.10% |  0.002% |  26.0ns |  24.2ns (- 7%) | switch30 | - 7% |
| d3                       |   47207 |   1.9% |   0.06% |  0.004% |  18.9ns |  14.8ns (-22%) | switch30 | -22% |
| antd                     |  230650 |   1.3% |   0.03% |  0.012% |  30.0ns |  29.0ns (- 4%) | switch30 | - 4% |
| typescript               |  405969 |   0.6% |   0.06% |  0.001% |  28.1ns |  26.7ns (- 5%) | switch30 | - 5% |
| terser-bundle.min        |   52283 |   0.2% |   0.21% |  0.033% |  24.3ns |  21.1ns (-13%) | switch30 | -13% |
| cal.com                  |   72373 |   0.1% |   0.00% |  0.011% |  28.1ns |  24.9ns (-12%) | switch30 | -12% |
| ------------------------ | ------- | ------ | ------- | ------- | ------- | -------------- | -------- | ---- |
| Average                  |   56052 |  64.8% |   0.26% |  0.125% |  10.4ns |  12.7ns (+23%) | apply30  |      |

### `apply30` vs `latin*` vs `latin-source64`

| File                     | strings |  ASCII | non-src | unicode | apply30 |       latin30 |       latin64 | latin-source64 | fastest        |   by |
| ------------------------ | ------: | -----: | ------: | ------: | ------: | ------------: | ------------: | -------------: | -------------- | ---: |
| TypeScript-binder        |    8681 | 100.0% |       - |       - |   1.9ns |  2.0ns (+ 2%) |  1.9ns (- 0%) |   2.0ns (+ 2%) | latin64        | - 0% |
| next.js-index            |    1618 | 100.0% |       - |       - |   2.0ns |  2.0ns (+ 0%) |  1.9ns (- 1%) |   2.0ns (+ 1%) | latin64        | - 1% |
| next.js-next             |     938 | 100.0% |       - |       - |   1.9ns |  2.0ns (+ 1%) |  1.9ns (+ 0%) |   2.0ns (+ 2%) | apply30        |      |
| prettier-handle-comments |    1297 | 100.0% |       - |       - |   2.0ns |  2.0ns (+ 0%) |  2.0ns (+ 1%) |   1.9ns (- 0%) | latin-source64 | - 0% |
| moment                   |    9044 | 100.0% |   0.09% |       - |   2.0ns |  2.0ns (- 3%) |  1.9ns (- 4%) |   2.1ns (+ 3%) | latin64        | - 4% |
| jquery                   |   14696 | 100.0% |   0.27% |  0.007% |   2.4ns |  2.4ns (+ 0%) |  2.1ns (-15%) |   2.4ns (+ 0%) | latin64        | -15% |
| react-react.development  |    2733 | 100.0% |   0.37% |       - |   2.6ns |  2.6ns (- 2%) |  2.4ns (- 6%) |   2.5ns (- 3%) | latin64        | - 6% |
| core-errors              |     343 | 100.0% |   0.87% |       - |   2.9ns |  2.9ns (+ 1%) |  2.9ns (+ 2%) |   2.9ns (- 0%) | latin-source64 | - 0% |
| prettier-core            |     752 | 100.0% |   0.93% |  0.133% |   2.6ns |  2.6ns (- 1%) |  2.6ns (- 1%) |   2.6ns (+ 0%) | latin64        | - 1% |
| vue                      |   19091 | 100.0% |   0.99% |       - |   2.7ns |  2.6ns (- 3%) |  2.5ns (- 6%) |   2.7ns (+ 1%) | latin64        | - 6% |
| hono-types               |    7901 |  98.6% |       - |       - |   2.5ns |  2.5ns (- 2%) |  2.5ns (- 2%) |   2.4ns (- 3%) | latin-source64 | - 3% |
| pdfjs-dist-pdf           |   34823 |  97.9% |   0.09% |  0.029% |   3.0ns |  2.7ns (-12%) |  2.6ns (-13%) |   2.6ns (-16%) | latin-source64 | -16% |
| lodash                   |   14084 |  83.4% |   1.68% |  1.370% |   6.8ns |  3.7ns (-45%) |  3.7ns (-45%) |   3.9ns (-43%) | latin30        | -45% |
| TypeScript-checker       |  119352 |  72.9% |   0.01% |       - |   9.2ns |  4.4ns (-52%) |  3.7ns (-59%) |   3.8ns (-58%) | latin64        | -59% |
| RadixUIAdoptionSection   |     210 |  71.9% |   0.48% |  0.952% |   5.8ns |  4.1ns (-30%) |  3.9ns (-32%) |   3.9ns (-32%) | latin-source64 | -32% |
| excalidraw-App           |   16992 |  68.5% |   0.01% |       - |   9.0ns |  3.7ns (-59%) |  3.5ns (-61%) |   3.6ns (-60%) | latin64        | -61% |
| three                    |   74857 |  59.9% |   0.25% |       - |  11.4ns |  4.2ns (-63%) |  4.1ns (-64%) |   4.4ns (-61%) | latin64        | -64% |
| outline-Search           |     798 |  56.2% |       - |  0.501% |  10.4ns |  4.8ns (-54%) |  4.6ns (-56%) |   4.6ns (-55%) | latin64        | -56% |
| echarts                  |  161227 |   4.3% |   0.05% |  0.079% |  23.0ns |  9.9ns (-57%) |  9.9ns (-57%) |  10.5ns (-54%) | latin64        | -57% |
| victory                  |  103377 |   2.8% |   0.10% |  0.002% |  26.1ns | 12.8ns (-51%) |  8.2ns (-68%) |   9.0ns (-65%) | latin64        | -68% |
| d3                       |   47207 |   1.9% |   0.06% |  0.004% |  18.9ns |  5.3ns (-72%) |  5.0ns (-73%) |   6.1ns (-68%) | latin64        | -73% |
| antd                     |  230650 |   1.3% |   0.03% |  0.012% |  30.3ns | 17.8ns (-41%) | 12.0ns (-60%) |  12.8ns (-58%) | latin64        | -60% |
| typescript               |  405969 |   0.6% |   0.06% |  0.001% |  27.7ns | 14.7ns (-47%) | 12.6ns (-55%) |  12.9ns (-53%) | latin64        | -55% |
| terser-bundle.min        |   52283 |   0.2% |   0.21% |  0.033% |  23.8ns |  7.6ns (-68%) |  6.5ns (-73%) |   8.5ns (-64%) | latin64        | -73% |
| cal.com                  |   72373 |   0.1% |   0.00% |  0.011% |  27.9ns | 10.6ns (-62%) |  8.4ns (-70%) |  10.0ns (-64%) | latin64        | -70% |
| ------------------------ | ------- | ------ | ------- | ------- | ------- | ------------- | ------------- | -------------- | -------------- | ---- |
| Average                  |   56052 |  64.8% |   0.26% |  0.125% |  10.3ns |  5.3ns (-49%) |  4.5ns (-56%) |   4.9ns (-53%) | latin64        | -56% |

### `latin64` vs `latin-4-chunk64` vs `latin-8-chunk64` vs `latin-16-chunk64`

| File                     | strings |  ASCII | non-src | unicode | latin64 | latin-4-chunk64 | latin-8-chunk64 | latin-16-chunk64 | fastest          |   by |
| ------------------------ | ------: | -----: | ------: | ------: | ------: | --------------: | --------------: | ---------------: | ---------------- | ---: |
| TypeScript-binder        |    8681 | 100.0% |       - |       - |   1.9ns |    1.9ns (- 2%) |    1.9ns (- 2%) |     1.9ns (- 1%) | latin-8-chunk64  | - 2% |
| next.js-index            |    1618 | 100.0% |       - |       - |   1.9ns |    1.9ns (+ 0%) |    2.0ns (+ 1%) |     2.0ns (+ 2%) | latin64          |      |
| next.js-next             |     938 | 100.0% |       - |       - |   2.0ns |    2.0ns (- 0%) |    2.0ns (- 1%) |     1.9ns (- 2%) | latin-16-chunk64 | - 2% |
| prettier-handle-comments |    1297 | 100.0% |       - |       - |   2.0ns |    2.0ns (+ 1%) |    1.9ns (- 1%) |     2.0ns (+ 1%) | latin-8-chunk64  | - 1% |
| moment                   |    9044 | 100.0% |   0.09% |       - |   2.0ns |    2.0ns (+ 1%) |    2.0ns (+ 2%) |     2.0ns (+ 1%) | latin64          |      |
| jquery                   |   14696 | 100.0% |   0.27% |  0.007% |   2.1ns |    2.1ns (+ 3%) |    2.1ns (+ 2%) |     2.1ns (+ 2%) | latin64          |      |
| react-react.development  |    2733 | 100.0% |   0.37% |       - |   2.4ns |    2.4ns (- 1%) |    2.4ns (- 0%) |     2.4ns (- 1%) | latin-4-chunk64  | - 1% |
| core-errors              |     343 | 100.0% |   0.87% |       - |   2.9ns |    2.9ns (+ 1%) |    2.9ns (+ 1%) |     3.0ns (+ 1%) | latin64          |      |
| prettier-core            |     752 | 100.0% |   0.93% |  0.133% |   2.5ns |    2.5ns (+ 0%) |    2.7ns (+ 8%) |     3.0ns (+17%) | latin64          |      |
| vue                      |   19091 | 100.0% |   0.99% |       - |   2.5ns |    2.5ns (- 1%) |    2.5ns (- 0%) |     2.5ns (- 0%) | latin-4-chunk64  | - 1% |
| hono-types               |    7901 |  98.6% |       - |       - |   2.4ns |    2.4ns (- 1%) |    2.7ns (+10%) |     2.4ns (- 1%) | latin-4-chunk64  | - 1% |
| pdfjs-dist-pdf           |   34823 |  97.9% |   0.09% |  0.029% |   2.6ns |    2.5ns (- 3%) |    2.5ns (- 3%) |     2.5ns (- 3%) | latin-8-chunk64  | - 3% |
| lodash                   |   14084 |  83.4% |   1.68% |  1.370% |   3.7ns |    3.5ns (- 6%) |    3.6ns (- 4%) |     3.4ns (- 9%) | latin-16-chunk64 | - 9% |
| TypeScript-checker       |  119352 |  72.9% |   0.01% |       - |   3.7ns |    2.9ns (-22%) |    3.1ns (-16%) |     3.1ns (-17%) | latin-4-chunk64  | -22% |
| RadixUIAdoptionSection   |     210 |  71.9% |   0.48% |  0.952% |   3.9ns |    3.6ns (- 8%) |    3.6ns (- 8%) |     3.6ns (- 8%) | latin-8-chunk64  | - 8% |
| excalidraw-App           |   16992 |  68.5% |   0.01% |       - |   3.5ns |    2.7ns (-23%) |    2.7ns (-24%) |     3.1ns (-11%) | latin-8-chunk64  | -24% |
| three                    |   74857 |  59.9% |   0.25% |       - |   4.1ns |    3.9ns (- 3%) |    3.6ns (-12%) |     3.3ns (-18%) | latin-16-chunk64 | -18% |
| outline-Search           |     798 |  56.2% |       - |  0.501% |   4.5ns |    3.6ns (-22%) |    3.5ns (-23%) |     3.7ns (-19%) | latin-8-chunk64  | -23% |
| echarts                  |  161227 |   4.3% |   0.05% |  0.079% |   9.9ns |    7.8ns (-22%) |    6.0ns (-39%) |     3.8ns (-62%) | latin-16-chunk64 | -62% |
| victory                  |  103377 |   2.8% |   0.10% |  0.002% |   8.3ns |    5.6ns (-33%) |    5.1ns (-39%) |     3.8ns (-54%) | latin-16-chunk64 | -54% |
| d3                       |   47207 |   1.9% |   0.06% |  0.004% |   4.9ns |    6.5ns (+33%) |    4.3ns (-12%) |     3.2ns (-35%) | latin-16-chunk64 | -35% |
| antd                     |  230650 |   1.3% |   0.03% |  0.012% |  12.1ns |    9.0ns (-26%) |    8.1ns (-34%) |     6.3ns (-48%) | latin-16-chunk64 | -48% |
| typescript               |  405969 |   0.6% |   0.06% |  0.001% |  12.7ns |   10.2ns (-20%) |    8.4ns (-33%) |     5.6ns (-56%) | latin-16-chunk64 | -56% |
| terser-bundle.min        |   52283 |   0.2% |   0.21% |  0.033% |   6.6ns |    5.7ns (-13%) |    4.9ns (-26%) |     4.0ns (-39%) | latin-16-chunk64 | -39% |
| cal.com                  |   72373 |   0.1% |   0.00% |  0.011% |   8.6ns |    6.2ns (-28%) |    6.0ns (-30%) |     4.5ns (-47%) | latin-16-chunk64 | -47% |
| ------------------------ | ------- | ------ | ------- | ------- | ------- | --------------- | --------------- | ---------------- | ---------------- | ---- |
| Average                  |   56052 |  64.8% |   0.26% |  0.125% |   4.5ns |    3.9ns (-14%) |    3.6ns (-21%) |     3.2ns (-30%) | latin-16-chunk64 | -30% |

### `latin-source64` vs `latin-slice64` vs `latin-slice-onebyte64` vs `utf8-slice64`

| File                     | strings |  ASCII | non-src | unicode | latin-source64 | latin-slice64 | latin-slice-onebyte64 |  utf8-slice64 | fastest               |   by |
| ------------------------ | ------: | -----: | ------: | ------: | -------------: | ------------: | --------------------: | ------------: | --------------------- | ---: |
| TypeScript-binder        |    8681 | 100.0% |       - |       - |          1.9ns |  1.9ns (- 1%) |          1.9ns (- 2%) |  1.9ns (- 2%) | utf8-slice64          | - 2% |
| next.js-index            |    1618 | 100.0% |       - |       - |          2.0ns |  2.0ns (+ 2%) |          1.9ns (- 0%) |  1.9ns (- 0%) | latin-slice-onebyte64 | - 0% |
| next.js-next             |     938 | 100.0% |       - |       - |          2.0ns |  2.0ns (- 3%) |          2.0ns (- 2%) |  2.0ns (- 3%) | latin-slice64         | - 3% |
| prettier-handle-comments |    1297 | 100.0% |       - |       - |          2.0ns |  2.0ns (+ 2%) |          2.0ns (- 1%) |  2.0ns (+ 0%) | latin-slice-onebyte64 | - 1% |
| moment                   |    9044 | 100.0% |   0.09% |       - |          2.1ns |  2.1ns (+ 1%) |          2.1ns (- 0%) |  2.1ns (+ 2%) | latin-slice-onebyte64 | - 0% |
| jquery                   |   14696 | 100.0% |   0.27% |  0.007% |          2.5ns |  2.5ns (+ 0%) |          2.5ns (+ 2%) |  2.5ns (+ 2%) | latin-source64        |      |
| react-react.development  |    2733 | 100.0% |   0.37% |       - |          2.5ns |  2.5ns (- 1%) |          2.4ns (- 6%) |  2.4ns (- 5%) | latin-slice-onebyte64 | - 6% |
| core-errors              |     343 | 100.0% |   0.87% |       - |          2.9ns |  2.9ns (+ 1%) |          2.9ns (+ 1%) |  2.7ns (- 7%) | utf8-slice64          | - 7% |
| prettier-core            |     752 | 100.0% |   0.93% |  0.133% |          2.6ns |  2.6ns (+ 1%) |          2.6ns (+ 1%) |  2.5ns (- 1%) | utf8-slice64          | - 1% |
| vue                      |   19091 | 100.0% |   0.99% |       - |          2.7ns |  2.7ns (+ 1%) |          2.7ns (+ 1%) |  2.7ns (- 0%) | utf8-slice64          | - 0% |
| hono-types               |    7901 |  98.6% |       - |       - |          2.4ns |  2.4ns (+ 0%) |          2.4ns (+ 1%) |  2.4ns (+ 0%) | latin-source64        |      |
| pdfjs-dist-pdf           |   34823 |  97.9% |   0.09% |  0.029% |          2.5ns |  2.5ns (+ 1%) |          2.5ns (+ 1%) |  2.5ns (+ 1%) | latin-source64        |      |
| lodash                   |   14084 |  83.4% |   1.68% |  1.370% |          3.8ns |  3.9ns (+ 1%) |          3.9ns (+ 1%) |  3.4ns (-10%) | utf8-slice64          | -10% |
| TypeScript-checker       |  119352 |  72.9% |   0.01% |       - |          3.9ns |  3.8ns (- 2%) |          4.0ns (+ 2%) |  3.7ns (- 5%) | utf8-slice64          | - 5% |
| RadixUIAdoptionSection   |     210 |  71.9% |   0.48% |  0.952% |          4.0ns |  3.9ns (- 1%) |          4.0ns (- 0%) |  3.6ns (- 9%) | utf8-slice64          | - 9% |
| excalidraw-App           |   16992 |  68.5% |   0.01% |       - |          3.6ns |  3.6ns (+ 1%) |          3.6ns (+ 1%) |  3.6ns (+ 1%) | latin-source64        |      |
| three                    |   74857 |  59.9% |   0.25% |       - |          4.4ns |  4.3ns (- 1%) |          4.3ns (- 1%) |  4.1ns (- 6%) | utf8-slice64          | - 6% |
| outline-Search           |     798 |  56.2% |       - |  0.501% |          4.6ns |  4.6ns (+ 1%) |          4.6ns (+ 0%) |  4.2ns (- 9%) | utf8-slice64          | - 9% |
| echarts                  |  161227 |   4.3% |   0.05% |  0.079% |         10.4ns | 10.1ns (- 3%) |         10.3ns (- 2%) | 10.2ns (- 3%) | latin-slice64         | - 3% |
| victory                  |  103377 |   2.8% |   0.10% |  0.002% |          8.9ns |  9.0ns (+ 1%) |          8.9ns (+ 0%) |  8.9ns (- 1%) | utf8-slice64          | - 1% |
| d3                       |   47207 |   1.9% |   0.06% |  0.004% |          6.2ns |  6.0ns (- 3%) |          6.1ns (- 2%) |  5.7ns (- 8%) | utf8-slice64          | - 8% |
| antd                     |  230650 |   1.3% |   0.03% |  0.012% |         12.3ns | 12.6ns (+ 2%) |         12.5ns (+ 2%) | 11.5ns (- 6%) | utf8-slice64          | - 6% |
| typescript               |  405969 |   0.6% |   0.06% |  0.001% |         12.9ns | 12.7ns (- 1%) |         13.3ns (+ 3%) | 12.7ns (- 1%) | utf8-slice64          | - 1% |
| terser-bundle.min        |   52283 |   0.2% |   0.21% |  0.033% |          8.4ns |  7.9ns (- 6%) |          8.4ns (- 0%) |  8.1ns (- 5%) | latin-slice64         | - 6% |
| cal.com                  |   72373 |   0.1% |   0.00% |  0.011% |          9.8ns |  9.8ns (- 0%) |          9.5ns (- 3%) |  9.6ns (- 2%) | latin-slice-onebyte64 | - 3% |
| ------------------------ | ------- | ------ | ------- | ------- | -------------- | ------------- | --------------------- | ------------- | --------------------- | ---- |
| Average                  |   56052 |  64.8% |   0.26% |  0.125% |          4.9ns |  4.8ns (- 1%) |          4.9ns (- 0%) |  4.7ns (- 4%) | utf8-slice64          | - 4% |

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
