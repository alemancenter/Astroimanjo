import type { APIRoute } from 'astro';
import { apiFetch } from '../../../../../lib/api';

export const prerender = false;

// See filter/subjects/[classId].ts — same reasoning, proxies the backend's already-working
// public GET /filter/semesters/:subjectId (returns { subject, class_id, semesters }).
export const GET: APIRoute = async ({ params, locals }) => {
	const result = await apiFetch<{ subject: any; class_id: number; semesters: any[] }>(`/filter/semesters/${params.subjectId}`, {
		countryId: locals.countryId,
	});
	return new Response(JSON.stringify(result), {
		status: result.ok ? 200 : 400,
		headers: { 'Content-Type': 'application/json' },
	});
};
