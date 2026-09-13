import sanitizeHtml from 'sanitize-html';

// Defense-in-depth only: article/post bodies are already sanitized server-side by the Go
// backend's bluemonday UGC policy (back/internal/utils/validator.go) before they're ever stored,
// which is the real security boundary. This mirrors that same allowlist (base tags/attrs, the
// youtube/vimeo/maps iframe allowlist, and the RTL/color/size inline styles the Quill editor
// emits) so a future bluemonday regression or bypass doesn't turn into stored XSS with zero
// second line of defense — see the frontend security audit finding on set:html usage.
const TRUSTED_IFRAME_SRC = /^https:\/\/(www\.)?(youtube(-nocookie)?\.com|player\.vimeo\.com|maps\.google\.com)\//;

const options: sanitizeHtml.IOptions = {
	allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'iframe', 'h1', 'h2', 'span', 'u']),
	allowedAttributes: {
		...sanitizeHtml.defaults.allowedAttributes,
		'*': ['dir', 'style'],
		a: ['href', 'name', 'target', 'rel'],
		img: ['src', 'alt', 'title', 'width', 'height'],
		iframe: ['src', 'width', 'height', 'frameborder', 'allowfullscreen', 'allow'],
	},
	allowedIframeHostnames: ['www.youtube.com', 'youtube.com', 'youtube-nocookie.com', 'player.vimeo.com', 'maps.google.com'],
	allowedSchemes: ['http', 'https', 'mailto'],
	allowedStyles: {
		'*': {
			color: [/.*/],
			'background-color': [/.*/],
			'font-size': [/.*/],
			'font-weight': [/.*/],
			'text-align': [/.*/],
			'text-decoration': [/.*/],
			'font-style': [/.*/],
			direction: [/.*/],
		},
	},
	exclusiveFilter: (frame) => frame.tag === 'iframe' && !TRUSTED_IFRAME_SRC.test(frame.attribs.src || ''),
};

/** Re-sanitizes already backend-sanitized rich-text HTML before it's rendered with set:html. */
export function sanitizeRichContent(html: string): string {
	if (!html) return '';
	return sanitizeHtml(html, options);
}
