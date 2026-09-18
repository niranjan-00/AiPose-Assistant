#!/usr/bin/env node
/**
 * Generate simple PNG icons for the AiPose Assistant PWA.
 * No external deps — uses a hand-rolled PNG encoder.
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const ICON_DIR = path.join(__dirname, "..", "public", "icons");
fs.mkdirSync(ICON_DIR, { recursive: true });

function crc32(bytes) {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ bytes[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crcBuf]);
}

function writePNG(size) {
  const width = size;
  const height = size;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const rowSize = width * 3 + 1;
  const raw = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    raw[y * rowSize] = 0; // filter none
    for (let x = 0; x < width; x++) {
      const off = y * rowSize + 1 + x * 3;
      const cx = width / 2;
      const cy = height / 2;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const r = size * 0.3;
      const r2 = size * 0.42;
      let cr, cg, cb;
      if (dist < r) {
        cr = 184; cg = 255; cb = 90;
      } else if (dist < r2) {
        cr = 0; cg = 0; cb = 0;
      } else {
        cr = 0; cg = 0; cb = 0;
      }
      raw[off] = cr;
      raw[off + 1] = cg;
      raw[off + 2] = cb;
    }
  }
  const compressed = zlib.deflateSync(raw);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const icon192 = writePNG(192);
fs.writeFileSync(path.join(ICON_DIR, "icon-192.png"), icon192);
console.log("Wrote icon-192.png (" + icon192.length + " bytes)");

const icon512 = writePNG(512);
fs.writeFileSync(path.join(ICON_DIR, "icon-512.png"), icon512);
console.log("Wrote icon-512.png (" + icon512.length + " bytes)");
