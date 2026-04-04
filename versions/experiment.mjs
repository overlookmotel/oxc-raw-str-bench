/**
 * Experiment 32: Micro-optimizations - remove len===0 check,
 * use local references for hot variables.
 */

// oxlint-disable prefer-const

const textDecoder = new TextDecoder("utf-8", { ignoreBOM: true });

let bufferAsAscii;
let nonAsciiCum;

export function setup() {
  const latin1Decoder = new TextDecoder("latin1");
  bufferAsAscii = latin1Decoder.decode(uint8);
  nonAsciiCum = new Uint32Array(uint8.length + 1);
  let count = 0;
  for (let i = 0; i < uint8.length; i++) {
    nonAsciiCum[i] = count;
    if (uint8[i] >= 128) count++;
  }
  nonAsciiCum[uint8.length] = count;
}

export function deserializeStr(pos) {
  let pos32 = pos >> 2,
    len = uint32[pos32 + 2],
    p = uint32[pos32];
  if (p < sourceEndPos && sourceIsAscii) return sourceText.substr(p, len);
  let end = p + len;
  if (nonAsciiCum[end] === nonAsciiCum[p]) return bufferAsAscii.substr(p, len);
  return textDecoder.decode(uint8.subarray(p, end));
}
