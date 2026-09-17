import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

// This check only works when the Go backend source is reachable on disk (by default at
// <astro-root>/back/internal/routes, which only exists when both repos are checked out
// side by side, e.g. local dev or a monorepo CI runner). Production deploys build the
// frontend and backend from separate vhosts with no access to each other's source tree, so
// there is nothing to compare against there. BACKEND_ROUTES_DIR lets an environment that DOES
// have the backend checked out somewhere else point directly at its internal/routes directory;
// when neither that variable nor the default path resolves to a real directory, this throws
// MissingBackendRoutesError so the prebuild CLI step (below) can skip the check with a warning
// instead of failing the whole production build.
export class MissingBackendRoutesError extends Error {
	constructor(directory) {
		super(`backend routes directory not found: ${directory}`);
		this.name = 'MissingBackendRoutesError';
		this.directory = directory;
	}
}

function resolveBackendRoutesDir(root) {
	const directory = process.env.BACKEND_ROUTES_DIR
		? path.resolve(process.env.BACKEND_ROUTES_DIR)
		: path.join(root, 'back', 'internal', 'routes');
	if (!fs.existsSync(directory)) throw new MissingBackendRoutesError(directory);
	return directory;
}

function walk(directory, extensions) {
	const accepted = Array.isArray(extensions) ? extensions : [extensions];
	const files = [];
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		const fullPath = path.join(directory, entry.name);
		if (entry.isDirectory()) files.push(...walk(fullPath, accepted));
		else if (entry.isFile() && accepted.some((extension) => fullPath.endsWith(extension))) files.push(fullPath);
	}
	return files;
}

function normalizePath(value) {
	const pathname = value.replace(/^https?:\/\/[^/]+/i, '').replace(/^\/api(?=\/|$)/, '') || '/';
	return pathname
		.replace(/\?.*$/, '')
		.replace(/\$\{[^}]+\}/g, ':param')
		.replace(/:[A-Za-z_][A-Za-z0-9_]*/g, ':param')
		.replace(/\/+/g, '/')
		.replace(/\/$/, '') || '/';
}

function pathMatches(frontendPath, backendPath) {
	const front = normalizePath(frontendPath).split('/');
	const back = normalizePath(backendPath).split('/');
	if (front.length !== back.length) return false;
	return front.every((segment, index) =>
segment === back[index] || back[index] === ':param'
	);
}

function joinRoute(prefix, route) {
	return normalizePath(`${prefix}/${route}`);
}

export function extractBackendRoutes(root = ROOT) {
	const aliases = new Map([
		['app', ''],
		['api', '/api'],
		['public', '/api'],
		['dash', '/api/dashboard'],
	]);
	const sources = walk(resolveBackendRoutesDir(root), '.go')
		.map((file) => ({ file, text: fs.readFileSync(file, 'utf8') }));

	let changed = true;
	while (changed) {
		changed = false;
		for (const { text } of sources) {
			const groupPattern = /(\w+)\s*:=\s*(\w+)\.Group\(\s*"([^"]*)"/g;
			for (const match of text.matchAll(groupPattern)) {
				const [, alias, parent, suffix] = match;
				if (!aliases.has(parent) || aliases.has(alias)) continue;
				aliases.set(alias, `${aliases.get(parent)}${suffix}`);
				changed = true;
			}
		}
	}

	const routes = [];
	for (const { file, text } of sources) {
		const routePattern = /(\w+)\.(Get|Post|Put|Patch|Delete)\(\s*"([^"]*)"/g;
		for (const match of text.matchAll(routePattern)) {
			const [, receiver, methodName, route] = match;
			if (!aliases.has(receiver)) continue;
			routes.push({
				method: methodName.toUpperCase(),
				path: joinRoute(aliases.get(receiver), route),
				file: path.relative(root, file),
			});
		}
	}
	return routes;
}

