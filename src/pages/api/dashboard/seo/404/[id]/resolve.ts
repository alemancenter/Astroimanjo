import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../../../lib/api';
export const prerender=false;
export const POST:APIRoute=async({params,cookies,locals,redirect})=>{const token=cookies.get('token')?.value;if(!token)return redirect('/login');if(!/^\d+$/.test(params.id||''))return redirect('/dashboard/seo/redirects');const response=await apiRawFetch(`/dashboard/seo/404/${params.id}/resolve`,{method:'POST',countryId:locals.countryId,cookieHeader:`token=${token}`,headers:{'Content-Type':'application/json'},body:'{}'});if(!response.ok)return redirect('/dashboard/seo/redirects?error='+encodeURIComponent('تعذّرت معالجة السجل'));return redirect('/dashboard/seo/redirects?success=resolved');};
