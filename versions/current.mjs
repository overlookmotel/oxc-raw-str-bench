/**
 * Current implementation:
 * - Concat loop for short strings, `TextDecoder` for len > 50.
 */

// oxlint-disable prefer-const

const textDecoder = new TextDecoder("utf-8", { ignoreBOM: true }),
  decodeStr = textDecoder.decode.bind(textDecoder);

const { fromCodePoint } = String;

export function setup() {}

export function deserializeStr(pos) {
  let pos32 = pos >> 2,
    len = uint32[pos32 + 2];

  // Early return for empty strings
  if (len === 0) return "";

  pos = uint32[pos32];

  // If source is all ASCII and string is in source region, use `sourceText.substr`
  if (sourceIsAscii && pos < sourceEndPos) return sourceText.substr(pos, len);

  let end = pos + len;

  // If longer than 50 bytes, use `TextDecoder`
  if (len > 50) return decodeStr(uint8.subarray(pos, end));

  // Concat bytes into string.
  // If any byte is non-ASCII, use `TextDecoder`.
  let out = "",
    c;
  do {
    c = uint8[pos++];
    if (c < 128) out += fromCodePoint(c);
    else {
      out += decodeStr(uint8.subarray(pos - 1, end));
      break;
    }
  } while (pos < end);

  return out;
}
