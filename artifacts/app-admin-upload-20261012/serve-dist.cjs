// Read-only, localhost production build preview. No development transforms or APIs.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../web/dist'),port=Number(process.env.SPOTLOG_RELEASE_PORT||5312);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.woff':'font/woff','.woff2':'font/woff2','.mp4':'video/mp4','.wasm':'application/wasm'};
http.createServer((request,response)=>{
  let pathname;try{pathname=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname);}catch{response.writeHead(400);response.end();return;}
  if(!pathname.startsWith('/spotlog/')){response.writeHead(404,{'Content-Type':'text/html'});response.end('<!doctype html><title>Not found</title>');return;}
  const relative=pathname.slice('/spotlog/'.length)||'index.html',file=path.resolve(root,relative);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){response.writeHead(404,{'Content-Type':'text/html'});response.end('<!doctype html><title>Not found</title>');return;}
  response.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(file).pipe(response);
}).listen(port,'127.0.0.1',()=>console.log('Static release preview: http://127.0.0.1:'+port+'/spotlog/'));
