/**
 * `simpler-branch` with the following changes:
 *
 * - Use switch and single `fromCharCode` call in slow path.
 */

// oxlint-disable prefer-const

const textDecoder = new TextDecoder("utf-8", { ignoreBOM: true }),
  decodeStr = textDecoder.decode.bind(textDecoder);

const { fromCharCode } = String;

let firstNonAsciiPos;

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

  // If longer than 9 bytes, use `TextDecoder`
  if (len > 9) return decodeStr(uint8.subarray(pos, end));

  // Check if all bytes are ASCII, use `TextDecoder` if not
  for (let i = pos; i < end; i++) {
    if (uint8[i] >= 128) return decodeStr(uint8.subarray(pos, end));
  }

  // Switch on length with single `fromCharCode` call
  switch (len) {
    case 1:
      return fromCharCode(uint8[pos]);
    case 2:
      return fromCharCode(uint8[pos], uint8[pos + 1]);
    case 3:
      return fromCharCode(uint8[pos], uint8[pos + 1], uint8[pos + 2]);
    case 4:
      return fromCharCode(uint8[pos], uint8[pos + 1], uint8[pos + 2], uint8[pos + 3]);
    case 5:
      return fromCharCode(
        uint8[pos],
        uint8[pos + 1],
        uint8[pos + 2],
        uint8[pos + 3],
        uint8[pos + 4],
      );
    case 6:
      return fromCharCode(
        uint8[pos],
        uint8[pos + 1],
        uint8[pos + 2],
        uint8[pos + 3],
        uint8[pos + 4],
        uint8[pos + 5],
      );
    case 7:
      return fromCharCode(
        uint8[pos],
        uint8[pos + 1],
        uint8[pos + 2],
        uint8[pos + 3],
        uint8[pos + 4],
        uint8[pos + 5],
        uint8[pos + 6],
      );
    case 8:
      return fromCharCode(
        uint8[pos],
        uint8[pos + 1],
        uint8[pos + 2],
        uint8[pos + 3],
        uint8[pos + 4],
        uint8[pos + 5],
        uint8[pos + 6],
        uint8[pos + 7],
      );
    case 9:
      return fromCharCode(
        uint8[pos],
        uint8[pos + 1],
        uint8[pos + 2],
        uint8[pos + 3],
        uint8[pos + 4],
        uint8[pos + 5],
        uint8[pos + 6],
        uint8[pos + 7],
        uint8[pos + 8],
      );
  }
}
