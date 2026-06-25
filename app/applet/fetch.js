import https from "node:https";

const url = "https://api.github.com/repos/google/xrblocks/contents/demos/rain";
https.get(url, { headers: { "User-Agent": "Node.js" } }, res => {
  let data = "";
  res.on("data", c => data += c);
  res.on("end", () => console.log(data));
});
