import type { APIRoute } from 'astro';
import { apiFetch } from '../../../../../lib/api';

export const prerender = false;

// Proxies the backend's already-working PUBLIC GET /filter/subjects/:classId — used instead
// of the dashboard's GetDashboardCreateData/GetDashboardEditData bulk-fetch, which currently
// (as deployed) returns hardcoded empty subjects/semesters arrays regardless of country or
// class. This endpoint isn't affected by that bug at all (it's a completely separate,
// already-correct code path already used by the public article search page), so fetching
// subjects/semesters on demand as the admin picks a class/subject sidesteps the broken one
// entirely — no backend deploy required.
export const GET: APIRoute = async ({ params, locals }) => {
	const result = await apiFetch<any[]>(`/filter/subjects/${params.classId}`, { countryId: locals.countryId });
	return new Response(JSON.stringify(result), {
		status: result.ok ? 200 : 400,
		headers: { 'Content-Type': 'application/json' },
	});
};
