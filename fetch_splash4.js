import fs from 'fs';
import path from 'path';

const files = ['PaintSplash.js'];
const baseUrl = "https://raw.githubusercontent.com/google/xrblocks/main/demos/splash/";

async function fetchFile(file) {
  const response = await fetch(baseUrl + file, { headers: { 'User-Agent': 'Node.js' } });
  if (response.ok) {
    const data = await response.text();
    fs.writeFileSync(path.join(process.cwd(), "public", file), data);
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
