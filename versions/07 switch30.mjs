/**
 * `switch` with the following changes:
 *
 * - Change crossover point where use `TextDecoder` to 30 bytes.
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

  // If longer than 30 bytes, use `TextDecoder`
  if (len > 30) return decodeStr(uint8.subarray(pos, end));

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
    case 10:
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
        uint8[pos + 9],
      );
    case 11:
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
        uint8[pos + 9],
        uint8[pos + 10],
      );
    case 12:
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
        uint8[pos + 9],
        uint8[pos + 10],
        uint8[pos + 11],
      );
    case 13:
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
        uint8[pos + 9],
        uint8[pos + 10],
        uint8[pos + 11],
        uint8[pos + 12],
      );
    case 14:
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
        uint8[pos + 9],
        uint8[pos + 10],
        uint8[pos + 11],
        uint8[pos + 12],
        uint8[pos + 13],
      );
    case 15:
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
        uint8[pos + 9],
        uint8[pos + 10],
        uint8[pos + 11],
        uint8[pos + 12],
        uint8[pos + 13],
        uint8[pos + 14],
      );
    case 16:
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
        uint8[pos + 9],
        uint8[pos + 10],
        uint8[pos + 11],
        uint8[pos + 12],
        uint8[pos + 13],
        uint8[pos + 14],
        uint8[pos + 15],
      );
    case 17:
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
        uint8[pos + 9],
        uint8[pos + 10],
        uint8[pos + 11],
        uint8[pos + 12],
        uint8[pos + 13],
        uint8[pos + 14],
        uint8[pos + 15],
        uint8[pos + 16],
      );
    case 18:
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
        uint8[pos + 9],
        uint8[pos + 10],
        uint8[pos + 11],
        uint8[pos + 12],
        uint8[pos + 13],
        uint8[pos + 14],
        uint8[pos + 15],
        uint8[pos + 16],
        uint8[pos + 17],
      );
    case 19:
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
        uint8[pos + 9],
        uint8[pos + 10],
        uint8[pos + 11],
        uint8[pos + 12],
        uint8[pos + 13],
        uint8[pos + 14],
        uint8[pos + 15],
        uint8[pos + 16],
        uint8[pos + 17],
        uint8[pos + 18],
      );
    case 20:
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
        uint8[pos + 9],
        uint8[pos + 10],
        uint8[pos + 11],
        uint8[pos + 12],
        uint8[pos + 13],
        uint8[pos + 14],
        uint8[pos + 15],
        uint8[pos + 16],
        uint8[pos + 17],
        uint8[pos + 18],
        uint8[pos + 19],
      );
    case 21:
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
        uint8[pos + 9],
        uint8[pos + 10],
        uint8[pos + 11],
        uint8[pos + 12],
        uint8[pos + 13],
        uint8[pos + 14],
        uint8[pos + 15],
        uint8[pos + 16],
        uint8[pos + 17],
        uint8[pos + 18],
        uint8[pos + 19],
        uint8[pos + 20],
      );
    case 22:
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
        uint8[pos + 9],
        uint8[pos + 10],
        uint8[pos + 11],
        uint8[pos + 12],
        uint8[pos + 13],
        uint8[pos + 14],
        uint8[pos + 15],
        uint8[pos + 16],
        uint8[pos + 17],
        uint8[pos + 18],
        uint8[pos + 19],
        uint8[pos + 20],
        uint8[pos + 21],
      );
    case 23:
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
        uint8[pos + 9],
        uint8[pos + 10],
        uint8[pos + 11],
        uint8[pos + 12],
        uint8[pos + 13],
        uint8[pos + 14],
        uint8[pos + 15],
        uint8[pos + 16],
        uint8[pos + 17],
        uint8[pos + 18],
        uint8[pos + 19],
        uint8[pos + 20],
        uint8[pos + 21],
        uint8[pos + 22],
      );
    case 24:
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
        uint8[pos + 9],
        uint8[pos + 10],
        uint8[pos + 11],
        uint8[pos + 12],
        uint8[pos + 13],
        uint8[pos + 14],
        uint8[pos + 15],
        uint8[pos + 16],
        uint8[pos + 17],
        uint8[pos + 18],
        uint8[pos + 19],
        uint8[pos + 20],
        uint8[pos + 21],
        uint8[pos + 22],
        uint8[pos + 23],
      );
    case 25:
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
        uint8[pos + 9],
        uint8[pos + 10],
        uint8[pos + 11],
        uint8[pos + 12],
        uint8[pos + 13],
        uint8[pos + 14],
        uint8[pos + 15],
        uint8[pos + 16],
        uint8[pos + 17],
        uint8[pos + 18],
        uint8[pos + 19],
        uint8[pos + 20],
        uint8[pos + 21],
        uint8[pos + 22],
        uint8[pos + 23],
        uint8[pos + 24],
      );
    case 26:
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
        uint8[pos + 9],
        uint8[pos + 10],
        uint8[pos + 11],
        uint8[pos + 12],
        uint8[pos + 13],
        uint8[pos + 14],
        uint8[pos + 15],
        uint8[pos + 16],
        uint8[pos + 17],
        uint8[pos + 18],
        uint8[pos + 19],
        uint8[pos + 20],
        uint8[pos + 21],
        uint8[pos + 22],
        uint8[pos + 23],
        uint8[pos + 24],
        uint8[pos + 25],
      );
    case 27:
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
        uint8[pos + 9],
        uint8[pos + 10],
        uint8[pos + 11],
        uint8[pos + 12],
        uint8[pos + 13],
        uint8[pos + 14],
        uint8[pos + 15],
        uint8[pos + 16],
        uint8[pos + 17],
        uint8[pos + 18],
        uint8[pos + 19],
        uint8[pos + 20],
        uint8[pos + 21],
        uint8[pos + 22],
        uint8[pos + 23],
        uint8[pos + 24],
        uint8[pos + 25],
        uint8[pos + 26],
      );
    case 28:
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
        uint8[pos + 9],
        uint8[pos + 10],
        uint8[pos + 11],
        uint8[pos + 12],
        uint8[pos + 13],
        uint8[pos + 14],
        uint8[pos + 15],
        uint8[pos + 16],
        uint8[pos + 17],
        uint8[pos + 18],
        uint8[pos + 19],
        uint8[pos + 20],
        uint8[pos + 21],
        uint8[pos + 22],
        uint8[pos + 23],
        uint8[pos + 24],
        uint8[pos + 25],
        uint8[pos + 26],
        uint8[pos + 27],
      );
    case 29:
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
        uint8[pos + 9],
        uint8[pos + 10],
        uint8[pos + 11],
        uint8[pos + 12],
        uint8[pos + 13],
        uint8[pos + 14],
        uint8[pos + 15],
        uint8[pos + 16],
        uint8[pos + 17],
        uint8[pos + 18],
        uint8[pos + 19],
        uint8[pos + 20],
        uint8[pos + 21],
        uint8[pos + 22],
        uint8[pos + 23],
        uint8[pos + 24],
        uint8[pos + 25],
        uint8[pos + 26],
        uint8[pos + 27],
        uint8[pos + 28],
      );
    case 30:
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
        uint8[pos + 9],
        uint8[pos + 10],
        uint8[pos + 11],
        uint8[pos + 12],
        uint8[pos + 13],
        uint8[pos + 14],
        uint8[pos + 15],
        uint8[pos + 16],
        uint8[pos + 17],
        uint8[pos + 18],
        uint8[pos + 19],
        uint8[pos + 20],
        uint8[pos + 21],
        uint8[pos + 22],
        uint8[pos + 23],
        uint8[pos + 24],
        uint8[pos + 25],
        uint8[pos + 26],
        uint8[pos + 27],
        uint8[pos + 28],
        uint8[pos + 29],
      );
  }
}
