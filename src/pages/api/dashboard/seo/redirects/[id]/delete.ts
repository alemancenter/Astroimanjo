import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../../../lib/api';
export const prerender=false;
export const POST:APIRoute=async({params,cookies,locals,redirect})=>{const token=cookies.get('token')?.value;if(!token)return redirect('/login');if(!/^\d+$/.test(params.id||''))return redirect('/dashboard/seo/redirects');const response=await apiRawFetch(`/dashboard/seo/redirects/${params.id}`,{method:'DELETE',countryId:locals.countryId,cookieHeader:`token=${token}`});if(!response.ok)return redirect('/dashboard/seo/redirects?error='+encodeURIComponent('تعذّر حذف التحويل'));return redirect('/dashboard/seo/redirects?success=deleted');};
