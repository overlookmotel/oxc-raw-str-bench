/**
 * `latin-slice-onebyte64` with the following changes:
 *
 * - Use `Buffer.prototype.utf8Slice` instead of `TextDecoder` for decoding UTF-8.
 *
 * `utf8Slice` has 2 advantages over `TextDecoder`:
 *
 * 1. No need to create a temp `Uint8Array` to pass to `TextDecoder.decode`.
 * 2. Skips various checks that `TextDecoder.decode` does.
 *
 * `latin*` versions could not be put into use now, because strings outside source text
 * are not clustered together in memory at present. This version would work now.
 */

// oxlint-disable prefer-const, unicorn/no-new-array

const { fromCharCode } = String;

const { utf8Slice, latin1Slice } = Buffer.prototype;

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
  // then use `sourceTextLatin.substr`
  let end = pos + len;
  if (end <= firstNonAsciiPos) return sourceTextLatin.substr(pos, len);

  // If longer than 64 bytes, use `TextDecoder`
  if (len > 64) return utf8Slice.call(uint8, pos, end);

  // If string is in source region, use slice of `sourceTextLatin`
  if (pos < sourceEndPos) {
    // Check if all bytes are ASCII, use `TextDecoder` if not
    for (let i = pos; i < end; i++) {
      if (uint8[i] >= 128) return utf8Slice.call(uint8, pos, end);
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
    if (b >= 128) return utf8Slice.call(uint8, pos, end);
    arr[i] = b;
  }

  // Call `fromCharCode` with temp array
  return fromCharCode.apply(null, arr);
}
