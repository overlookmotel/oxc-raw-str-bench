/**
 * `latin-4-chunk64` with the following changes:
 *
 * - Check bytes are ASCII in blocks of 16 bytes.
 */

// oxlint-disable prefer-const

const textDecoder = new TextDecoder("utf-8", { ignoreBOM: true }),
  decodeStr = textDecoder.decode.bind(textDecoder);

const latin1Decoder = new TextDecoder("latin1"),
  decodeLatinStr = latin1Decoder.decode.bind(latin1Decoder);

let firstNonAsciiPos;
let sourceTextLatin;

export function setup() {
  // Find first non-ASCII byte in source region
  firstNonAsciiPos = sourceEndPos;
  for (let i = 0; i < sourceEndPos; i++) {
    if (uint8[i] >= 128) {
      firstNonAsciiPos = i;
      break;
    }
  }

  sourceTextLatin = decodeLatinStr(uint8);
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

  // Check if all bytes are ASCII, use `TextDecoder` if not.
  // Check in blocks of 16 bytes for speed.
  // This can produce false positives, as we round down start position, and round up end position,
  // but non-ASCII bytes are rare in source text, so the gain should outweigh the cost of occasional false positives.
  let strPos32 = pos >> 2;
  let strEndPos32 = (end + 3) >> 2;
  do {
    let chunk =
      uint32[strPos32] | uint32[strPos32 + 1] | uint32[strPos32 + 2] | uint32[strPos32 + 3];
    if ((chunk & 0x8080_8080) !== 0) return decodeStr(uint8.subarray(pos, end));
    strPos32 += 4;
  } while (strPos32 < strEndPos32);

  // String is all ASCII, so slice from `sourceTextLatin`
  return sourceTextLatin.substr(pos, len);
}
