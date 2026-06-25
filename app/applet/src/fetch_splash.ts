import https from 'https';
import fs from 'fs';
import path from 'path';

const files = ['main.js', 'SplashParticles.js', 'WaterSplash.js', 'SplashScene.js', 'Splash.js'];
const baseUrl = "https://raw.githubusercontent.com/google/xrblocks/main/demos/splash/";

function fetchFile(file) {
  return new Promise((resolve) => {
    https.get(baseUrl + file, (res) => {
      if (res.statusCode !== 200) {
        resolve(`${file}: 404`);
        return;
      }
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        fs.writeFileSync(path.join(process.cwd(), "public", file), data);
        resolve(`${file}: downloaded`);
      });
    });
  });
}

async function run() {
  for (const f of files) {
    const res = await fetchFile(f);
    console.log(res);
  }
}
run();
