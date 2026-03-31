/**
 * `simpler-branch` with the following changes:
 *
 * - Slice from latin1-decoded source text if string is all ASCII.
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

  /*
  console.log({
    pos: uint32[pos32],
    byte: uint8[pos],
    charCode: sourceTextLatin.charCodeAt(pos),
    len,
    firstNonAsciiPos,
    sourceEndPos,
    sourceTextLatinLen: sourceTextLatin.length,
    sourceIsAscii,
  });
  */

  // Early return for empty strings
  if (len === 0) return "";

  pos = uint32[pos32];

  // If string is in source region and either:
  // 1. Source is all ASCII, or
  // 2. String is before first non-ASCII byte in source
  // then use `sourceText.substr`
  let end = pos + len;
  if (end <= firstNonAsciiPos) return sourceText.substr(pos, len);

  // If longer than 9 bytes, use `TextDecoder`
  if (len > 9) return decodeStr(uint8.subarray(pos, end));

  // Check if all bytes are ASCII, use `TextDecoder` if not
  for (let i = pos; i < end; i++) {
    if (uint8[i] >= 128) return decodeStr(uint8.subarray(pos, end));
  }

  // String is all ASCII, so slice from `sourceTextLatin`
  return sourceTextLatin.substr(pos, len);
}
