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

## Files

- `construct.ts` - Downloads source files, patches `oxc-parser`'s deserializer for instrumentation,
  captures `deserializeStr` calls, produces fixture data.
- `verify.ts` - Validates that the fixture data produces the correct strings,
  and all `deserializeStr` implementations produce the correct strings.
- `bench.ts` - Benchmarks multiple `deserializeStr` implementations.
- `urls.json` - URLs of benchmark source files.
- `versions` directory - `deserializeStr` implementations to benchmark.
- `fixtures` directory - Captured data per benchmark file.
