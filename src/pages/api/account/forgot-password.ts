import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../lib/api';
import { getCurrentUser } from '../../../lib/auth';

export const prerender = false;

// Self-service "send me a password reset link" button from the account page's security
// tab. The backend endpoint itself is public/email-based (back/internal/routes/route_auth.go:
// POST /auth/password/forgot), but this BFF route still requires an existing session so it
// can only ever target the logged-in visitor's own email — never an arbitrary address.
export const POST: APIRoute = async ({ cookies, locals, redirect }) => {
	const currentUser = await getCurrentUser({ cookies, locals });
	if (!currentUser) return redirect('/login?redirect_to=%2Faccount');

	await apiRawFetch('/auth/password/forgot', {
		method: 'POST',
		countryId: locals.countryId,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email: currentUser.email }),
	}).catch(() => null);

	// Always show the same success message regardless of the backend's response, so this
	// endpoint can't be used to probe whether an email address exists.
	return redirect('/account?reset_sent=1');
};
