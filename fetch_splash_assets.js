import fs from 'fs';
import path from 'path';

const files = ['decal-diffuse1.webp', 'decal-normal1.webp'];
const baseUrl = "https://raw.githubusercontent.com/google/xrblocks/main/demos/splash/paintball_assets/";

async function fetchFile(file) {
  const dir = path.join(process.cwd(), "public", "paintball_assets");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  
  const response = await fetch(baseUrl + file);
  if (response.ok) {
    const arrayBuffer = await response.arrayBuffer();
    fs.writeFileSync(path.join(dir, file), Buffer.from(arrayBuffer));
    console.log(`Downloaded ${file}`);
  } else {
    console.error(`Failed to download ${file}: ${response.statusText}`);
  }
}

async function run() {
  for (const f of files) {
    await fetchFile(f);
  }
  process.exit(0);
}
run();
