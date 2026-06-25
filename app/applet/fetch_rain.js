import https from 'https';
import fs from 'fs';
import path from 'path';

const files = [
  'RainScene.js',
  'RainParticles.js'
];

const baseUrl = 'https://raw.githubusercontent.com/google/xrblocks/main/demos/rain/';

for (const file of files) {
  https.get(baseUrl + file, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      fs.writeFileSync(path.join(process.cwd(), 'src', file), data);
      console.log('Downloaded', file);
    });
  });
}
