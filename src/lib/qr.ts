/**
 * Self-contained ISO/IEC 18004 QR Code matrix generator (Byte mode, ECC Level L, Versions 1..6).
 * Generates scannable QR codes entirely on-device with zero external network requests.
 */

interface VersionSpec {
  version: number;
  size: number;
  dataCodewords: number;
  ecCodewords: number;
  alignment: number[];
}

const VERSION_SPECS: VersionSpec[] = [
  { version: 1, size: 21, dataCodewords: 19, ecCodewords: 7, alignment: [] },
  { version: 2, size: 25, dataCodewords: 34, ecCodewords: 10, alignment: [6, 18] },
  { version: 3, size: 29, dataCodewords: 55, ecCodewords: 15, alignment: [6, 22] },
  { version: 4, size: 33, dataCodewords: 80, ecCodewords: 20, alignment: [6, 26] },
  { version: 5, size: 37, dataCodewords: 108, ecCodewords: 26, alignment: [6, 30] },
  { version: 6, size: 41, dataCodewords: 136, ecCodewords: 36, alignment: [6, 34] }, // 2 blocks of 68 data + 18 ec
];

// GF(256) with primitive polynomial 0x11d
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    EXP[i] = EXP[i - 255];
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}

function rsGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const root = EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], root);
    }
    poly = next;
  }
  return poly;
}

function rsComputeRemainder(data: Uint8Array, ecLen: number): Uint8Array {
  const gen = rsGeneratorPoly(ecLen);
  const rem = new Uint8Array(ecLen);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ rem[0];
    rem.copyWithin(0, 1);
    rem[ecLen - 1] = 0;
    if (factor !== 0) {
      for (let j = 0; j < ecLen; j++) {
        rem[j] ^= gfMul(gen[j + 1], factor);
      }
    }
  }
  return rem;
}

// Precomputed 15-bit format info for ECC Level L (01), masks 0..7, BCH-encoded and XORed with 0x5412
const FORMAT_BITS_L = [
  0x77c4, 0x72f3, 0x7daa, 0x789d, 0x662f, 0x6318, 0x6c41, 0x6976,
];

