const fs = require('fs');

function fix(path) {
  let content = fs.readFileSync(path, 'utf8');
  content = content.replace(/body: req\.body,\n\s*\/\/ @ts-expect-error - Next\.js proxy stream requires duplex\n\s*duplex: "half",/g, 'body: Buffer.from(await req.arrayBuffer()),');
  // and remove the manual content length
  content = content.replace(/\.\.\.\(contentLength \? \{ "Content-Length": contentLength \} : \{\}\),/g, '');
  // remove the contentLength = ...
  content = content.replace(/const contentLength = req\.headers\.get\("content-length"\)\?\.trim\(\);\n/g, '');
  fs.writeFileSync(path, content);
}

fix('/home/hamed/Music/docs/apps/web/app/api/identity/me/avatar/route.ts');
fix('/home/hamed/Music/docs/apps/web/app/api/settings/branding/logo/route.ts');
