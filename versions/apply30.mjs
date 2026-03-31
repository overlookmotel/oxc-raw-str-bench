/**
 * `apply` with the following changes:
 *
 * - Change crossover point where use `TextDecoder` to 30 bytes.
 */

// oxlint-disable prefer-const, unicorn/no-new-array

const textDecoder = new TextDecoder("utf-8", { ignoreBOM: true }),
  decodeStr = textDecoder.decode.bind(textDecoder);

const { fromCharCode } = String;

let firstNonAsciiPos;

const tempArrays = [];
for (let i = 0; i <= 30; i++) {
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

  // If longer than 30 bytes, use `TextDecoder`
  if (len > 30) return decodeStr(uint8.subarray(pos, end));

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
