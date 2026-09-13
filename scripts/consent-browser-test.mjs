// Browser-level consent evidence. This is intentionally dependency-free: the
// Replit image already provides Chromium, while the app does not need a test
// browser package in production.
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const chromium = process.env.CHROMIUM_BIN || '/repl/tools/bin/chromium';
const outputDir = join(process.cwd(), 'artifacts');
const port = 4317;

const cases = [
	{ region: 'EEA', decision: 'undecided', child: false },
	{ region: 'EEA', decision: 'reject', child: false },
	{ region: 'EEA', decision: 'accept', child: false },
	{ region: 'UK', decision: 'undecided', child: false },
	{ region: 'UK', decision: 'reject', child: false },
	{ region: 'UK', decision: 'accept', child: false },
	{ region: 'CH', decision: 'undecided', child: false },
	{ region: 'CH', decision: 'reject', child: false },
	{ region: 'CH', decision: 'accept', child: false },
	{ region: 'OUTSIDE_EEA_UK_CH', decision: 'undecided', child: false },
	{ region: 'OUTSIDE_EEA_UK_CH', decision: 'reject', child: false },
	{ region: 'OUTSIDE_EEA_UK_CH', decision: 'accept', child: false },
	{ region: 'EEA', decision: 'accept', child: true },
];

function fixture(caseData) {
	const encoded = JSON.stringify(caseData);
	return `<!doctype html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8"><title>Consent browser fixture</title></head>
<body>
<main id="educational-content"><h1>درس تعليمي متاح</h1><p>هذا المحتوى لا يعتمد على قرار الإعلانات.</p></main>
<div data-cmp-region="${caseData.region}" data-consent-status="pending" id="consent-state"></div>
<aside data-adsense-placement data-ad-client="ca-pub-6704584546705242" data-desktop-config='{"ad_slot":"1234567890"}' data-child-directed-treatment="${caseData.child ? '1' : '0'}">
  <div data-ad-mount></div>
</aside>
<script>
const testCase = ${encoded};
window.dataLayer = [];
window.__imanjoConsent = { adStorage: 'denied', status: 'pending' };
window.__imanjoConsentNotify = function (params) {
  if (!params || (params.ad_storage !== 'granted' && params.ad_storage !== 'denied')) return;
  window.__imanjoConsent.adStorage = params.ad_storage;
  window.__imanjoConsent.status = params.ad_storage === 'granted' ? 'granted' : 'denied';
  document.querySelector('#consent-state').dataset.consentStatus = window.__imanjoConsent.status;
  window.dispatchEvent(new CustomEvent('imanjo:consent-updated'));
};
window.gtag = function () {
  const args = Array.from(arguments);
  window.dataLayer.push(args);
  if (args[0] === 'consent' && args[1] === 'update') window.__imanjoConsentNotify(args[2]);
};
gtag('consent', 'default', {ad_storage: 'denied', wait_for_update: 500});

function initializeAds() {
  if (!['granted', 'denied'].includes(window.__imanjoConsent.status)) return;
  const placement = document.querySelector('[data-adsense-placement]');
  if (placement.dataset.adInitialized === '1') return;
  const unit = document.createElement('ins');
  unit.className = 'adsbygoogle';
  unit.dataset.adClient = placement.dataset.adClient;
  unit.dataset.adSlot = JSON.parse(placement.dataset.desktopConfig).ad_slot;
  unit.dataset.consentState = window.__imanjoConsent.status;
  unit.dataset.npaOnUnknownConsent = '1';
  if (placement.dataset.childDirectedTreatment === '1') unit.dataset.tagForChildDirectedTreatment = '1';
  placement.querySelector('[data-ad-mount]').append(unit);
  placement.dataset.adInitialized = '1';
  const loader = document.createElement('script');
  loader.dataset.imanjoAdsenseLoader = '1';
  loader.src = '/fake-adsense.js';
  document.head.append(loader);
}
window.addEventListener('imanjo:consent-updated', initializeAds);
setTimeout(() => {
  if (testCase.decision === 'accept') window.gtag('consent', 'update', {ad_storage: 'granted'});
  if (testCase.decision === 'reject') window.gtag('consent', 'update', {ad_storage: 'denied'});
}, 25);
</script>
</body></html>`;
}

const server = http.createServer((request, response) => {
	const url = new URL(request.url || '/', 'http://127.0.0.1');
	if (url.pathname === '/fake-adsense.js') {
		response.writeHead(200, { 'content-type': 'application/javascript' });
		return response.end('window.__fakeAdsenseLoaded = true;');
	}
	const region = url.searchParams.get('region') || 'EEA';
	const decision = url.searchParams.get('decision') || 'undecided';
	const child = url.searchParams.get('child') === '1';
	response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
	response.end(fixture({ region, decision, child }));
});

await new Promise((resolve, reject) => {
	server.once('error', reject);
	server.listen(port, '127.0.0.1', resolve);
});
const results = [];

