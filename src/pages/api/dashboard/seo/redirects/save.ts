import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../../lib/api';

export const prerender = false;
export const POST: APIRoute = async ({ request, cookies, locals, redirect }) => {
	const token = cookies.get('token')?.value;
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/dashboard/seo/redirects')}`);
	const form = await request.formData(); const id = String(form.get('id') || '');
	const payload = { source_path:String(form.get('source_path')||''), target_url:String(form.get('target_url')||''), status_code:Number(form.get('status_code')||301), match_type:String(form.get('match_type')||'exact'), preserve_query:String(form.get('preserve_query')||'')==='true', active:String(form.get('active')||'')==='true' };
	const response = await apiRawFetch(id?`/dashboard/seo/redirects/${id}`:'/dashboard/seo/redirects',{method:id?'PUT':'POST',countryId:locals.countryId,cookieHeader:`token=${token}`,headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
	const json:any=await response.json().catch(()=>null); if(!response.ok||!json?.success)return redirect(`/dashboard/seo/redirects?error=${encodeURIComponent(json?.message||'تعذّر حفظ التحويل')}`);
	const logId=String(form.get('log_id')||''); if(logId&&json.data?.id)await apiRawFetch(`/dashboard/seo/404/${logId}/resolve`,{method:'POST',countryId:locals.countryId,cookieHeader:`token=${token}`,headers:{'Content-Type':'application/json'},body:JSON.stringify({redirect_id:Number(json.data.id)})}).catch(()=>null);
	return redirect('/dashboard/seo/redirects?success=saved');
};
