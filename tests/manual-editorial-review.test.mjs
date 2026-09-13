import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('legacy bulk approval and generation/save cannot reach the backend', async () => {
 const server = await createServer({configFile:false,server:{middlewareMode:true},appType:'custom'});
 const original = globalThis.fetch;
 try {
  const bulk = await server.ssrLoadModule('/src/pages/api/dashboard/content-audit/fixes/bulk.ts');
  const fix = await server.ssrLoadModule('/src/pages/api/dashboard/content-quality/fix.ts');
  globalThis.fetch = async () => { throw Error('retired write route contacted backend'); };
  const form = new FormData(); form.set('action','apply'); form.set('fix_preview_ids','[1,2]');
  const ctx = {request:new Request('http://localhost/api',{method:'POST',body:form}),cookies:{get:()=>({value:'session'})},locals:{countryId:'1'},redirect:url=>new Response(null,{status:302,headers:{Location:url}})};
  const rejected = await bulk.POST(ctx);
  assert.match(rejected.headers.get('Location'), /error=/);
  assert.equal((await fix.POST(ctx)).status,409);
 } finally { globalThis.fetch = original; await server.close(); }
});

test('legacy auto-apply batch requests become preview-only requests', async () => {
 const server = await createServer({configFile:false,server:{middlewareMode:true},appType:'custom'});
 const original = globalThis.fetch;
 try {
  const {previewOnlyMode} = await server.ssrLoadModule('/src/features/content-audit/readiness-types.ts');
  for (const value of ['auto_apply','unknown',undefined]) assert.equal(previewOnlyMode(value,'auto_repair'),'fix_preview');
  assert.equal(previewOnlyMode('analyze_only','analyze'),'analyze_only');
  const route = await server.ssrLoadModule('/src/pages/api/dashboard/content-audit/batches/start.ts');
  let sent;
  globalThis.fetch = async (_url,options) => { sent=JSON.parse(options.body); return Response.json({success:true,data:{id:'preview-job'}}); };
  const form = new FormData();form.set('mode','auto_apply');form.set('preset','meta_description');
  const result = await route.POST({request:new Request('http://localhost/api',{method:'POST',body:form}),cookies:{get:()=>({value:'session'})},locals:{countryId:'1'},redirect:url=>new Response(null,{status:302,headers:{Location:url}})});
  assert.equal(sent.mode,'fix_preview');assert.match(result.headers.get('Location'),/success=batch_started/);
 } finally { globalThis.fetch = original; await server.close(); }
});

test('article save preserves reviewed empty metadata instead of silently generating text', async () => {
 const server = await createServer({configFile:false,server:{middlewareMode:true},appType:'custom'});
 const original = globalThis.fetch;
 try {
  const route = await server.ssrLoadModule('/src/pages/api/dashboard/articles/save.ts');
  let saved;
  globalThis.fetch = async (url,options) => {
   if(String(url).endsWith('/dashboard/articles')) saved=JSON.parse(options.body);
   return Response.json({success:true,data:{id:51}});
  };
  const form = new FormData();form.set('title','عنوان للمراجعة');form.set('content','نص راجعه المحرر');form.set('meta_description','');form.set('keywords','');
  const response = await route.POST({request:new Request('http://localhost/api',{method:'POST',body:form,headers:{'X-Requested-With':'fetch'}}),cookies:{get:()=>({value:'session'})},locals:{countryId:'1'},cache:{invalidate:async()=>{}},redirect:()=>{throw Error('unexpected redirect');}});
  assert.equal(response.status,200);assert.equal(saved.meta_description,'');assert.equal(saved.keywords,'');
 } finally { globalThis.fetch = original; await server.close(); }
});
