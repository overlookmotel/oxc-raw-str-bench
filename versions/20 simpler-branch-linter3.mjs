/**
 * `simpler-branch-linter` with the following changes:
 *
 * - Simplified branch condition for "can we use `sourceText.substr`?" - reduce to a single branch.
 */

// oxlint-disable prefer-const

const textDecoder = new TextDecoder("utf-8", { ignoreBOM: true }),
  decodeStr = textDecoder.decode.bind(textDecoder);

const { fromCharCode } = String;

let firstNonAsciiOffsetMinusOne = 0,
  sourceStartPosPlusOne = 0;

export function setup() {
  sourceStartPosPlusOne = sourceStartPos + 1;

  // Find first non-ASCII byte in source region
  if (sourceIsAscii) {
    firstNonAsciiOffsetMinusOne = sourceByteLen - 1;
  } else {
    let i = sourceStartPos;
    for (; i < sourceEndPos; i++) {
      if (uint8[i] >= 128) break;
    }
    firstNonAsciiOffsetMinusOne = i - sourceStartPosPlusOne;
  }
}

export function deserializeStr(pos) {
  let pos32 = pos >> 2,
    len = uint32[pos32 + 2];

  // Early return for empty strings
  if (len === 0) return "";

  pos = uint32[pos32];

  // If string is in source region and string is before first non-ASCII byte in source,
  // then use `sourceText.substr`.
  //
  // The test is `pos >= sourceStartPos && end <= firstNonAsciiPos`.
  //
  // Reduce it to a single branch by using equivalent of `end.wrapping_sub(sourceStartPosPlusOne)` in Rust.
  // When string is not in source region, `end` is less or equal to `sourceStartPos`,
  // so `end - sourceStartPos` is negative or 0. `n >>> 0` converts negative numbers to `n + (2 ** 32)`,
  // so they fail the `<= firstNonAsciiOffsetMinusOne` test.
  //
  // In this way, we conflate the 2 checks for (a) is string part of source region and (b) is it part of source text
  // before the first non-ASCII byte.
  //
  // We have to subtract an additional 1 from `end` and `sourceStartPos`, to avoid a false positive
  // where a string which isn't part of source is directly before source text in buffer.
  // `end - sourceStartPos` would be 0 in this case, which would incorrectly identify the string
  // as being in source region and all ASCII. By using `end - (sourceStartPos + 1)`,
  // we get -1 instead, which `>>> 0` wraps around to `(2 ** 32) - 1`, so the test fails (as it should).
  let end = pos + len;
  let endOffset = (end - sourceStartPosPlusOne) >>> 0; // `end.wrapping_sub(sourceStartPosPlusOne)` in Rust
  if (endOffset <= firstNonAsciiOffsetMinusOne) {
    return sourceText.substr(pos - sourceStartPos, len);
  }

  // If longer than 9 bytes, use `TextDecoder`
  if (len > 9) return decodeStr(uint8.subarray(pos, end));

  // Concat bytes into string.
  // If any byte is non-ASCII, use `TextDecoder`.
  let out = "",
    c;
  do {
    c = uint8[pos++];
    if (c < 128) out += fromCharCode(c);
    else {
      out += decodeStr(uint8.subarray(pos - 1, end));
      break;
    }
  } while (pos < end);

  return out;
}
