/**
 * Sparse UTF-8/UTF-16 translation table: extends sourceText.substr() to ALL
 * source strings, not just those in the ASCII prefix.
 *
 * Builds on pr20834-fnap.mjs. Instead of finding the first non-ASCII byte and
 * giving up after it, we scan the source region once in setup() and record the
 * cumulative byte-vs-codeunit drift at each multi-byte character. A binary
 * search at read time converts byte offsets to UTF-16 offsets in O(log k),
 * where k is the number of non-ASCII characters (typically tiny for source).
 */

// oxlint-disable prefer-const

const textDecoder = new TextDecoder("utf-8", { ignoreBOM: true }),
  decodeStr = textDecoder.decode.bind(textDecoder);

const { fromCodePoint } = String;

// Sparse table: parallel arrays for cache-friendly binary search.
// tableOffsets[i] = byte offset just past the i-th multi-byte character.
// tableDrifts[i]  = cumulative drift (utf8 bytes - utf16 code units) at that point.
let tableOffsets;
let tableDrifts;
let tableLen;

export function setup() {
  // First pass: count multi-byte characters to size the arrays.
  let count = 0;
  for (let i = 0; i < sourceEndPos; ) {
    let b = uint8[i];
    if (b >= 0xf0) { count++; i += 4; }
    else if (b >= 0xe0) { count++; i += 3; }
    else if (b >= 0xc0) { count++; i += 2; }
    else { i++; }
  }

  tableOffsets = new Uint32Array(count);
  tableDrifts = new Uint32Array(count);
  tableLen = count;

  // Second pass: populate the table.
  let drift = 0;
  let idx = 0;
  for (let i = 0; i < sourceEndPos; ) {
    let b = uint8[i];
    if (b >= 0xf0) {
      // 4-byte sequence -> 2 UTF-16 code units (surrogate pair), drift += 2
      drift += 2;
      i += 4;
      tableOffsets[idx] = i;
      tableDrifts[idx] = drift;
      idx++;
    } else if (b >= 0xe0) {
      // 3-byte sequence -> 1 UTF-16 code unit, drift += 2
      drift += 2;
      i += 3;
      tableOffsets[idx] = i;
      tableDrifts[idx] = drift;
      idx++;
    } else if (b >= 0xc0) {
      // 2-byte sequence -> 1 UTF-16 code unit, drift += 1
      drift += 1;
      i += 2;
      tableOffsets[idx] = i;
      tableDrifts[idx] = drift;
      idx++;
    } else {
      i++;
    }
  }
}

// Binary search: find the largest index where tableOffsets[index] <= target.
// Returns -1 if target is before all entries (i.e. drift is 0).
function findDrift(target) {
  let lo = 0, hi = tableLen - 1, result = -1;
  while (lo <= hi) {
    let mid = (lo + hi) >>> 1;
    if (tableOffsets[mid] <= target) {
      result = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return result;
}

// Get the cumulative drift at a byte offset.
function driftAt(bytePos) {
  if (tableLen === 0) return 0;
  let idx = findDrift(bytePos);
  return idx < 0 ? 0 : tableDrifts[idx];
}

export function deserializeStr(pos) {
  let pos32 = pos >> 2,
    len = uint32[pos32 + 2];
  if (len === 0) return "";
  pos = uint32[pos32];

  if (pos + len <= sourceEndPos) {
    if (sourceIsAscii) return sourceText.substr(pos, len);

    // Use the sparse table to convert byte offsets to UTF-16 offsets.
    let startDrift = driftAt(pos);
    let endDrift = driftAt(pos + len);
    let utf16Start = pos - startDrift;
    let utf16Len = len - (endDrift - startDrift);
    return sourceText.substr(utf16Start, utf16Len);
  }

  // Outside source region: fall back to concat/TextDecoder (from pr20834-fnap).
  let end = pos + len;
  if (len > 9) return decodeStr(uint8.subarray(pos, end));
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
