/**
 * `latin-source64` with the following changes:
 *
 * - Decode Latin1 string using `Buffer.prototype.latin1Slice` instead of `TextDecoder("latin1")`.
 *
 * `TextDecoder("latin1")` does not do a pure Latin1 decode, it actually decodes as `windows-1252`.
 * Per the WHATWG Encoding Standard, "latin1" is mapped to "windows-1252".
 * The result is that `TextDecoder("latin1")` produces a 2-byte-per-char string (`TWO_BYTE` in V8).
 * `latin1Slice` does a pure Latin1 decode, and so produces a 1-byte-per-char string (`ONE_BYTE` in V8).
 *
 * `latin1Slice` is also likely much faster, because:
 * 1. For all-ASCII: It skips the `isAscii()` SIMD scan that TextDecoder("latin1") does first. Just `memcpy`.
 * 2. For non-ASCII: `TextDecoder("latin1")` decodes purely in JS - allocates a `Uint16Array`,
 *    does a byte-by-byte lookup table mapping.
 *
 * `latin*` versions could not be put into use now, because strings outside source text
 * are not clustered together in memory at present. This version would work now.
 */

// oxlint-disable prefer-const, unicorn/no-new-array

const textDecoder = new TextDecoder("utf-8", { ignoreBOM: true }),
  decodeStr = textDecoder.decode.bind(textDecoder);

const { fromCharCode } = String;

const { latin1Slice } = Buffer.prototype;

let firstNonAsciiPos;
let sourceTextLatin;

const tempArrays = [];
for (let i = 0; i <= 64; i++) {
  tempArrays.push(new Array(i).fill(0));
}

export function setup() {
  // Find first non-ASCII byte in source region
  firstNonAsciiPos = sourceEndPos;
  for (let i = 0; i < sourceEndPos; i++) {
    if (uint8[i] >= 128) {
      firstNonAsciiPos = i;
      break;
    }
  }

  if (sourceIsAscii) {
    sourceTextLatin = sourceText;
  } else {
    sourceTextLatin = latin1Slice.call(uint8, 0, sourceEndPos);
  }
}

export function deserializeStr(pos) {
  let pos32 = pos >> 2,
    len = uint32[pos32 + 2];

  // Early return for empty strings
  if (len === 0) return "";

  pos = uint32[pos32];

  // If string is in source region and either:
  // 1. Source is all ASCII, or
  // 2. String is before first non-ASCII byte in source
  // then use `sourceText.substr`
  let end = pos + len;
  if (end <= firstNonAsciiPos) return sourceText.substr(pos, len);

  // If longer than 64 bytes, use `TextDecoder`
  if (len > 64) return decodeStr(uint8.subarray(pos, end));

  // If string is in source region, use slice of `sourceTextLatin`
  if (pos < sourceEndPos) {
    // Check if all bytes are ASCII, use `TextDecoder` if not
    for (let i = pos; i < end; i++) {
      if (uint8[i] >= 128) return decodeStr(uint8.subarray(pos, end));
    }

    // String is all ASCII, so slice from `sourceTextLatin`
    return sourceTextLatin.substr(pos, len);
  }

  // String is not in source region - use `fromCharCode.apply` with a temp array.
  // Copy bytes into temp array of correct length.
  // If any byte is non-ASCII, use `TextDecoder`.
  let arr = tempArrays[len];
  for (let i = 0; i < len; i++) {
    let b = uint8[pos + i];
    if (b >= 128) return decodeStr(uint8.subarray(pos, end));
    arr[i] = b;
  }

  // Call `fromCharCode` with temp array
  return fromCharCode.apply(null, arr);
}
