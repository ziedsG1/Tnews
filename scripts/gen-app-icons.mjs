import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const src = path.join(root, "assets", "icon-source.png");
const publicDir = path.join(root, "public");

const meta = await sharp(src).metadata();
const side = Math.min(meta.width ?? 0, meta.height ?? 0);
const left = Math.floor(((meta.width ?? 0) - side) / 2);
const top = Math.floor(((meta.height ?? 0) - side) / 2);

const square = await sharp(src)
  .extract({ left, top, width: side, height: side })
  .png()
  .toBuffer();

const sizes = [
  ["apple-touch-icon.png", 180],
  ["favicon.png", 32],
  ["icon-512.png", 512],
];

for (const [name, px] of sizes) {
  await sharp(square).resize(px, px).png().toFile(path.join(publicDir, name));
  console.log(`wrote ${name} (${px}x${px})`);
}
