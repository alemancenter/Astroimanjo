import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { compareContracts, extractFrontendRequests } from '../scripts/check-api-contract.mjs';
import { assertNoClientSecret } from '../scripts/assert-no-client-secret.mjs';

test('every extracted frontend backend request matches a registered Go route and method', () => {
	const { frontend, backend, missing, unresolved } = compareContracts();
	assert.ok(frontend.length > 100, `expected broad frontend coverage, found ${frontend.length}`);
	assert.ok(backend.length > 100, `expected broad backend coverage, found ${backend.length}`);
	assert.deepEqual(unresolved, []);
	assert.deepEqual(missing, []);
});

test('extractor follows later route assignments and fails closed on unknown calls', () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'imanjo-contract-'));
	try {
		const apiDirectory = path.join(root, 'src', 'pages', 'api');
		fs.mkdirSync(apiDirectory, { recursive: true });
		fs.writeFileSync(path.join(apiDirectory, 'assigned.ts'), `
			let route = '';
			let method = 'POST';
			if (true) {
				route = '/dashboard/things/123';
				method = 'DELETE';
			}
			apiRawFetch(route, { method });
			let partialRoute = '/known';
			partialRoute = makeUnknownPath();
			apiRawFetch(partialRoute, { method: 'POST' });
			const knownOptions = { method: 'POST' };
			apiRawFetch('/known-options', knownOptions);
			const dynamicOptions = makeOptions();
			apiRawFetch('/unknown-options', { ...dynamicOptions });
			let partialOperation = { path: '/known-operation', method: 'POST' };
			partialOperation = makeUnknownOperation();
			apiRawFetch(partialOperation.path, { method: partialOperation.method });
			apiRawFetch(makeUnknownPath(), { method: chooseMethod() });
		`);
		const { requests, unresolved } = extractFrontendRequests(root);
		const extracted = new Set(requests.map(({ method, path }) => `${method} ${path}`));
		for (const expected of [
			'POST /dashboard/things/123',
			'DELETE /dashboard/things/123',
			'POST /known',
			'POST /known-options',
		]) assert.ok(extracted.has(expected), `missing extracted variant: ${expected}`);
		assert.equal(unresolved.length, 5);
		assert.equal(unresolved.filter(({ reason }) => /unresolved request path/.test(reason)).length, 3);
		assert.equal(unresolved.filter(({ reason }) => /unresolved HTTP method/.test(reason)).length, 2);
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test('contract comparison preserves path and method pairs', () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'imanjo-pairs-'));
	try {
		const apiDirectory = path.join(root, 'src', 'pages', 'api');
		const routesDirectory = path.join(root, 'back', 'internal', 'routes');
		fs.mkdirSync(apiDirectory, { recursive: true });
		fs.mkdirSync(routesDirectory, { recursive: true });
		fs.writeFileSync(path.join(routesDirectory, 'routes.go'), `
			package routes
			func register() {
				public.Delete("/a", handler)
				public.Post("/b", handler)
			}
		`);
		fs.writeFileSync(path.join(apiDirectory, 'paired.ts'), `
			const useA = true;
			const operation = useA
				? { path: '/a', method: 'POST' }
				: { path: '/b', method: 'DELETE' };
			// @api-contract POST /a
			// @api-contract DELETE /b
			apiRawFetch(operation.path, { method: operation.method });
		`);
		const { missing, unresolved } = compareContracts(root);
		assert.deepEqual(unresolved, []);
		assert.deepEqual(
			missing.map(({ method, path }) => `${method} ${path}`).sort(),
			['DELETE /b', 'POST /a']
		);
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test('method extraction respects object spread precedence', () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'imanjo-spreads-'));
	try {
		const apiDirectory = path.join(root, 'src', 'pages', 'api');
		fs.mkdirSync(apiDirectory, { recursive: true });
		fs.writeFileSync(path.join(apiDirectory, 'spreads.ts'), `
			const postOptions = { method: 'POST' };
			const deleteOptions = { method: 'DELETE' };
			apiRawFetch('/after-spread', { method: 'DELETE', ...postOptions });
			apiRawFetch('/after-explicit', { ...postOptions, method: 'DELETE' });
			apiRawFetch('/multiple-spreads', { ...deleteOptions, ...postOptions });
		`);
		const { requests, unresolved } = extractFrontendRequests(root);
		assert.deepEqual(unresolved, []);
		assert.deepEqual(
			requests.map(({ method, path }) => `${method} ${path}`),
			[
				'POST /after-spread',
				'DELETE /after-explicit',
				'POST /multiple-spreads',
			]
		);
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test('method extraction supports static property names and rejects unknown computed keys', () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'imanjo-method-keys-'));
	try {
		const apiDirectory = path.join(root, 'src', 'pages', 'api');
		fs.mkdirSync(apiDirectory, { recursive: true });
		fs.writeFileSync(path.join(apiDirectory, 'keys.ts'), `
			apiRawFetch('/quoted', { 'method': 'POST' });
			apiRawFetch('/static-computed', { ['method']: 'DELETE' });
			const key = getKey();
			apiRawFetch('/unknown-computed', { [key]: 'POST' });
		`);
		const { requests, unresolved } = extractFrontendRequests(root);
		assert.deepEqual(
			requests.map(({ method, path }) => `${method} ${path}`),
			['POST /quoted', 'DELETE /static-computed']
		);
		assert.equal(unresolved.length, 1);
		assert.match(unresolved[0].reason, /unresolved HTTP method/);
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test('helper aliases and namespaces are tracked while unsupported references fail closed', () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'imanjo-helper-bindings-'));
	try {
		const apiDirectory = path.join(root, 'src', 'pages', 'api');
		fs.mkdirSync(apiDirectory, { recursive: true });
		fs.writeFileSync(path.join(apiDirectory, 'bindings.ts'), `
			import { apiFetch as fetchApi } from '../../../lib/api';
			import * as backendApi from '../../../lib/api';
			fetchApi('/alias');
			backendApi.apiRawFetch('/member', { method: 'POST' });
			const wrapped = fetchApi;
			backendApi['apiFetch']('/computed-member');
		`);
		const { requests, unresolved } = extractFrontendRequests(root);
		assert.deepEqual(
			requests.map(({ method, path }) => `${method} ${path}`),
			['GET /alias', 'POST /member']
		);
		assert.equal(unresolved.length, 2);
		assert.ok(unresolved.some(({ reason }) => /unsupported backend helper reference/.test(reason)));
		assert.ok(unresolved.some(({ reason }) => /unsupported backend API namespace reference/.test(reason)));
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test('same-name route variables resolve within their lexical scopes', () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'imanjo-scopes-'));
	try {
		const apiDirectory = path.join(root, 'src', 'pages', 'api');
		fs.mkdirSync(apiDirectory, { recursive: true });
		fs.writeFileSync(path.join(apiDirectory, 'scopes.ts'), `
			const route = '/outer';
			function inner() {
				const route = '/inner';
				apiRawFetch(route);
			}
			apiRawFetch(route);
		`);
		const { requests, unresolved } = extractFrontendRequests(root);
		assert.deepEqual(unresolved, []);
		assert.deepEqual(
			requests.map(({ method, path }) => `${method} ${path}`),
			['GET /inner', 'GET /outer']
		);
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test('a dynamic frontend segment cannot match a literal backend segment', () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'imanjo-directional-paths-'));
	try {
		const apiDirectory = path.join(root, 'src', 'pages', 'api');
		const routesDirectory = path.join(root, 'back', 'internal', 'routes');
		fs.mkdirSync(apiDirectory, { recursive: true });
		fs.mkdirSync(routesDirectory, { recursive: true });
		fs.writeFileSync(path.join(routesDirectory, 'routes.go'), `
			package routes
			func register() {
				public.Get("/dashboard/fixed", handler)
			}
		`);
		fs.writeFileSync(path.join(apiDirectory, 'dynamic.ts'), `
			const unknown = getSegment();
			apiFetch(\`/dashboard/\${unknown}\`);
		`);
		const { missing, unresolved } = compareContracts(root);
		assert.deepEqual(unresolved, []);
		assert.equal(missing.length, 1);
		assert.equal(missing[0].path, '/dashboard/:param');
		assert.equal(missing[0].method, 'GET');
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test('client bundle guard accepts clean assets and rejects a leaked BFF key', () => {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'imanjo-client-'));
	const secret = 'contract-test-secret-value';
	try {
		fs.writeFileSync(path.join(directory, 'clean.js'), 'console.log("safe")');
		assert.equal(assertNoClientSecret({ directory, secret }), 1);
		fs.writeFileSync(path.join(directory, 'leaked.js'), `const value=${JSON.stringify(secret)}`);
		assert.throws(
			() => assertNoClientSecret({ directory, secret }),
			/FRONTEND_API_KEY leaked/
		);
	} finally {
		fs.rmSync(directory, { recursive: true, force: true });
	}
});