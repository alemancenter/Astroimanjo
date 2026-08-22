export interface DashboardNavItem {
	label: string;
	href: string;
	group: 'الرئيسية' | 'المحتوى' | 'الأكاديمي' | 'المستخدمون' | 'التواصل' | 'النظام والذكاء';
	icon: string;
	/** Permission name required to see this item, or null if every dashboard user sees it. */
	/** One permission, or a list where possessing any one grants visibility. */
	permission: string | string[] | null;
	/** True if the page itself is gated by isAdmin() rather than a specific permission. */
	adminOnly?: boolean;
}

// Single source of truth for "which dashboard sections exist and what permission they
// need" — used both to build the dashboard sidebar (DashboardLayout.astro) and to show a
// member their own granted areas on the public account page (account/index.astro).
export const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
	{ label: 'نظرة عامة', href: '/dashboard', group: 'الرئيسية', icon: 'dashboard', permission: null },
	{ label: 'التحليلات', href: '/dashboard/analytics', group: 'الرئيسية', icon: 'analytics', permission: ['manage monitoring', 'manage performance'] },
	{ label: 'إدارة المقالات', href: '/dashboard/articles', group: 'المحتوى', icon: 'article', permission: 'manage articles' },
	{ label: 'إدارة المنشورات', href: '/dashboard/posts', group: 'المحتوى', icon: 'post', permission: 'manage posts' },
	{ label: 'إدارة الأقسام', href: '/dashboard/categories', group: 'المحتوى', icon: 'folder', permission: 'manage categories' },
	{ label: 'مراجعة التعليقات', href: '/dashboard/comments', group: 'المحتوى', icon: 'comments', permission: 'manage comments' },
	{ label: 'مكتبة الملفات', href: '/dashboard/files', group: 'المحتوى', icon: 'files', permission: 'manage files' },
	{ label: 'الهيكل الأكاديمي', href: '/dashboard/classes', group: 'الأكاديمي', icon: 'academic', permission: 'manage classes' },
	{ label: 'التقويم', href: '/dashboard/calendar', group: 'الأكاديمي', icon: 'calendar', permission: 'manage calendar' },
	{ label: 'المستخدمون', href: '/dashboard/users', group: 'المستخدمون', icon: 'users', permission: 'manage users' },
	{ label: 'الأدوار والصلاحيات', href: '/dashboard/roles', group: 'المستخدمون', icon: 'roles', permission: 'manage roles' },
	{ label: 'إدارة الصلاحيات', href: '/dashboard/permissions', group: 'المستخدمون', icon: 'permissions', permission: 'manage roles' },
	{ label: 'اشتراكات المعلمين', href: '/dashboard/teacher-subscriptions', group: 'المستخدمون', icon: 'subscription', permission: 'manage teacher subscriptions' },
	{ label: 'رسائل التواصل', href: '/dashboard/contact-messages', group: 'التواصل', icon: 'mail', permission: 'manage settings' },
	{ label: 'الإشعارات', href: '/dashboard/notifications', group: 'التواصل', icon: 'bell', permission: null },
	{ label: 'الرسائل الداخلية', href: '/dashboard/messages', group: 'التواصل', icon: 'comments', permission: null },
	{ label: 'الإعدادات', href: '/dashboard/settings', group: 'النظام والذكاء', icon: 'settings', permission: 'manage settings' },
	{ label: 'خريطة الموقع', href: '/dashboard/sitemap', group: 'النظام والذكاء', icon: 'sitemap', permission: 'manage sitemap' },
	{ label: 'الأمان', href: '/dashboard/security', group: 'النظام والذكاء', icon: 'security', permission: 'manage security' },
	{ label: 'الشاتبوت', href: '/dashboard/chatbot', group: 'النظام والذكاء', icon: 'bot', permission: 'manage settings' },
	{ label: 'تدقيق المحتوى AI', href: '/dashboard/content-audit', group: 'النظام والذكاء', icon: 'audit', permission: 'manage content audit' },
	{ label: 'مراقبة فساد المحتوى', href: '/dashboard/content-audit/corruption', group: 'النظام والذكاء', icon: 'security', permission: null, adminOnly: true },
	{ label: 'كشف التكرار والتشابه', href: '/dashboard/content-audit/similarity', group: 'النظام والذكاء', icon: 'audit', permission: null, adminOnly: true },
	// Actual page (pages/dashboard/redis/index.astro) checks isAdmin() directly, not a
	// named permission — mirror that here so the link isn't shown to non-admin dashboard
	// users who'd otherwise click it and land straight back on a "forbidden" bounce.
	{ label: 'Redis', href: '/dashboard/redis', group: 'النظام والذكاء', icon: 'database', permission: null, adminOnly: true },
];
