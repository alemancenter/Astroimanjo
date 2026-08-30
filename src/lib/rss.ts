import { apiFetch } from './api';

const xml = (value: unknown) => String(value ?? '').replace(/[<>&"']/g, (char) => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;' }[char]!));
const plain = (value: string) => value.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const rssDate = (value: unknown) => {
	const date = new Date(String(value || ''));
	return Number.isFinite(date.getTime()) ? date.toUTCString() : new Date(0).toUTCString();
};

const rssTemplate = (template: string, item: any, siteName: string) => template
	.replaceAll('%title%', String(item.title || ''))
	.replaceAll('%url%', String(item._url || ''))
	.replaceAll('%site_name%', siteName);

export async function buildRSS(countryId: string, countryCode: string, origin: string): Promise<Response> {
	const settingsResult = await apiFetch<Record<string,string>>('/front/settings',{countryId});
	const settings = settingsResult.data || {};
	if (settings.rss_enabled === 'false') return new Response('Not found',{status:404});
	const count = Math.min(100,Math.max(10,Number(settings.rss_items||30)||30));
	const [articlesResult,postsResult] = await Promise.all([apiFetch<any[]>('/articles',{countryId,params:{page:1,per_page:count}}),apiFetch<any[]>('/posts',{countryId,params:{page:1,per_page:count}})]);
	const items = [...(articlesResult.data||[]).map((item:any)=>({...item,_type:'article',_url:`${origin}/${countryCode}/lesson/articles/${item.id}`})),...(postsResult.data||[]).map((item:any)=>({...item,_type:'post',_url:`${origin}/${countryCode}/posts/${item.id}`}))].sort((a:any,b:any)=>new Date(b.updated_at||b.created_at).getTime()-new Date(a.updated_at||a.created_at).getTime()).slice(0,count);
	const latestDate = items[0] ? rssDate(items[0].updated_at || items[0].created_at) : new Date().toUTCString();
	const siteName=String(settings.site_name||'موقع الإيمان');
	const body=`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${xml(siteName)}</title><link>${xml(`${origin}/${countryCode}`)}</link><description>${xml(settings.meta_description||'أحدث محتوى موقع الإيمان')}</description><language>ar</language><lastBuildDate>${latestDate}</lastBuildDate><generator>ImanSEO</generator><atom:link href="${xml(`${origin}/${countryCode}/rss.xml`)}" rel="self" type="application/rss+xml"/>${items.map((item:any)=>{const excerpt=item.meta_description||plain(item.content||'').slice(0,220);const before=rssTemplate(settings.rss_before_content||'',item,siteName).trim();const after=rssTemplate(settings.rss_after_content||'المصدر: %title% — %url%',item,siteName).trim();const description=[before,excerpt,after].filter(Boolean).join('\n\n');return `<item><title>${xml(item.title)}</title><link>${xml(item._url)}</link><guid isPermaLink="true">${xml(item._url)}</guid><description>${xml(description)}</description><pubDate>${rssDate(item.published_at||item.created_at||item.updated_at)}</pubDate><category>${item._type==='article'?'مقال تعليمي':'منشور'}</category></item>`;}).join('')}</channel></rss>`;
	return new Response(body,{headers:{'Content-Type':'application/rss+xml; charset=utf-8','Cache-Control':'public, max-age=900, stale-while-revalidate=3600','X-Content-Type-Options':'nosniff'}});
}
