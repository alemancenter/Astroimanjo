const number = new Intl.NumberFormat('ar-EG');
const decimal = new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 1 });

export const numberValue = (...values: unknown[]) => {
	for (const value of values) {
		const parsed = Number(value);
		if (Number.isFinite(parsed)) return parsed;
	}
	return 0;
};

export const formatNumber = (value: unknown) => number.format(numberValue(value));

export const formatPercent = (value: unknown) => `${decimal.format(Math.abs(numberValue(value)))}%`;

export const formatBytes = (value: unknown) => {
	const bytes = numberValue(value);
	if (!bytes) return '0 بايت';
	if (bytes < 1024) return `${number.format(bytes)} بايت`;
	if (bytes < 1024 ** 2) return `${decimal.format(bytes / 1024)} كيلوبايت`;
	if (bytes < 1024 ** 3) return `${decimal.format(bytes / 1024 ** 2)} ميجابايت`;
	return `${decimal.format(bytes / 1024 ** 3)} جيجابايت`;
};

export const formatDateTime = (value: unknown) => {
	const date = new Date(String(value || ''));
	return Number.isNaN(date.getTime()) ? 'حديثًا' : date.toLocaleString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};