export function generateQrMatrix(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  // Pick smallest version 1..6 that fits byte mode (4-bit mode + 8-bit count + payload)
  const spec =
    VERSION_SPECS.find((s) => bytes.length + 2 <= s.dataCodewords) ??
    VERSION_SPECS[VERSION_SPECS.length - 1];
  const payload =
    bytes.length + 2 <= spec.dataCodewords
      ? bytes
      : bytes.slice(0, spec.dataCodewords - 2);

  // Build bit buffer
  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >> i) & 1);
    }
  };

  pushBits(0b0100, 4); // Byte mode
  pushBits(payload.length, 8);
  for (const b of payload) pushBits(b, 8);

  const maxBits = spec.dataCodewords * 8;
  const terminator = Math.min(4, maxBits - bits.length);
  pushBits(0, terminator);
  while (bits.length % 8 !== 0) bits.push(0);

  const dataBytes = new Uint8Array(spec.dataCodewords);
  for (let i = 0; i < bits.length / 8; i++) {
    let byte = 0;
    for (let b = 0; b < 8; b++) {
      byte = (byte << 1) | bits[i * 8 + b];
    }
    dataBytes[i] = byte;
  }
  const padBytes = [0xec, 0x11];
  for (let i = bits.length / 8, p = 0; i < spec.dataCodewords; i++, p++) {
    dataBytes[i] = padBytes[p % 2];
  }

  // Interleave codewords (Version 6-L uses 2 blocks; Versions 1..5-L use 1 block)
  let allCodewords: Uint8Array;
  if (spec.version === 6) {
    const b1 = dataBytes.slice(0, 68);
    const b2 = dataBytes.slice(68, 136);
    const ec1 = rsComputeRemainder(b1, 18);
    const ec2 = rsComputeRemainder(b2, 18);
    allCodewords = new Uint8Array(172);
    let k = 0;
    for (let i = 0; i < 68; i++) {
      allCodewords[k++] = b1[i];
      allCodewords[k++] = b2[i];
    }
    for (let i = 0; i < 18; i++) {
      allCodewords[k++] = ec1[i];
      allCodewords[k++] = ec2[i];
    }
  } else {
    const ec = rsComputeRemainder(dataBytes, spec.ecCodewords);
    allCodewords = new Uint8Array(spec.dataCodewords + spec.ecCodewords);
    allCodewords.set(dataBytes, 0);
    allCodewords.set(ec, spec.dataCodewords);
  }

  const size = spec.size;
  const modules: boolean[][] = Array.from({ length: size }, () =>
    Array<boolean>(size).fill(false),
  );
  const isFunction: boolean[][] = Array.from({ length: size }, () =>
    Array<boolean>(size).fill(false),
  );

  const setFunction = (r: number, c: number, dark: boolean) => {
    if (r < 0 || r >= size || c < 0 || c >= size) return;
    modules[r][c] = dark;
    isFunction[r][c] = true;
  };

  // Finder patterns + separators
  const drawFinder = (top: number, left: number) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
        const onRing = dr === 0 || dr === 6 || dc === 0 || dc === 6;
        const inCore = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        setFunction(top + dr, left + dc, inOuter && (onRing || inCore));
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    setFunction(6, i, i % 2 === 0);
    setFunction(i, 6, i % 2 === 0);
  }

  // Alignment patterns
  const align = spec.alignment;
  for (let i = 0; i < align.length; i++) {
    for (let j = 0; j < align.length; j++) {
      if (
        (i === 0 && j === 0) ||
        (i === 0 && j === align.length - 1) ||
        (i === align.length - 1 && j === 0)
      ) {
        continue;
      }
      const cr = align[i];
      const cc = align[j];
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dark =
            Math.max(Math.abs(dr), Math.abs(dc)) === 2 || (dr === 0 && dc === 0);
          setFunction(cr + dr, cc + dc, dark);
        }
      }
    }
  }

  // Reserve format info & dark module
  for (let i = 0; i <= 8; i++) {
    if (i !== 6) {
      setFunction(8, i, false);
      setFunction(i, 8, false);
    }
  }
  for (let i = 0; i < 8; i++) {
    setFunction(8, size - 1 - i, false);
    setFunction(size - 1 - i, 8, false);
  }
  setFunction(size - 8, 8, true); // Dark module

  // Place data bits in upward/downward 2-column zigzag
  let bitIdx = 0;
  const totalBits = allCodewords.length * 8;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      const r = upward ? size - 1 - vert : vert;
      for (let j = 0; j < 2; j++) {
        const c = right - j;
        if (!isFunction[r][c]) {
          let dark = false;
          if (bitIdx < totalBits) {
            dark = ((allCodewords[bitIdx >> 3] >> (7 - (bitIdx & 7))) & 1) === 1;
            bitIdx++;
          }
          // Apply mask 0: (r + c) % 2 === 0
          if ((r + c) % 2 === 0) dark = !dark;
          modules[r][c] = dark;
        }
      }
    }
    upward = !upward;
  }

  // Write format bits for mask 0 (Level L)
  const fmt = FORMAT_BITS_L[0];
  const fmtBit = (i: number) => ((fmt >> i) & 1) === 1;
  for (let i = 0; i <= 5; i++) setFunction(8, i, fmtBit(14 - i));
  setFunction(8, 7, fmtBit(8));
  setFunction(8, 8, fmtBit(7));
  setFunction(7, 8, fmtBit(6));
  for (let i = 9; i < 15; i++) setFunction(14 - i, 8, fmtBit(14 - i));

  for (let i = 0; i < 8; i++) setFunction(8, size - 1 - i, fmtBit(i));
  for (let i = 8; i < 15; i++) setFunction(size - 15 + i, 8, fmtBit(i));
  setFunction(size - 8, 8, true);

  return modules;
}
