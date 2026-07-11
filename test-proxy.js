const { createServer } = require("http");

const server = createServer((req, res) => {
  let body = [];
  req.on("data", chunk => body.push(chunk));
  req.on("end", () => {
    const full = Buffer.concat(body);
    console.log("Method:", req.method);
    console.log("Headers:", req.headers);
    console.log("Body length:", full.length);
    if (full.length >= 3) {
      console.log("Magic bytes:", full[0].toString(16), full[1].toString(16), full[2].toString(16));
    }
    res.statusCode = 200;
    res.end('{"ok":true}');
  });
});

server.listen(3002, () => {
  console.log("Test backend on 3002");
});
