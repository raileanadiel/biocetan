// Generates the raster icons from public/favicon.svg. Re-run (`npm run icons`) when the real logo mark replaces the placeholder.
import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';

const svg = await readFile(new URL('../public/favicon.svg', import.meta.url));
const out = (name) => new URL(`../public/${name}`, import.meta.url);
const png = (size) => sharp(svg, { density: 384 }).resize(size, size).png().toBuffer();

await writeFile(out('apple-touch-icon.png'), await png(180));
await writeFile(out('icon-192.png'), await png(192));
await writeFile(out('icon-512.png'), await png(512));

// favicon.ico = ICO container holding one 32×32 PNG (supported by all current browsers).
const image = await png(32);
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(1, 4); // image count
header.writeUInt8(32, 6); // width
header.writeUInt8(32, 7); // height
header.writeUInt16LE(1, 10); // colour planes
header.writeUInt16LE(32, 12); // bits per pixel
header.writeUInt32LE(image.length, 14); // image size
header.writeUInt32LE(22, 18); // image offset
await writeFile(out('favicon.ico'), Buffer.concat([header, image]));

console.log('icons written to public/');
