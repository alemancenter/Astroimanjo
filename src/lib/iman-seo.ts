export interface SEOMetadata {
	id?: number;
	content_type: 'article' | 'post';
	content_id: number;
	seo_title: string;
	meta_description: string;
	focus_keyword: string;
	additional_keywords: string;
	canonical_url: string;
	robots_index: boolean;
	robots_follow: boolean;
	robots_noarchive: boolean;
	robots_nosnippet: boolean;
	max_snippet: number;
	max_image_preview: 'none' | 'standard' | 'large';
	max_video_preview: number;
	og_title: string;
	og_description: string;
	og_image: string;
	twitter_title: string;
	twitter_description: string;
	twitter_image: string;
	schema_type: string;
	schema_json: string;
	cornerstone: boolean;
	score: number;
	analysis_json?: string;
}

export interface EffectiveSEO {
	title: string;
	description: string;
	keywords: string;
	canonical_url: string;
	robots: string;
	robots_index: boolean;
	robots_follow: boolean;
	og_title: string;
	og_description: string;
	og_image: string;
	twitter_title: string;
	twitter_description: string;
	twitter_image: string;
	schema_type: string;
	schema_json?: Record<string, unknown>;
	cornerstone: boolean;
	score: number;
	customized: boolean;
}

const text = (form: FormData, name: string) => String(form.get(name) ?? '').trim();
const checked = (form: FormData, name: string) => text(form, name) === 'true';
const integer = (form: FormData, name: string, fallback: number) => {
	const value = Number(text(form, name));
	return Number.isInteger(value) ? value : fallback;
};

export function seoPayloadFromForm(form: FormData) {
	return {
		seo_title: text(form, 'seo_title'),
		meta_description: text(form, 'seo_meta_description'),
		focus_keyword: text(form, 'seo_focus_keyword'),
		additional_keywords: text(form, 'seo_additional_keywords'),
		canonical_url: text(form, 'seo_canonical_url'),
		robots_index: checked(form, 'seo_robots_index'),
		robots_follow: checked(form, 'seo_robots_follow'),
		robots_noarchive: checked(form, 'seo_robots_noarchive'),
		robots_nosnippet: checked(form, 'seo_robots_nosnippet'),
		max_snippet: integer(form, 'seo_max_snippet', -1),
		max_image_preview: text(form, 'seo_max_image_preview') || 'large',
		max_video_preview: integer(form, 'seo_max_video_preview', -1),
		og_title: text(form, 'seo_og_title'),
		og_description: text(form, 'seo_og_description'),
		og_image: text(form, 'seo_og_image'),
		twitter_title: text(form, 'seo_twitter_title'),
		twitter_description: text(form, 'seo_twitter_description'),
		twitter_image: text(form, 'seo_twitter_image'),
		schema_type: text(form, 'seo_schema_type') || 'Article',
		schema_json: text(form, 'seo_schema_json'),
		cornerstone: checked(form, 'seo_cornerstone'),
		change_note: text(form, 'seo_change_note'),
	};
}