function collectVariables(sourceFile) {
	const variables = new Map();
const lexicalScope = (node) => {
let current = node.parent;
while (current && !ts.isSourceFile(current) && !ts.isBlock(current) && !ts.isFunctionLike(current)) {
current = current.parent;
}
return current ?? sourceFile;
	};
function collectDeclarations(node) {
if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
const bindings = variables.get(node.name.text) ?? [];
bindings.push({
scope: lexicalScope(node),
declaration: node,
values: node.initializer ? [node.initializer] : [],
});
variables.set(node.name.text, bindings);
		}
ts.forEachChild(node, collectDeclarations);
}
collectDeclarations(sourceFile);
function collectAssignments(node) {
		if (
			ts.isBinaryExpression(node) &&
			node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
			ts.isIdentifier(node.left)
		) {
const binding = findBinding(node.left, variables);
if (binding) binding.values.push(node.right);
		}
ts.forEachChild(node, collectAssignments);
	}
collectAssignments(sourceFile);
	return variables;
}

function scopeContains(scope, node) {
for (let current = node; current; current = current.parent) {
if (current === scope) return true;
}
return false;
}

function scopeDepth(scope) {
let depth = 0;
for (let current = scope; current; current = current.parent) depth++;
return depth;
}

function findBinding(identifier, variables) {
const bindings = variables.get(identifier.text) ?? [];
return bindings
.filter((binding) =>
binding.declaration.getStart() <= identifier.getStart() &&
scopeContains(binding.scope, identifier)
)
.sort((left, right) => scopeDepth(right.scope) - scopeDepth(left.scope))[0];
}

function unwrapExpression(node) {
	while (
		node &&
		(ts.isParenthesizedExpression(node) ||
			ts.isAsExpression(node) ||
			ts.isSatisfiesExpression(node))
	) {
		node = node.expression;
	}
	return node;
}

function objectElementValues(node, variables, seen = new Set()) {
	node = unwrapExpression(node);
	if (!node) return [];
	if (ts.isIdentifier(node)) {
const binding = findBinding(node, variables);
if (!binding || seen.has(binding)) return [];
return binding.values.flatMap((value) =>
objectElementValues(value, variables, new Set([...seen, binding]))
		);
	}
	if (ts.isObjectLiteralExpression(node)) {
		return node.properties
			.filter(ts.isPropertyAssignment)
			.map((property) => property.initializer);
	}
	if (ts.isElementAccessExpression(node)) {
		return objectElementValues(node.expression, variables, seen);
	}
	return [];
}

function propertyValues(node, propertyName, variables, seen = new Set()) {
	node = unwrapExpression(node);
	if (!node) return [];
	if (ts.isConditionalExpression(node)) {
		return [
			...propertyValues(node.whenTrue, propertyName, variables, seen),
			...propertyValues(node.whenFalse, propertyName, variables, seen),
		];
	}
	if (ts.isIdentifier(node)) {
const binding = findBinding(node, variables);
if (!binding || seen.has(binding)) return [];
return binding.values.flatMap((value) =>
propertyValues(value, propertyName, variables, new Set([...seen, binding]))
		);
	}
	if (ts.isElementAccessExpression(node)) {
		return objectElementValues(node.expression, variables, seen).flatMap((value) =>
			propertyValues(value, propertyName, variables, seen)
		);
	}
	if (ts.isObjectLiteralExpression(node)) {
		return node.properties
			.filter((property) =>
				ts.isPropertyAssignment(property) &&
				((ts.isIdentifier(property.name) && property.name.text === propertyName) ||
					(ts.isStringLiteral(property.name) && property.name.text === propertyName))
			)
			.map((property) => property.initializer);
	}
	return [];
}

function hasUnknownObjectVariants(node, variables, seen = new Set()) {
	node = unwrapExpression(node);
	if (!node || ts.isObjectLiteralExpression(node)) return !node;
	if (ts.isConditionalExpression(node)) {
		return hasUnknownObjectVariants(node.whenTrue, variables, seen) ||
			hasUnknownObjectVariants(node.whenFalse, variables, seen);
	}
	if (ts.isIdentifier(node)) {
const binding = findBinding(node, variables);
if (!binding || seen.has(binding)) return true;
return binding.values.some((value) =>
hasUnknownObjectVariants(value, variables, new Set([...seen, binding]))
		);
	}
	if (ts.isElementAccessExpression(node)) {
		const values = objectElementValues(node.expression, variables, seen);
		return values.length === 0 || values.some((value) =>
			hasUnknownObjectVariants(value, variables, seen)
		);
	}
	return true;
}

