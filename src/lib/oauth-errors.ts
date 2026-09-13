// Error codes set by the backend's OAuth redirect callbacks (back/internal/handlers/auth/handler.go
// GoogleCallback/FacebookCallback) on the query string of the redirect back to
// src/pages/auth/{google,facebook}/callback.astro — mapped here to the Arabic text /login and
// /register already display verbatim in their error banner.
const OAUTH_ERROR_MESSAGES: Record<string, string> = {
	invalid_state: 'انتهت صلاحية جلسة تسجيل الدخول، يرجى المحاولة مرة أخرى.',
	missing_code: 'تعذر إكمال تسجيل الدخول، يرجى المحاولة مرة أخرى.',
	google_auth_failed: 'تعذر تسجيل الدخول عبر Google، يرجى المحاولة مرة أخرى.',
	facebook_auth_failed: 'تعذر تسجيل الدخول عبر Facebook، يرجى المحاولة مرة أخرى.',
	registration_disabled: 'تسجيل الحسابات الجديدة موقوف حاليًا.',
	login_failed: 'تعذر تسجيل الدخول، يرجى المحاولة مرة أخرى.',
	session_failed: 'تعذر بدء الجلسة، يرجى المحاولة مرة أخرى.',
};

export function oauthErrorMessage(code: string | null): string | null {
	if (!code) return null;
	return OAUTH_ERROR_MESSAGES[code] || 'تعذر تسجيل الدخول، يرجى المحاولة مرة أخرى.';
}
