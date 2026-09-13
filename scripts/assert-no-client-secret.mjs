import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function walk(directory) {
	return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const fullPath = path.join(directory, entry.name);
		return entry.isDirectory() ? walk(fullPath) : [fullPath];
	});
}

// These are this project's own server-only env vars (everything src/lib/api.ts requires in
// production that isn't PUBLIC_-prefixed) — an explicit list rather than sweeping all of
// process.env, since the OS/CI environment carries plenty of long unrelated values (paths, CI
// tokens for other tools, etc.) that could coincidentally appear in a source map and fail this
// check for reasons that have nothing to do with an actual leak. Checking only FRONTEND_API_KEY
// by name meant a newly added secret here would silently get no bundle-leak coverage at all —
// add its name to this list when that happens.
const SERVER_ONLY_ENV_KEYS = ['FRONTEND_API_KEY', 'INTERNAL_API_URL'];
const MIN_SECRET_LENGTH = 12;

function serverOnlySecretsFromEnv() {
	return SERVER_ONLY_ENV_KEYS
		.map((key) => ({ key, value: process.env[key] }))
		// INTERNAL_API_URL commonly equals PUBLIC_API_URL (src/lib/api.ts falls back to it when
		// unset) — PUBLIC_API_URL is *meant* to be client-visible, so skip the check whenever
		// they're identical rather than flag that expected overlap as a false "leak".
		.filter(({ key, value }) => value && value.length >= MIN_SECRET_LENGTH && (key !== 'INTERNAL_API_URL' || value !== process.env.PUBLIC_API_URL));
}

export function assertNoClientSecret({
	directory = path.join(ROOT, 'dist', 'client'),
	secret = process.env.FRONTEND_API_KEY,
} = {}) {
	if (!fs.existsSync(directory)) {
		throw new Error(`Client build directory does not exist: ${directory}`);
	}
	if (!secret) {
		throw new Error('FRONTEND_API_KEY must be set so the client bundle can be checked.');
	}
	if (secret.length < MIN_SECRET_LENGTH) {
		throw new Error('FRONTEND_API_KEY is too short for a reliable bundle-leak check.');
	}

	const secrets = serverOnlySecretsFromEnv();
	if (!secrets.some((s) => s.key === 'FRONTEND_API_KEY')) secrets.push({ key: 'FRONTEND_API_KEY', value: secret });

	const files = walk(directory);
	for (const { key, value } of secrets) {
		const needle = Buffer.from(value);
		const leakedFiles = files.filter((file) => fs.readFileSync(file).includes(needle));
		if (leakedFiles.length) {
			throw new Error(`${key} leaked into client build files:\n${leakedFiles.join('\n')}`);
		}
	}
	return files.length;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const checked = assertNoClientSecret();
	console.log(`Checked ${checked} client build files; FRONTEND_API_KEY was not present.`);
}