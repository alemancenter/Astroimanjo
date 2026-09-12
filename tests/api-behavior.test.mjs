import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

function cookieJar(initial = {}) {
	const values = new Map(Object.entries(initial));
	const writes = [];
	const deletes = [];
	return {
		get: (name) => values.has(name) ? { value: values.get(name) } : undefined,
		set: (name, value, options) => {
			values.set(name, value);
			writes.push({ name, value, options });
		},
		delete: (name, options) => {
			values.delete(name);
			deletes.push({ name, options });
		},
		values,
		writes,
		deletes,
	};
}

function redirect(location) {
	return new Response(null, { status: 302, headers: { Location: location } });
}

test('login forwards JSON and stores both session cookies', async () => {
	const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom' });
	const originalFetch = globalThis.fetch;
	try {
		const route = await server.ssrLoadModule('/src/pages/api/auth/login.ts');
		const cookies = cookieJar();
		let requestUrl;
		let requestOptions;
		globalThis.fetch = async (url, options) => {
			requestUrl = String(url);
			requestOptions = options;
			return Response.json({
				success: true,
				token: 'access-token',
				refresh_token: 'refresh-token',
			});
		};
		const form = new FormData();
		form.set('email', 'person@example.com');
		form.set('password', 'password');
		form.set('redirect_to', '/account');
		const response = await route.POST({
			request: new Request('http://localhost/api/auth/login', { method: 'POST', body: form }),
			cookies,
			locals: { countryId: '2' },
			redirect,
		});
		assert.match(requestUrl, /\/api\/auth\/login$/);
		assert.equal(requestOptions.method, 'POST');
		assert.equal(requestOptions.headers['Content-Type'], 'application/json');
		assert.equal(requestOptions.headers['X-Country-Id'], '2');
		assert.deepEqual(JSON.parse(requestOptions.body), {
			email: 'person@example.com',
			password: 'password',
		});
		assert.equal(cookies.values.get('token'), 'access-token');
		assert.equal(cookies.values.get('refresh_token'), 'refresh-token');
		assert.equal(cookies.writes.every(({ options }) => options.httpOnly && options.sameSite === 'lax'), true);
		assert.equal(response.headers.get('location'), '/account');
	} finally {
		globalThis.fetch = originalFetch;
		await server.close();
	}
});

test('login handles invalid backend JSON and connection timeouts without setting cookies', async () => {
	const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom' });
	const originalFetch = globalThis.fetch;
	try {
		const route = await server.ssrLoadModule('/src/pages/api/auth/login.ts');
		const makeContext = () => {
			const form = new FormData();
			form.set('email', 'person@example.com');
			form.set('password', 'password');
			return {
				request: new Request('http://localhost/api/auth/login', { method: 'POST', body: form }),
				cookies: cookieJar(),
				locals: { countryId: '1' },
				redirect,
			};
		};

		globalThis.fetch = async () => new Response('not-json', { status: 502 });
		const invalidContext = makeContext();
		const invalidResponse = await route.POST(invalidContext);
		assert.match(invalidResponse.headers.get('location'), /^\/login\?error=/);
		assert.equal(invalidContext.cookies.writes.length, 0);

		globalThis.fetch = async () => {
			throw new DOMException('timed out', 'TimeoutError');
		};
		const timeoutContext = makeContext();
		const timeoutResponse = await route.POST(timeoutContext);
		assert.match(
			decodeURIComponent(timeoutResponse.headers.get('location')),
			/تعذر الاتصال بخدمة تسجيل الدخول/
		);
		assert.equal(timeoutContext.cookies.writes.length, 0);
	} finally {
		globalThis.fetch = originalFetch;
		await server.close();
	}
});

test('invalid refresh clears session while transient refresh preserves it', async () => {
	const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom' });
	const originalFetch = globalThis.fetch;
	try {
		const auth = await server.ssrLoadModule('/src/lib/auth.ts');
		const invalid = cookieJar({ refresh_token: 'invalid-refresh-credential' });
		globalThis.fetch = async () => Response.json({ success: false }, { status: 401 });
		assert.equal(await auth.getCurrentUser({ cookies: invalid, locals: { countryId: '1' } }), null);
		assert.deepEqual(invalid.deletes.map(({ name }) => name).sort(), ['refresh_token', 'token']);

		const transient = cookieJar({ refresh_token: 'transient-refresh-credential' });
		globalThis.fetch = async () => Response.json({ success: false }, { status: 503 });
		assert.equal(await auth.getCurrentUser({ cookies: transient, locals: { countryId: '1' } }), null);
		assert.equal(transient.values.get('refresh_token'), 'transient-refresh-credential');
		assert.equal(transient.deletes.length, 0);
	} finally {
		globalThis.fetch = originalFetch;
		await server.close();
	}
});

