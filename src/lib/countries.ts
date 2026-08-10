export interface Country {
	id: string;
	code: string;
	name: string;
	flag: string;
	/** BCP 47 locale for <link rel="alternate" hreflang> — Arabic content localized per country. */
	hreflang: string;
}

// Fixed list — the backend has no /api/countries endpoint, this mirrors the
// 4 physical country databases wired in the Go backend (database.go).
export const COUNTRIES: Country[] = [
	{ id: '1', code: 'jo', name: 'الأردن', flag: '🇯🇴', hreflang: 'ar-JO' },
	{ id: '2', code: 'sa', name: 'السعودية', flag: '🇸🇦', hreflang: 'ar-SA' },
	{ id: '3', code: 'eg', name: 'مصر', flag: '🇪🇬', hreflang: 'ar-EG' },
	{ id: '4', code: 'ps', name: 'فلسطين', flag: '🇵🇸', hreflang: 'ar-PS' },
];

export const DEFAULT_COUNTRY_ID = '1';
/** Primary market — used as the x-default hreflang target for country-scoped pages. */
export const DEFAULT_COUNTRY_CODE = 'jo';

export function getCountryById(id: string): Country {
	return COUNTRIES.find((c) => c.id === id) ?? COUNTRIES[0];
}

export function isValidCountryId(id: string | null | undefined): id is string {
	return !!id && COUNTRIES.some((c) => c.id === id);
}

export function getCountryByCode(code: string): Country | undefined {
	return COUNTRIES.find((c) => c.code === code);
}

export function isValidCountryCode(code: string | null | undefined): code is string {
	return !!code && COUNTRIES.some((c) => c.code === code);
}
