/**
 * `current-linter` with the following changes:
 *
 * - Simplified branch condition for "can we use `sourceText.substr`?" - 1 less subtraction.
 */

// oxlint-disable prefer-const

const textDecoder = new TextDecoder("utf-8", { ignoreBOM: true }),
  decodeStr = textDecoder.decode.bind(textDecoder);

const { fromCharCode } = String;

let firstNonAsciiPos = 0;

export function setup() {
  // Find first non-ASCII byte in source region
  if (!sourceIsAscii) {
    let i = sourceStartPos;
    for (; i < sourceEndPos; i++) {
      if (uint8[i] >= 128) break;
    }
    firstNonAsciiPos = i;
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
  if (pos >= sourceStartPos && (sourceIsAscii || end <= firstNonAsciiPos)) {
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
