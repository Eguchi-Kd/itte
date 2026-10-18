// アイコンを書き出す使い捨てのスクリプト（§10.2）。依存を増やさず、Node 標準の zlib で PNG を作る
// 図柄: 単色の背景にコマ（将棋の駒の五角形と点の目2つ）。maskable のため、図柄は中央 80% の円の内側に収める
// 使い方: node scripts/gen-icons.mjs
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [0x25, 0x63, 0xeb]; // --primary（theme_color）
const WOOD = [0xe9, 0xc9, 0x8b]; // --wood
const EDGE = [0x8a, 0x6a, 0x3b]; // --wood-edge

// コマの形（Koma.tsx と同じ 100 単位の座標）
const PIECE = [
  [50, 6],
  [80, 22],
  [90, 88],
  [10, 88],
  [20, 22],
];
const EYES = [
  [38, 50],
  [62, 50],
];
const EYE_R = 5.5;
const EDGE_W = 4;

function insidePolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distToSegment(x, y, [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}

/** 100 単位の座標の1点の色 */
function colorAt(u, v) {
  for (const [ex, ey] of EYES) if (Math.hypot(u - ex, v - ey) <= EYE_R) return EDGE;
  let d = Infinity;
  for (let i = 0; i < PIECE.length; i++) d = Math.min(d, distToSegment(u, v, PIECE[i], PIECE[(i + 1) % PIECE.length]));
  if (d <= EDGE_W / 2) return EDGE;
  if (insidePolygon(u, v, PIECE)) return WOOD;
  return BG;
}

function render(size) {
  const SS = 4; // 1画素あたり 4×4 のサンプルでなめらかにする
  const scale = 0.6; // 図柄を中央 60% に置く（maskable の安全域 80% の内側）
  const offset = (1 - scale) / 2;
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    row[0] = 0; // フィルタなし
    for (let x = 0; x < size; x++) {
      const acc = [0, 0, 0];
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = (x + (sx + 0.5) / SS) / size;
          const py = (y + (sy + 0.5) / SS) / size;
          const c = colorAt(((px - offset) / scale) * 100, ((py - offset) / scale) * 100 + 3);
          acc[0] += c[0];
          acc[1] += c[1];
          acc[2] += c[2];
        }
      }
      const n = SS * SS;
      row[1 + x * 4] = Math.round(acc[0] / n);
      row[2 + x * 4] = Math.round(acc[1] / n);
      row[3 + x * 4] = Math.round(acc[2] / n);
      row[4 + x * 4] = 255;
    }
    rows.push(row);
  }
  return Buffer.concat(rows);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // ビット深度
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(render(size), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const [name, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  writeFileSync(`public/${name}`, png(size));
  console.log(`public/${name} ${size}x${size}`);
}
