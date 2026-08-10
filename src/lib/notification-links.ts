import { getCountryById } from './countries';

/**
 * Converts notification targets saved by old dashboard code to the matching
 * public/account page. Only local paths are returned so the mark-as-read BFF
 * can redirect without creating an open-redirect path.
 */
export function resolveNotificationTarget(value: unknown, countryCode: string, origin: string): string {
	const storedUrl = String(value || '').trim();
	if (!storedUrl) return '/account/notifications';

	let parsed: URL;
	try {
		parsed = new URL(storedUrl, origin);
	} catch {
		return '/account/notifications';
	}

	if (!storedUrl.startsWith('/') || storedUrl.startsWith('//') || parsed.origin !== origin) {
		return '/account/notifications';
	}

	const path = parsed.pathname;
	let code = countryCode;
	const storedCountry = parsed.searchParams.get('country');
	if (storedCountry) code = getCountryById(storedCountry).code;

	const article = path.match(/^\/dashboard\/articles\/(?:edit\/)?(\d+)(?:\/edit)?\/?$/i);
	if (article) return `/${code}/lesson/articles/${article[1]}`;

	const post = path.match(/^\/dashboard\/posts\/(?:edit\/)?(\d+)(?:\/edit)?\/?$/i);
	if (post) return `/${code}/posts/${post[1]}`;

	if (/^\/dashboard\/messages\/?$/i.test(path)) {
		return parsed.searchParams.get('tab') === 'contact'
			? '/dashboard/contact-messages'
			: '/account/messages?tab=inbox';
	}
	if (/^\/dashboard\/notifications\/?$/i.test(path)) return '/account/notifications';
	if (/^\/dashboard\/articles\/?$/i.test(path)) return `/${code}/articles`;
	if (/^\/dashboard\/posts\/?$/i.test(path)) return `/${code}/posts`;

	return `${path}${parsed.search}${parsed.hash}`;
}