test('logout forwards the access cookie and always clears local session cookies', async () => {
	const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom' });
	const originalFetch = globalThis.fetch;
	try {
		const route = await server.ssrLoadModule('/src/pages/api/auth/logout.ts');
		const cookies = cookieJar({ token: 'logout-access', refresh_token: 'logout-refresh' });
		let forwardedCookie;
		globalThis.fetch = async (_url, options) => {
			forwardedCookie = options.headers.Cookie;
			throw new Error('simulated backend outage');
		};
		const response = await route.POST({ cookies, locals: { countryId: '1' }, redirect });
		assert.equal(forwardedCookie, 'token=logout-access');
		assert.deepEqual(cookies.deletes.map(({ name }) => name).sort(), ['refresh_token', 'token']);
		assert.equal(response.headers.get('location'), '/');
	} finally {
		globalThis.fetch = originalFetch;
		await server.close();
	}
});

test('apiFetch preserves upstream error statuses and classifies invalid responses', async () => {
	const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom' });
	const originalFetch = globalThis.fetch;
	try {
		const api = await server.ssrLoadModule('/src/lib/api.ts');
		for (const status of [401, 403, 404, 422, 429, 500, 503]) {
			globalThis.fetch = async () => Response.json({ success: false, message: `status-${status}` }, { status });
			const result = await api.apiFetch('/contract-status');
			assert.equal(result.ok, false);
			assert.equal(result.status, status);
			assert.equal(result.message, `status-${status}`);
		}

		globalThis.fetch = async () => new Response('not-json', { status: 200 });
		const invalidJson = await api.apiFetch('/invalid-json');
		assert.equal(invalidJson.ok, false);
		assert.equal(invalidJson.status, 502);

		globalThis.fetch = async () => Response.json(['bare-array']);
		const invalidEnvelope = await api.apiFetch('/invalid-envelope');
		assert.equal(invalidEnvelope.ok, false);
		assert.equal(invalidEnvelope.status, 502);

		globalThis.fetch = async () => {
			throw new DOMException('timed out', 'TimeoutError');
		};
		const timeout = await api.apiFetch('/timeout');
		assert.equal(timeout.ok, false);
		assert.equal(timeout.status, 0);
		assert.match(timeout.message, /مهلة/);
	} finally {
		globalThis.fetch = originalFetch;
		await server.close();
	}
});

test('image upload forwards multipart data without overriding its content type', async () => {
	const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom' });
	const originalFetch = globalThis.fetch;
	try {
		const route = await server.ssrLoadModule('/src/pages/api/dashboard/upload-image.ts');
		let requestOptions;
		globalThis.fetch = async (_url, options) => {
			requestOptions = options;
			return Response.json({ success: true, data: { url: '/storage/test.png' } });
		};
		const incoming = new FormData();
		incoming.set('image', new File(['image-bytes'], 'test.png', { type: 'image/png' }));
		const response = await route.POST({
			request: new Request('http://localhost/api/dashboard/upload-image', { method: 'POST', body: incoming }),
			cookies: cookieJar({ token: 'upload-access' }),
			locals: { countryId: '4' },
		});
		assert.equal(requestOptions.method, 'POST');
		assert.ok(requestOptions.body instanceof FormData);
		assert.equal(requestOptions.body.get('image').name, 'test.png');
		assert.equal(requestOptions.headers['Content-Type'], undefined);
		assert.equal(requestOptions.headers['X-Country-Id'], '4');
		assert.equal(requestOptions.headers.Cookie, 'token=upload-access');
		assert.ok(requestOptions.signal instanceof AbortSignal);
		assert.equal(response.status, 200);
	} finally {
		globalThis.fetch = originalFetch;
		await server.close();
	}
});