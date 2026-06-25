const fs = require('fs');
const path = require('path');

const files = ['main.js', 'SplashParticles.js', 'WaterSplash.js', 'SplashScene.js', 'Splash.js'];
const baseUrl = "https://raw.githubusercontent.com/google/xrblocks/main/demos/splash/";

async function fetchFile(file) {
  const response = await fetch(baseUrl + file);
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