function resolveValues(node, variables, seen = new Set()) {
	node = unwrapExpression(node);
	if (!node) return [];
	if (ts.isStringLiteralLike(node)) return [node.text];
	if (ts.isParenthesizedExpression(node)) return resolveValues(node.expression, variables, seen);
	if (ts.isConditionalExpression(node)) {
		return [
			...resolveValues(node.whenTrue, variables, seen),
			...resolveValues(node.whenFalse, variables, seen),
		];
	}
	if (ts.isIdentifier(node)) {
const binding = findBinding(node, variables);
if (!binding || seen.has(binding)) return [];
return binding.values.flatMap((value) =>
resolveValues(value, variables, new Set([...seen, binding]))
		);
	}
	if (ts.isPropertyAccessExpression(node)) {
		return propertyValues(node.expression, node.name.text, variables, seen).flatMap((value) =>
			resolveValues(value, variables, seen)
		);
	}
	if (ts.isTemplateExpression(node)) {
		let values = [node.head.text];
		for (const span of node.templateSpans) {
			const expressions = resolveValues(span.expression, variables, seen);
			const nonEmptyExpressions = expressions.filter(Boolean);
			const replacements = nonEmptyExpressions.length ? nonEmptyExpressions : [':param'];
			values = values.flatMap((base) =>
				replacements.map((replacement) => `${base}${replacement}${span.literal.text}`)
			);
		}
		return values;
	}
	if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
		const left = resolveValues(node.left, variables, seen);
		const right = resolveValues(node.right, variables, seen);
		return left.flatMap((a) => right.map((b) => `${a}${b}`));
	}
	return [];
}

function staticPropertyName(name) {
	if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) return name.text;
	if (ts.isComputedPropertyName(name) && ts.isStringLiteralLike(unwrapExpression(name.expression))) {
		return unwrapExpression(name.expression).text;
	}
	return null;
}

function methodResolution(options, variables, seen = new Set()) {
	options = unwrapExpression(options);
	if (!options) return { methods: ['GET'], definesMethod: false };
	if (ts.isIdentifier(options)) {
const binding = findBinding(options, variables);
if (!binding || seen.has(binding)) return null;
const results = binding.values.map((value) =>
methodResolution(value, variables, new Set([...seen, binding]))
		);
		if (results.some((result) => !result)) return null;
		const defines = [...new Set(results.map((result) => result.definesMethod))];
		if (defines.length > 1) return null;
		return {
			methods: [...new Set(results.flatMap((result) => result.methods))],
			definesMethod: defines[0],
		};
	}
	if (ts.isConditionalExpression(options)) {
		const whenTrue = methodResolution(options.whenTrue, variables, seen);
		const whenFalse = methodResolution(options.whenFalse, variables, seen);
		if (!whenTrue || !whenFalse || whenTrue.definesMethod !== whenFalse.definesMethod) return null;
		return {
			methods: [...new Set([...whenTrue.methods, ...whenFalse.methods])],
			definesMethod: whenTrue.definesMethod,
		};
	}
	if (!ts.isObjectLiteralExpression(options)) return null;
	for (const property of [...options.properties].reverse()) {
		if (
			(ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) &&
			staticPropertyName(property.name) === 'method'
		) {
			const initializer = ts.isShorthandPropertyAssignment(property) ? property.name : property.initializer;
			const methods = resolveValues(initializer, variables)
				.map((value) => value.toUpperCase())
				.filter((value) => HTTP_METHODS.has(value));
			return methods.length ? { methods: [...new Set(methods)], definesMethod: true } : null;
		}
		if (ts.isSpreadAssignment(property)) {
			const spread = methodResolution(property.expression, variables, seen);
			if (!spread) return null;
			if (spread.definesMethod) return spread;
		}
		if (
			(ts.isPropertyAssignment(property) || ts.isMethodDeclaration(property) || ts.isGetAccessor(property)) &&
			ts.isComputedPropertyName(property.name) &&
			staticPropertyName(property.name) === null
		) return null;
	}
	return { methods: ['GET'], definesMethod: false };
}

