import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../../lib/api';
import { safeRedirectPath } from '../../../../../lib/safe-redirect';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, locals, redirect }) => {
	const token = cookies.get('token')?.value;
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/dashboard/content-audit/ai-operations')}`);
	const form = await request.formData();
	const redirectTo = safeRedirectPath(String(form.get('redirect_to') || ''), '/dashboard/content-audit/ai-operations');
	const separator = redirectTo.includes('?') ? '&' : '?';
	const targets = form.getAll('targets')
		.flatMap((value) => String(value).split(','))
		.map((value) => value.trim().match(/^(article|post):(\d+)$/))
		.filter((match): match is RegExpMatchArray => Boolean(match && Number(match[2]) > 0))
		.slice(0, 100)
		.map((match) => ({ content_type: match[1], content_id: Number(match[2]) }));
	const payload = {
		country_code: String(form.get('country_code') || 'jo'), content_type: String(form.get('content_type') || 'all'),
		level: String(form.get('level') || 'weak'), q: String(form.get('q') || '').trim(),
		limit: Math.max(1, Math.min(500, Number(form.get('limit') || 20))),
		concurrency: Math.max(1, Math.min(6, Number(form.get('concurrency') || 2))),
		mode: String(form.get('mode') || 'fix_preview'), model_strategy: String(form.get('model_strategy') || 'balanced'),
		source: 'adsense_readiness', preset: String(form.get('preset') || 'weak_first'),
		targets,
	};
	const res = await apiRawFetch('/dashboard/content-audit/ai/batch-jobs', {
		method: 'POST', countryId: locals.countryId, cookieHeader: `token=${token}`,
		headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
	});
	const json: any = await res.json().catch(() => null);
	if (!res.ok || json?.success === false) return redirect(`${redirectTo}${separator}error=${encodeURIComponent(json?.message || 'تعذّر بدء دفعة التحليل')}`);
	const batchId = String(json?.data?.id || '').trim();
	return redirect(`${redirectTo}${separator}success=batch_started${batchId ? `&batch_id=${encodeURIComponent(batchId)}` : ''}`);
};
