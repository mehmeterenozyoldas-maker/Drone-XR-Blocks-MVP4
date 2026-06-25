import https from 'https';
const url = "https://api.github.com/repos/google/xrblocks/contents/demos/splash";
https.get(url, { headers: { "User-Agent": "Node.js" } }, res => {
  let data = "";
  res.on("data", c => data += c);
  res.on("end", () => console.log(JSON.parse(data).map(f => f.name)));
});
