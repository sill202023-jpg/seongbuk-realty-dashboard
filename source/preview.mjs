import http from 'node:http';
import app from './dist/server/index.js';
const env={...process.env};
if(process.argv.includes('--saved-keys')){
  process.stderr.write('Ready for saved Site access on stdin (input is hidden).\n');
  if(process.stdin.isTTY)process.stdin.setRawMode(true);
  const raw=await new Promise(resolve=>{let b='';process.stdin.setEncoding('utf8');process.stdin.on('data',function listener(c){b+=c;if(/[\r\n]/.test(b)){process.stdin.off('data',listener);process.stdin.pause();if(process.stdin.isTTY)process.stdin.setRawMode(false);resolve(b.trim())}})});
  const config=JSON.parse(raw);env.REMOTE_SITE_TOKEN=config.token;env.REMOTE_SITE_URL=config.url;
}
http.createServer(async(req,res)=>{try{const r=await app.fetch(new Request('http://localhost:4173'+req.url),env);res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()))}catch{res.writeHead(500);res.end('Server error')}}).listen(4173,'0.0.0.0',()=>console.log('Local: http://localhost:4173'));