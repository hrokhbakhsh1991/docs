const fs = require('fs');
const buf = Buffer.alloc(12);
// JPEG magic bytes: FF D8 FF
buf[0] = 0xff; buf[1] = 0xd8; buf[2] = 0xff;
fs.writeFileSync('test.jpg', buf);