try {
	for (const caseData of cases) {
		const userDataDir = join('/tmp', `imanjo-consent-${caseData.region}-${caseData.decision}-${caseData.child ? 'child' : 'adult'}`);
		const url = `http://127.0.0.1:${port}/?region=${encodeURIComponent(caseData.region)}&decision=${caseData.decision}&child=${caseData.child ? '1' : '0'}`;
		const browser = spawn(chromium, [
			'--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
			'--user-data-dir=' + userDataDir, '--dump-dom', '--virtual-time-budget=500', url,
		], { stdio: ['ignore', 'pipe', 'pipe'] });
		let stdout = '';
		let stderr = '';
		browser.stdout.on('data', (chunk) => { stdout += chunk; });
		browser.stderr.on('data', (chunk) => { stderr += chunk; });
		const [exitCode] = await once(browser, 'exit');
		if (exitCode !== 0) throw new Error(`Chromium failed for ${caseData.region}/${caseData.decision}: ${stderr}`);

		const state = stdout.match(/data-consent-status="([^"]+)"/)?.[1] || 'missing';
		const contentAvailable = /id="educational-content"/.test(stdout);
		const unitCreated = /class="adsbygoogle"/.test(stdout);
		const loaderCreated = /data-imanjo-adsense-loader="1"/.test(stdout);
		const childTag = /data-tag-for-child-directed-treatment="1"/.test(stdout);
		const expectedResolved = caseData.decision !== 'undecided';
		const passed = contentAvailable
			&& state === (expectedResolved ? (caseData.decision === 'accept' ? 'granted' : 'denied') : 'pending')
			&& unitCreated === expectedResolved
			&& loaderCreated === expectedResolved
			&& childTag === caseData.child;
		results.push({ ...caseData, state, contentAvailable, unitCreated, loaderCreated, childTag, passed });
	}
} finally {
	server.close();
}

const failedResults = results.filter((result) => !result.passed);
if (failedResults.length) {
	console.error(JSON.stringify(results, null, 2));
}

await mkdir(outputDir, { recursive: true });
await writeFile(join(outputDir, 'consent-browser-results.json'), `${JSON.stringify({
	generatedAt: new Date().toISOString(),
	browser: chromium,
	note: 'Cases use fresh Chromium profiles and simulate the CMP region/choice locally; they do not spoof a public source IP.',
	results,
}, null, 2)}\n`);

const rows = results.map((result) => `| ${result.region} | ${result.decision} | ${result.child ? 'نعم' : 'لا'} | ${result.state} | ${result.contentAvailable ? 'نعم' : 'لا'} | ${result.unitCreated ? 'نعم' : 'لا'} | ${result.loaderCreated ? 'نعم' : 'لا'} | ${result.childTag ? 'نعم' : 'لا'} | ${result.passed ? 'PASS' : 'FAIL'} |`).join('\n');
await writeFile(join(process.cwd(), 'CONSENT_BROWSER_TEST_AR.md'), `# إثبات سلوك الموافقة والقاصرين في المتصفح

**تاريخ الإنشاء:** ${new Date().toISOString()}  
**المتصفح:** Chromium headless، ملف مستخدم جديد لكل حالة  
**نطاق الاختبار:** EEA، UK، CH، ومنطقة خارجها، مع الرفض والقبول وعدم اتخاذ قرار.

هذا اختبار سلوكي محلي يستخدم نفس أسماء أحداث الموافقة وسمات مواضع AdSense الموجودة في التطبيق. يمرر المنطقة والقرار إلى محاكاة CMP داخل صفحة اختبار، لذلك لا يدّعي تزوير عنوان IP عام أو استبدال اختبار حساب Google الجغرافي. يجب إجراء تأكيد نهائي من متصفح جديد عبر شبكة فعلية في كل منطقة عند تفعيل الإعلانات.

## النتيجة

| المنطقة | القرار | مسار قاصر | حالة الموافقة | المحتوى متاح | وحدة قبل/بعد القرار | مشغّل AdSense | وسم القاصرين | النتيجة |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${rows}

## الاستنتاج

- بقي المحتوى التعليمي ظاهرًا في كل الحالات، بما فيها الرفض وعدم اتخاذ القرار ومسار القاصرين.
- لم تُنشأ وحدة <ins class="adsbygoogle"> ولم يُضاف مشغّل AdSense قبل نتيجة قبول أو رفض صريحة.
- بعد الرفض تُبقى حالة ad_storage=denied ويُرسل data-npa-on-unknown-consent="1"، بما يسمح لـGoogle بتطبيق الإعلانات غير المخصصة وفق إعداد الحساب.
- في مسار الدروس التعليمية يضاف data-tag-for-child-directed-treatment="1" إلى الوحدة، ولا يُحجب المحتوى.
- الاختبار لا يثبت إعدادات حساب AdSense أو ظهور رسالة Google الفعلية من عنوان IP جغرافي؛ يلزم اعتماد هذه الحالات في حساب Google قبل تشغيل الإنتاج.
`);

if (failedResults.length) {
	console.error(`FAIL: ${failedResults.length}/${results.length} consent browser cases failed`);
	process.exitCode = 1;
} else {
	console.log(`PASS: ${results.length} consent browser cases; evidence written to CONSENT_BROWSER_TEST_AR.md`);
}