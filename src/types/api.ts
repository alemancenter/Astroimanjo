/**
 * Shared types for the Astro ⇄ Go API contract.
 *
 * Field names and optionality are taken directly from the Go models' `json` tags
 * (back/internal/models/*.go), not guessed from usage — a Go pointer field with
 * `omitempty` is optional here; a plain field is always present. `time.Time` fields come
 * over the wire as ISO 8601 strings, not Date objects.
 *
 * This is a starting foundation, not a completed migration — the project currently has
 * ~470 `any` usages across src/pages and src/components. Adopt these incrementally as
 * files are touched rather than mass-replacing everything in one pass; a change of that
 * size across ~250+ call sites is far higher-risk to verify than the `any`s it removes.
 */

// ── Pagination / response envelope ──────────────────────────────────────────────

export interface PaginationMeta {
	current_page: number;
	per_page: number;
	total: number;
	last_page: number;
	from: number;
	to: number;
}

// ── Taxonomy (back/internal/models/content.go) ──────────────────────────────────

export interface SchoolClass {
	id: number;
	grade_name: string;
	grade_level: number;
	country_id?: number;
	created_at: string;
	updated_at: string;
	subjects?: Subject[];
	semesters?: Semester[];
}

export interface Subject {
	id: number;
	subject_name: string;
	grade_level: number;
	articles_count: number;
	files_count: number;
	created_at: string;
	updated_at: string;
	school_class?: SchoolClass;
}

export interface Semester {
	id: number;
	semester_name: string;
	grade_level: number;
	created_at: string;
	updated_at: string;
	school_class?: SchoolClass;
}

export interface Category {
	id: number;
	name: string;
	slug: string;
	parent_id?: number;
	icon?: string;
	image?: string;
	icon_image?: string;
	is_active: boolean;
	country: string;
	depth: number;
	created_at: string;
	updated_at: string;
	posts?: Post[];
}

export interface Keyword {
	id: number;
	keyword: string;
	created_at: string;
	updated_at: string;
}

// ── Content (back/internal/models/article.go, post.go) ──────────────────────────

export interface FileAttachment {
	id: number;
	article_id?: number;
	post_id?: number;
	file_path: string;
	file_type: string;
	file_category?: string;
	file_name: string;
	file_size: number;
	mime_type: string;
	view_count: number;
	views_count: number;
	download_count: number;
	is_premium: boolean;
	premium_audience: string;
	premium_category: string;
	premium_requires_subscription: boolean;
	premium_subject: string;
	premium_download_count: number;
	created_at: string;
	updated_at: string;
}

export interface Article {
	id: number;
	title: string;
	content: string;
	grade_level?: string;
	subject_id?: number;
	semester_id?: number;
	author_id?: number;
	meta_description?: string;
	/** 0 = draft, 1 = published */
	status: 0 | 1;
	visit_count: number;
	published_at?: string;
	created_at: string;
	updated_at: string;
	subject?: Subject;
	semester?: Semester;
	// gorm:"-" on the Go side — declared but never actually populated by any query in the
	// backend today. Keep it optional/possibly-undefined rather than assuming it's real.
	school_class?: SchoolClass;
	files?: FileAttachment[];
	keywords_rel?: Keyword[];
}

export interface Post {
	id: number;
	category_id?: number;
	title: string;
	slug: string;
	content: string;
	image?: string;
	/** Resolved absolute/proxied URL — only present on some endpoints, not stored on the model itself. */
	image_url?: string;
	alt?: string;
	is_active: boolean;
	is_featured: boolean;
	views: number;
	country: string;
	keywords?: string;
	meta_description?: string;
	author_id?: number;
	created_at: string;
	updated_at: string;
	category?: Category;
	author?: User;
	keywords_rel?: Keyword[];
	files?: FileAttachment[];
}

// ── Users / RBAC (back/internal/models/user.go, rbac.go) ────────────────────────

export interface Permission {
	id: number;
	name: string;
	guard_name: string;
	created_at: string;
	updated_at: string;
}

export interface Role {
	id: number;
	name: string;
	guard_name: string;
	created_at: string;
	updated_at: string;
	permissions?: Permission[];
}

export interface User {
	id: number;
	name: string;
	email: string;
	email_verified_at?: string;
	google_id?: string;
	facebook_id?: string;
	phone?: string;
	job_title?: string;
	gender?: 'male' | 'female' | 'other';
	country?: string;
	bio?: string;
	social_links?: string;
	profile_photo_path?: string;
	status: 'active' | 'inactive' | 'banned';
	email_bounce_status: string;
	email_bounce_count: number;
	email_last_bounce_at?: string;
	email_bounce_reason?: string;
	last_activity?: string;
	last_seen?: string;
	created_at: string;
	updated_at: string;
	roles?: Role[];
	permissions?: Permission[];
}

// ── Messages / notifications (back/internal/models/rbac.go) ─────────────────────

export interface Conversation {
	id: number;
	title?: string;
	type: 'private' | 'public';
	user1_id: number;
	user2_id: number;
	created_at: string;
	updated_at: string;
	user1?: User;
	user2?: User;
}

export interface Message {
	id: number;
	conversation_id: number;
	sender_id: number;
	subject: string;
	body: string;
	read: boolean;
	is_important: boolean;
	is_draft: boolean;
	is_deleted: boolean;
	is_chat: boolean;
	created_at: string;
	updated_at: string;
	sender?: User;
	conversation?: Conversation;
	/** Populated server-side from the conversation at query time — never stored. */
	recipient?: User;
}

export interface AppNotification {
	id: string;
	type: string;
	notifiable_id: number;
	data: Record<string, unknown>;
	read_at?: string;
	created_at: string;
	updated_at: string;
}

// ── Settings ──────────────────────────────────────────────────────────────────
// Genuinely a flat key-value store (back/internal/models/rbac.go's Setting: {key, value}),
// with no fixed schema on the Go side — any key can exist. A closed interface here would
// need editing every time a new setting is added, and would silently lie about keys it
// hasn't been updated for. Callers that expect a specific key still get real narrowing at
// the point they read it: `settings.contact_email?.trim()`.
export type Settings = Record<string, string>;
