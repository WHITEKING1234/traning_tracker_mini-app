import { writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  const crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function rgba(hex, alpha = 255) {
  const value = hex.replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
    alpha,
  ];
}

function blend(base, top, amount) {
  return base.map((channel, index) => (index === 3 ? 255 : Math.round(channel * (1 - amount) + top[index] * amount)));
}

function setPixel(pixels, size, x, y, color) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const index = (y * size + x) * 4;
  pixels[index] = color[0];
  pixels[index + 1] = color[1];
  pixels[index + 2] = color[2];
  pixels[index + 3] = color[3];
}

function drawLine(pixels, size, x1, y1, x2, y2, width, color) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) * 2;
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    const x = Math.round(x1 + (x2 - x1) * t);
    const y = Math.round(y1 + (y2 - y1) * t);
    for (let dy = -width; dy <= width; dy += 1) {
      for (let dx = -width; dx <= width; dx += 1) {
        if (dx * dx + dy * dy <= width * width) setPixel(pixels, size, x + dx, y + dy, color);
      }
    }
  }
}

function makeIcon(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const bg = rgba("#050507");
  const surface = rgba("#101115");
  const green = rgba("#18f28b");
  const blue = rgba("#54b7ff");
  const cx = size / 2;
  const cy = size / 2;
  const outer = size * 0.38;
  const inner = size * 0.31;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const glow = Math.max(0, 1 - distance / (size * 0.72));
      const color = blend(bg, surface, 0.35 + glow * 0.34);
      setPixel(pixels, size, x, y, color);

      if (distance > inner && distance < outer) {
        setPixel(pixels, size, x, y, green);
      }
    }
  }

  drawLine(pixels, size, size * 0.28, size * 0.58, size * 0.42, size * 0.43, Math.round(size * 0.025), blue);
  drawLine(pixels, size, size * 0.42, size * 0.43, size * 0.53, size * 0.55, Math.round(size * 0.025), blue);
  drawLine(pixels, size, size * 0.53, size * 0.55, size * 0.72, size * 0.33, Math.round(size * 0.025), blue);

  const dotRadius = size * 0.045;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x - size * 0.72;
      const dy = y - size * 0.33;
      if (Math.sqrt(dx * dx + dy * dy) < dotRadius) setPixel(pixels, size, x, y, green);
    }
  }

  const rawRows = [];
  for (let y = 0; y < size; y += 1) {
    rawRows.push(Buffer.from([0]));
    rawRows.push(pixels.subarray(y * size * 4, (y + 1) * size * 4));
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  return Buffer.concat([
    PNG_SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(rawRows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

await writeFile("public/apple-touch-icon.png", makeIcon(180));
await writeFile("public/icon-192.png", makeIcon(192));
await writeFile("public/icon-512.png", makeIcon(512));
