import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
test('actual session resolver refreshes without access cookie; single refresh shared across concurrent callers',async()=>{
 const server=await createServer({configFile:false,server:{middlewareMode:true},appType:'custom'});
 const originalFetch=globalThis.fetch;
 try {
  const auth=await server.ssrLoadModule('/src/lib/auth.ts');
  let refreshes=0;
  globalThis.fetch=async(url)=>{
   if(String(url).includes('/auth/refresh')){refreshes++;return Response.json({success:true,data:{token:'new-access',refresh_token:'new-refresh'}});}
   return Response.json({success:true,data:{id:7,name:'Test',roles:[]}});
  };
  function context(){const jar=new Map([['refresh_token','shared-refresh']]);return {locals:{countryId:'1'},cookies:{get:k=>jar.has(k)?{value:jar.get(k)}:undefined,set:(k,v)=>jar.set(k,v),delete:k=>jar.delete(k)},jar};}
  const a=context(),b=context();const users=await Promise.all([auth.getCurrentUser(a),auth.getCurrentUser(b)]);
  assert.equal(refreshes,1);assert.equal(users[0].id,7);assert.equal(a.jar.get('token'),'new-access');assert.equal(b.jar.get('token'),'new-access');
  const fail=context();fail.jar.set('refresh_token','unavailable-refresh');globalThis.fetch=async()=>Response.json({success:false},{status:503});
  assert.equal(await auth.getCurrentUser(fail),null);assert.equal(fail.jar.get('refresh_token'),'unavailable-refresh');
 } finally {globalThis.fetch=originalFetch;await server.close();}
});

test('article remains saved when attachment linking and SEO fail',async()=>{
 const server=await createServer({configFile:false,server:{middlewareMode:true},appType:'custom'});
 const originalFetch=globalThis.fetch;
 try {
  const route=await server.ssrLoadModule('/src/pages/api/dashboard/articles/save.ts');
  let created=0;
  globalThis.fetch=async(url)=>{
   if(String(url).endsWith('/dashboard/articles')){created++;return Response.json({success:true,data:{id:99}},{status:201});}
   if(String(url).includes('/seo/metadata/'))throw new Error('simulated SEO disconnect');
   return Response.json({success:false,message:'link unavailable'},{status:503});
  };
  const form=new FormData();form.set('title','عنوان اختبار');form.set('content','محتوى اختبار');
  const response=await route.POST({request:new Request('http://localhost/api/dashboard/articles/save',{method:'POST',body:form,headers:{'X-Requested-With':'fetch'}}),cookies:{get:()=>({value:'token'})},locals:{countryId:'1'},cache:{invalidate:async()=>{}},redirect:()=>{throw Error('unexpected redirect');}});
  const body=await response.json();assert.equal(response.status,200);assert.equal(body.success,true);assert.equal(body.id,99);assert.ok(body.seo_warning);assert.equal(created,1);
 }finally{globalThis.fetch=originalFetch;await server.close();}
});
