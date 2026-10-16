/**
 * Renders the JobTrack brand mark (src/components/layout/brand.tsx in the web
 * app) to public/icon/<size>.png with Node built-ins only. Re-run after
 * changing the mark: node scripts/generate-icons.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const SIZES = [16, 32, 48, 128];
const BRAND = [0x12, 0x6d, 0x50];
const WHITE = [0xff, 0xff, 0xff];
const MINT = [0x9a, 0xd7, 0xb5];
// Paths in the mark's 30x30 viewBox, stroke width 3.1 with round caps/joins.
const STROKES = [
  {
    color: WHITE,
    points: [
      [6, 19],
      [13, 8],
      [18, 17],
      [23, 10],
    ],
  },
  {
    color: MINT,
    points: [
      [6, 25],
      [23, 25],
    ],
  },
];
const STROKE_RADIUS = 3.1 / 2;
const CORNER_RADIUS = 7;
const SAMPLES = 4;

function distanceToSegment([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function insideRoundedSquare(x, y) {
  const cx = Math.max(CORNER_RADIUS, Math.min(30 - CORNER_RADIUS, x));
  const cy = Math.max(CORNER_RADIUS, Math.min(30 - CORNER_RADIUS, y));
  return Math.hypot(x - cx, y - cy) <= CORNER_RADIUS;
}

/** RGBA color of one point of the mark, or null outside it. */
function colorAt(x, y) {
  if (!insideRoundedSquare(x, y)) return null;
  for (const { color, points } of STROKES) {
    for (let i = 1; i < points.length; i++) {
      if (distanceToSegment([x, y], points[i - 1], points[i]) <= STROKE_RADIUS) return color;
    }
  }
  return BRAND;
}

function render(size) {
  const pixels = Buffer.alloc(size * size * 4);
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const sum = [0, 0, 0, 0];
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const color = colorAt(
            ((col + (sx + 0.5) / SAMPLES) * 30) / size,
            ((row + (sy + 0.5) / SAMPLES) * 30) / size,
          );
          if (!color) continue;
          sum[0] += color[0];
          sum[1] += color[1];
          sum[2] += color[2];
          sum[3] += 1;
        }
      }
      const offset = (row * size + col) * 4;
      if (sum[3] > 0) {
        pixels[offset] = Math.round(sum[0] / sum[3]);
        pixels[offset + 1] = Math.round(sum[1] / sum[3]);
        pixels[offset + 2] = Math.round(sum[2] / sum[3]);
      }
      pixels[offset + 3] = Math.round((sum[3] / (SAMPLES * SAMPLES)) * 255);
    }
  }
  return pixels;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function png(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA, no interlace
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let row = 0; row < size; row++)
    rgba.copy(raw, row * (size * 4 + 1) + 1, row * size * 4, (row + 1) * size * 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync("public/icon", { recursive: true });
for (const size of SIZES) writeFileSync(`public/icon/${size}.png`, png(size, render(size)));
process.stdout.write(`Wrote public/icon/{${SIZES.join(",")}}.png\n`);
