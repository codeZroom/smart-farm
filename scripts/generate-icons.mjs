import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
// Small deterministic PNG encoder; icons are vector-like geometry rendered to RGBA.
const crc = (b) => {
  let c = 0xffffffff;
  for (const x of b) {
    c ^= x;
    for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(t, b) {
  const name = Buffer.from(t),
    len = Buffer.alloc(4),
    check = Buffer.alloc(4);
  len.writeUInt32BE(b.length);
  check.writeUInt32BE(crc(Buffer.concat([name, b])));
  return Buffer.concat([len, name, b, check]);
}
function icon(size, path) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size,
        v = y / size;
      const left =
        ((u - 0.38) / 0.17) ** 2 + ((v - 0.39) / 0.105) ** 2 < 1 && v > 0.35;
      const right =
        ((u - 0.62) / 0.17) ** 2 + ((v - 0.32) / 0.12) ** 2 < 1 && v > 0.27;
      const stem = Math.abs(u - 0.5) < 0.025 && v > 0.36 && v < 0.73;
      const rgb = left || right || stem ? [220, 238, 199] : [23, 63, 53];
      const i = y * (size * 4 + 1) + 1 + x * 4;
      raw.set([...rgb, 255], i);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  writeFileSync(
    path,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk("IHDR", header),
      chunk("IDAT", deflateSync(raw)),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
}
mkdirSync("apps/web/public/icons", { recursive: true });
for (const size of [192, 512])
  icon(size, `apps/web/public/icons/icon-${size}.png`);
icon(512, "apps/web/public/icons/maskable-512.png");