function methodValues(options, variables) {
	return methodResolution(options, variables)?.methods ?? [];
}

function methodExpression(options) {
	options = unwrapExpression(options);
	if (!options || !ts.isObjectLiteralExpression(options)) return null;
	for (const property of [...options.properties].reverse()) {
		if (
			(ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) &&
			staticPropertyName(property.name) === 'method'
		) {
			return ts.isShorthandPropertyAssignment(property) ? property.name : property.initializer;
		}
		if (ts.isSpreadAssignment(property)) return null;
	}
	return null;
}

function objectVariants(node, variables, seen = new Set()) {
	node = unwrapExpression(node);
	if (!node) return [];
	if (ts.isObjectLiteralExpression(node)) return [node];
	if (ts.isConditionalExpression(node)) {
		return [
			...objectVariants(node.whenTrue, variables, seen),
			...objectVariants(node.whenFalse, variables, seen),
		];
	}
	if (ts.isIdentifier(node)) {
const binding = findBinding(node, variables);
if (!binding || seen.has(binding)) return [];
return binding.values.flatMap((value) =>
objectVariants(value, variables, new Set([...seen, binding]))
		);
	}
	if (ts.isElementAccessExpression(node)) {
		return objectElementValues(node.expression, variables, seen).flatMap((value) =>
			objectVariants(value, variables, seen)
		);
	}
	return [];
}

function correlatedOperationPairs(pathNode, methodNode, variables) {
	pathNode = unwrapExpression(pathNode);
	methodNode = unwrapExpression(methodNode);
	if (
		!ts.isPropertyAccessExpression(pathNode) ||
		!ts.isPropertyAccessExpression(methodNode) ||
		pathNode.expression.getText() !== methodNode.expression.getText()
	) return [];
	const variants = objectVariants(pathNode.expression, variables);
	return variants.flatMap((variant) => {
		const paths = propertyValues(variant, pathNode.name.text, variables).flatMap((value) =>
			resolveValues(value, variables)
		).filter((value) => value.startsWith('/')).map(normalizePath);
		const methods = propertyValues(variant, methodNode.name.text, variables).flatMap((value) =>
			resolveValues(value, variables)
		).map((value) => value.toUpperCase()).filter((value) => HTTP_METHODS.has(value));
		return paths.flatMap((requestPath) => methods.map((method) => ({ path: requestPath, method })));
	});
}

function explicitContractPairs(text, callStart) {
	const precedingLines = text.slice(0, callStart).split('\n').slice(-8);
	return precedingLines.flatMap((line) => {
		const match = line.match(/^\s*\/\/\s*@api-contract\s+(GET|POST|PUT|PATCH|DELETE)\s+(\/\S+)\s*$/);
		return match ? [{ method: match[1], path: normalizePath(match[2]) }] : [];
	});
}

function hasDroppedValues(node, variables, allowEmpty = false, seen = new Set()) {
	node = unwrapExpression(node);
	if (!node) return true;
	if (ts.isStringLiteralLike(node)) return !allowEmpty && node.text === '';
	if (ts.isIdentifier(node)) {
const binding = findBinding(node, variables);
if (!binding || seen.has(binding)) return true;
return binding.values.some((value) =>
hasDroppedValues(value, variables, allowEmpty, new Set([...seen, binding]))
		);
	}
	if (ts.isConditionalExpression(node)) {
		return hasDroppedValues(node.whenTrue, variables, allowEmpty, seen) ||
			hasDroppedValues(node.whenFalse, variables, true, seen);
	}
	if (ts.isTemplateExpression(node)) {
		// Unresolved template expressions are route parameters, not route choices.
		// Known string unions are still expanded by resolveValues().
		return false;
	}
	if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
		return hasDroppedValues(node.left, variables, allowEmpty, seen) ||
			hasDroppedValues(node.right, variables, allowEmpty, seen);
	}
	if (ts.isPropertyAccessExpression(node)) {
		const values = propertyValues(node.expression, node.name.text, variables, seen);
		return hasUnknownObjectVariants(node.expression, variables, seen) ||
			values.length === 0 || values.some((value) =>
			hasDroppedValues(value, variables, allowEmpty, seen)
		);
	}
	return true;
}

