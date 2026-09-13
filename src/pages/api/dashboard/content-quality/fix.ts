import type { APIRoute } from 'astro';
export const prerender = false;
// Retired endpoint: old browser tabs must not trigger generation and saving together.
export const POST: APIRoute = async ({ cookies }) => new Response(JSON.stringify({
 success: false,
 message: cookies.get('token')?.value ? 'افتح محرر المحتوى وراجع الاقتراح قبل حفظه.' : 'يجب تسجيل الدخول',
}), { status: cookies.get('token')?.value ? 409 : 401,
 headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
