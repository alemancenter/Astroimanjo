// Build + HTTP smoke test against a local fixture API. Never calls production.
import http from 'node:http';
import sharp from 'sharp';
const fixturePNG = await sharp({create:{width:2,height:2,channels:3,background:'#ffffff'}}).png().toBuffer();
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import assert from 'node:assert/strict';
const api=http.createServer((req,res)=>{
 if(req.url.startsWith('/storage/')){res.writeHead(200,{'Content-Type':'image/png'});return res.end(fixturePNG);}
 if(req.url.includes('/download-url')){res.writeHead(401,{'Content-Type':'application/json'});return res.end(JSON.stringify({success:false,message:'AUTH_REQUIRED'}));}
 res.writeHead(200,{'Content-Type':'application/json'});
 const data=req.url.startsWith('/api/front/settings')?{site_name:'ImanJo Test',maintenance_mode:'false'}:req.url.startsWith('/api/home')?{articles:[],posts:[],featured_posts:[],categories:[],classes:[],settings:{}}:req.url.includes('/team')?[]:{};
 res.end(JSON.stringify({success:true,data}));
});
api.listen(0,'127.0.0.1');await once(api,'listening');
const apiOrigin=`http://127.0.0.1:${api.address().port}`;
const probe=http.createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(r=>probe.close(r));
const site=`http://127.0.0.1:${port}`;
const env={...process.env,PUBLIC_API_URL:apiOrigin+'/api',INTERNAL_API_URL:apiOrigin+'/api',PUBLIC_SITE_URL:site,FRONTEND_API_KEY:'local-smoke-fixture-only',ASTRO_TELEMETRY_DISABLED:'1',ASTRO_NODE_LOGGING:'disabled',HOST:'127.0.0.1',PORT:String(port)};
let app;
try{
 const build=spawn(process.execPath,['node_modules/astro/bin/astro.mjs','build'],{env,stdio:'inherit'});
 const [code]=await once(build,'exit');assert.equal(code,0,'Astro build failed');
 app=spawn(process.execPath,['dist/server/entry.mjs'],{env,stdio:'inherit'});
 const deadline=Date.now()+15000;
 for(;;){try{const response=await fetch(site+'/login');if(response.status===200)break;}catch{}if(Date.now()>deadline)throw Error('SSR server did not start');await new Promise(r=>setTimeout(r,100));}
 for(const route of ['/','/login','/about','/robots.txt']){const response=await fetch(site+route);assert.equal(response.status,200,route);}
 const forged=await fetch(site+'/api/auth/login',{method:'POST',headers:{Origin:'https://attacker.example','Content-Type':'application/x-www-form-urlencoded'},body:'email=a%40b.test&password=abc',redirect:'manual'});assert.equal(forged.status,403);
 const download=await fetch(site+'/api/download/article-file/1',{redirect:'manual'});assert.equal(download.status,302);assert.ok(download.headers.get('location').startsWith('/login'));
 const invalid=await fetch(site+'/api/img?src='+encodeURIComponent('../private/proof.png'));assert.equal(invalid.status,404);
 const image=await fetch(site+'/api/img?src=images/test.png&w=96');assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/webp');assert.ok((await image.arrayBuffer()).byteLength>0);
 console.log('PASS: build and 8 HTTP smoke checks (local fixture API).');
}finally{if(app){app.kill('SIGTERM');await once(app,'exit').catch(()=>{});}api.closeAllConnections();await new Promise(r=>api.close(r));}