const API_HELPERS = new Set(['apiFetch', 'apiFetchList', 'apiRawFetch']);

function collectApiHelperBindings(sourceFile) {
	const direct = new Map();
	const namespaces = new Set();
	for (const statement of sourceFile.statements) {
		if (
			!ts.isImportDeclaration(statement) ||
			!ts.isStringLiteral(statement.moduleSpecifier) ||
			!/(?:^|\/)lib\/api(?:\.ts)?$/.test(statement.moduleSpecifier.text) ||
			!statement.importClause
		) continue;
		const bindings = statement.importClause.namedBindings;
		if (ts.isNamedImports(bindings)) {
			for (const element of bindings.elements) {
				const imported = element.propertyName?.text ?? element.name.text;
				if (API_HELPERS.has(imported)) direct.set(element.name.text, imported);
			}
		} else if (ts.isNamespaceImport(bindings)) {
			namespaces.add(bindings.name.text);
		}
	}
	return { direct, namespaces };
}

function helperForCall(node, helperBindings) {
	const callee = unwrapExpression(node.expression);
	if (ts.isIdentifier(callee)) {
		if (helperBindings.direct.has(callee.text)) return helperBindings.direct.get(callee.text);
		if (API_HELPERS.has(callee.text)) return callee.text;
	}
	if (
		ts.isPropertyAccessExpression(callee) &&
		ts.isIdentifier(callee.expression) &&
		helperBindings.namespaces.has(callee.expression.text) &&
		API_HELPERS.has(callee.name.text)
	) return callee.name.text;
	return null;
}

