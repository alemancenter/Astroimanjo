import type {APIRoute} from 'astro';
import {apiFetch,apiRawFetch} from '../../../../../lib/api';
export const prerender=false;
export const POST:APIRoute=async({request,cookies,locals,redirect})=>{
	const token=cookies.get('token')?.value;if(!token)return redirect('/login');const f=await request.formData(),countryCode=String(f.get('country_code')||'jo');const cookieHeader=`token=${token}`;
	const content=await apiFetch<any[]>('/dashboard/seo/content',{countryId:locals.countryId,cookieHeader,params:{type:'all',per_page:100,page:1}});const origin=(import.meta.env.PUBLIC_SITE_URL||'https://imanjo.com').replace(/\/$/,'');
	const targets=(content.data||[]).filter((item:any)=>item.published&&item.robots_index!==false).map((item:any)=>({content_type:item.content_type,content_id:item.content_id,url:`${origin}/${countryCode}/${item.content_type==='article'?'lesson/articles':'posts'}/${item.content_id}`}));
	const response=await apiRawFetch('/dashboard/gsc/sync',{method:'POST',countryId:locals.countryId,cookieHeader,headers:{'Content-Type':'application/json'},body:JSON.stringify({country_code:countryCode,targets})});const json:any=await response.json().catch(()=>null);return redirect(response.ok?'/dashboard/seo/search-console?success=index-sync':`/dashboard/seo/search-console?error=${encodeURIComponent(json?.message||'تعذّر فحص الفهرسة')}`);
};
