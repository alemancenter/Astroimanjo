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
	if (secret.length < 12) {
		throw new Error('FRONTEND_API_KEY is too short for a reliable bundle-leak check.');
	}
	const leakedFiles = walk(directory).filter((file) => fs.readFileSync(file).includes(Buffer.from(secret)));
	if (leakedFiles.length) {
		throw new Error(`FRONTEND_API_KEY leaked into client build files:\n${leakedFiles.join('\n')}`);
	}
	return walk(directory).length;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const checked = assertNoClientSecret();
	console.log(`Checked ${checked} client build files; FRONTEND_API_KEY was not present.`);
}