export function extractFrontendRequests(root = ROOT) {
	const requests = [];
	const unresolved = [];
	for (const file of walk(path.join(root, 'src'), ['.ts', '.astro'])) {
			if (file.endsWith(`${path.sep}api.ts`)) continue;
			const rawText = fs.readFileSync(file, 'utf8');
			const text = file.endsWith('.astro')
				? rawText.match(/^---\s*\n([\s\S]*?)\n---/)?.[1] ?? ''
				: rawText;
			if (!text) continue;
			const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
			const variables = collectVariables(sourceFile);
			const helperBindings = collectApiHelperBindings(sourceFile);
			const recognizedCalls = new Set();
			let callNumber = 0;
			function visit(node) {
				const helper = ts.isCallExpression(node) ? helperForCall(node, helperBindings) : null;
				if (helper) {
					recognizedCalls.add(node);
					const paths = resolveValues(node.arguments[0], variables);
					const methods = methodValues(node.arguments[1], variables);
					const callId = `${path.relative(root, file)}:${++callNumber}`;
					const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
					const validPaths = [...new Set(paths.filter((requestPath) => requestPath.startsWith('/')).map(normalizePath))];
					const validMethods = [...new Set(methods)];
					const correlatedPairs = correlatedOperationPairs(
						node.arguments[0],
						methodExpression(node.arguments[1]),
						variables
					);
					const pathIncomplete = hasDroppedValues(node.arguments[0], variables, true);
					if (!validPaths.length || pathIncomplete) {
						unresolved.push({
							file: path.relative(root, file),
							line,
							callId,
							reason: `unresolved request path: ${node.arguments[0]?.getText(sourceFile) ?? '<missing>'}`,
						});
					}
					if (!validMethods.length) {
						unresolved.push({
							file: path.relative(root, file),
							line,
							callId,
							reason: `unresolved HTTP method: ${node.arguments[1]?.getText(sourceFile) ?? '<missing>'}`,
						});
					}
					const annotations = explicitContractPairs(text, node.getStart());
					const needsExplicitPairs = validPaths.length > 1 && validMethods.length > 1;
					if (needsExplicitPairs && !correlatedPairs.length) {
						unresolved.push({
							file: path.relative(root, file),
							line,
							callId,
							reason: 'multiple paths and methods must come from the same statically enumerable operation object',
						});
					}
					if (annotations.length) {
						const annotationKeys = [...new Set(annotations.map((item) => `${item.method} ${item.path}`))].sort();
						const codeKeys = [...new Set(correlatedPairs.map((item) => `${item.method} ${item.path}`))].sort();
						if (
							!correlatedPairs.length ||
							JSON.stringify(annotationKeys) !== JSON.stringify(codeKeys)
						) {
							unresolved.push({
								file: path.relative(root, file),
								line,
								callId,
								reason: '@api-contract pairs do not exactly match code operation pairs',
							});
						}
					}
					const variants = correlatedPairs.length
						? correlatedPairs
						: validPaths.flatMap((requestPath) =>
							validMethods.map((method) => ({ path: requestPath, method }))
						);
					for (const { path: requestPath, method } of variants) {
							requests.push({
								method,
								path: requestPath,
								file: path.relative(root, file),
								line,
								callId,
							});
					}
				}
				ts.forEachChild(node, visit);
			}
			visit(sourceFile);
			function findUnsupportedHelperReferences(node) {
				if (ts.isIdentifier(node) && helperBindings.direct.has(node.text)) {
					const isImportName = ts.isImportSpecifier(node.parent);
					const isSupportedCall = ts.isCallExpression(node.parent) &&
						node.parent.expression === node &&
						recognizedCalls.has(node.parent);
					if (!isImportName && !isSupportedCall) {
						const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
						unresolved.push({
							file: path.relative(root, file),
							line,
							callId: `${path.relative(root, file)}:unsupported:${line}`,
							reason: `unsupported backend helper reference: ${node.getText(sourceFile)}`,
						});
					}
				}
				if (ts.isIdentifier(node) && helperBindings.namespaces.has(node.text)) {
					const isImportName = ts.isNamespaceImport(node.parent);
					const member = ts.isPropertyAccessExpression(node.parent) && node.parent.expression === node
						? node.parent
						: null;
					const isSupportedCall = member &&
						ts.isCallExpression(member.parent) &&
						member.parent.expression === member &&
						recognizedCalls.has(member.parent);
					if (!isImportName && !isSupportedCall) {
						const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
						unresolved.push({
							file: path.relative(root, file),
							line,
							callId: `${path.relative(root, file)}:unsupported:${line}`,
							reason: `unsupported backend API namespace reference: ${node.getText(sourceFile)}`,
						});
					}
				}
				ts.forEachChild(node, findUnsupportedHelperReferences);
			}
			findUnsupportedHelperReferences(sourceFile);
	}
	return { requests, unresolved };
}

export function compareContracts(root = ROOT) {
	const backend = extractBackendRoutes(root);
	const { requests: frontend, unresolved } = extractFrontendRequests(root);
	const missing = frontend.filter((request) =>
		!backend.some((route) =>
			request.method === route.method && pathMatches(request.path, route.path)
		)
	);
	return { backend, frontend, missing, unresolved };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	let result;
	try {
		result = compareContracts();
	} catch (error) {
		if (error instanceof MissingBackendRoutesError) {
			console.warn(
				`Skipping API contract check: ${error.message}\n` +
					'This is expected on a production build host, which does not have the Go backend ' +
					'source checked out. Set BACKEND_ROUTES_DIR to that repo\'s internal/routes directory ' +
					'to enable this check there.'
			);
			process.exit(0);
		}
		throw error;
	}
	const { backend, frontend, missing, unresolved } = result;
	console.log(`Compared ${frontend.length} frontend requests with ${backend.length} Go routes.`);
	if (unresolved.length) {
		console.error('Frontend backend calls that could not be statically validated:');
		for (const item of unresolved) {
			console.error(`- ${item.reason} (${item.file}:${item.line})`);
		}
		process.exitCode = 1;
	}
	if (missing.length) {
		console.error('Frontend requests without a matching Go route:');
		for (const item of missing) {
			console.error(`- ${item.method} ${item.path} (${item.file}:${item.line})`);
		}
		process.exitCode = 1;
	} else if (!unresolved.length) {
		console.log('All extracted frontend requests match a registered Go route.');
	}
}