// Builds the small map thumbnails in public/maps/ from OpenStreetMap tiles, one per location.
// Run once after adding a location: node scripts/build-location-maps.mjs
// Map data © OpenStreetMap contributors (ODbL); tiles from tile.openstreetmap.org, fetched sparingly
// with an identifying User-Agent per the OSM tile usage policy.
import { mkdir, readFile } from "node:fs/promises";
import sharp from "sharp";

const ZOOM = 16;
const CROP = 224; // source pixels around the pin
const OUT = 112; // 2x the 56 px thumbnail

const source = await readFile(new URL("../lib/demo/locations.ts", import.meta.url), "utf8");
const locations = [...source.matchAll(/location\(\s*"([^"]+)",\s*"[^"]+",\s*"[^"]+",\s*([-\d.]+),\s*([-\d.]+)/g)].map(
  ([, id, lat, lng]) => ({ id, lat: Number(lat), lng: Number(lng) }),
);

function worldPixel(lat, lng) {
  const scale = 256 * 2 ** ZOOM;
  const sin = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

async function tile(x, y) {
  const response = await fetch(`https://tile.openstreetmap.org/${ZOOM}/${x}/${y}.png`, {
    headers: { "User-Agent": "dripbar-amplifier-demo map thumbnail build (one-off)" },
  });
  if (!response.ok) throw new Error(`tile ${x}/${y}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

await mkdir(new URL("../public/maps/", import.meta.url), { recursive: true });

for (const { id, lat, lng } of locations) {
  const center = worldPixel(lat, lng);
  const left = Math.round(center.x - CROP / 2);
  const top = Math.round(center.y - CROP / 2);
  const tx0 = Math.floor(left / 256);
  const ty0 = Math.floor(top / 256);
  const tx1 = Math.floor((left + CROP - 1) / 256);
  const ty1 = Math.floor((top + CROP - 1) / 256);

  const composites = [];
  for (let tx = tx0; tx <= tx1; tx++) {
    for (let ty = ty0; ty <= ty1; ty++) {
      composites.push({ input: await tile(tx, ty), left: (tx - tx0) * 256, top: (ty - ty0) * 256 });
    }
  }

  const mosaic = await sharp({
    create: { width: (tx1 - tx0 + 1) * 256, height: (ty1 - ty0 + 1) * 256, channels: 3, background: "#f2efe9" },
  })
    .composite(composites)
    .png()
    .toBuffer();

  await sharp(mosaic)
    .extract({ left: left - tx0 * 256, top: top - ty0 * 256, width: CROP, height: CROP })
    .resize(OUT, OUT)
    .webp({ quality: 82 })
    .toFile(new URL(`../public/maps/${id}.webp`, import.meta.url).pathname);
  console.log(id);
}
