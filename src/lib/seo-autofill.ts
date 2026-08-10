// Derives SEO metadata from an article's own title/content when the admin leaves the
// meta description / keywords fields empty, so nothing ships without them. Ported from the
// old project's admin article form (ooole/artifacts/alemancenter-web/src/pages/admin/articles/shared.ts).

const ARABIC_STOPWORDS = new Set([
	'في', 'من', 'على', 'إلى', 'الى', 'عن', 'مع', 'هذا', 'هذه', 'ذلك', 'تلك',
	'التي', 'الذي', 'الذين', 'أو', 'او', 'ثم', 'حتى', 'إذا', 'اذا', 'كان',
	'كانت', 'يكون', 'تكون', 'ما', 'لا', 'لم', 'لن', 'قد', 'كل', 'بعض', 'بين',
	'عند', 'أن', 'ان', 'إن', 'كما', 'لكن', 'هو', 'هي', 'هم', 'نحن', 'أنت',
	'به', 'بها', 'له', 'لها', 'فيه', 'فيها', 'منه', 'منها', 'عليه', 'عليها',
	'أيضا', 'ايضا', 'أيضاً', 'غير', 'بعد', 'قبل', 'خلال', 'حول', 'حيث', 'لدى',
]);

function stripHtml(html: string): string {
	return html
		.replace(/<[^>]*>/g, ' ')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/\s+/g, ' ')
		.trim();
}

export function generateMetaDescription(title: string, contentHtml: string): string {
	const text = stripHtml(contentHtml);
	if (!text) return title.trim();
	if (text.length <= 160) return text;
	const cut = text.slice(0, 157);
	const lastSpace = cut.lastIndexOf(' ');
	return `${cut.slice(0, lastSpace > 100 ? lastSpace : 157).trim()}…`;
}

export function generateKeywords(title: string, contentHtml: string): string {
	const isUseful = (word: string) => word.length >= 3 && !ARABIC_STOPWORDS.has(word);

	const titleWords = title.split(/[^\p{L}\p{N}]+/u).filter(isUseful);

	const freq = new Map<string, number>();
	for (const raw of stripHtml(contentHtml).split(/[^\p{L}\p{N}]+/u)) {
		if (!isUseful(raw)) continue;
		freq.set(raw, (freq.get(raw) ?? 0) + 1);
	}
	const topContentWords = [...freq.entries()]
		.filter(([, count]) => count >= 2)
		.sort((a, b) => b[1] - a[1])
		.map(([word]) => word);

	return [...new Set([...titleWords, ...topContentWords])].slice(0, 8).join('، ');
}
