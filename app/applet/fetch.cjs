const https = require('https');

const url = "https://raw.githubusercontent.com/google/xrblocks/main/demos/rain/index.html";
https.get(url, { headers: { "User-Agent": "Node.js" } }, res => {
  let data = "";
  res.on("data", c => data += c);
  res.on("end", () => console.log(data));
});
