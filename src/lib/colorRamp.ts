interface HSL {
	h: number;
	s: number;
	l: number;
}

function hexToHsl(hex: string): HSL | null {
	const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
	if (!match) return null;
	const int = parseInt(match[1], 16);
	const r = ((int >> 16) & 255) / 255;
	const g = ((int >> 8) & 255) / 255;
	const b = (int & 255) / 255;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const l = (max + min) / 2;
	let h = 0;
	let s = 0;
	const d = max - min;
	if (d !== 0) {
		s = d / (1 - Math.abs(2 * l - 1));
		switch (max) {
			case r:
				h = ((g - b) / d) % 6;
				break;
			case g:
				h = (b - r) / d + 2;
				break;
			default:
				h = (r - g) / d + 4;
		}
		h *= 60;
		if (h < 0) h += 360;
	}
	return { h, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number): string {
	const sFrac = s / 100;
	const lFrac = l / 100;
	const c = (1 - Math.abs(2 * lFrac - 1)) * sFrac;
	const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
	const m = lFrac - c / 2;
	let [r, g, b] = [0, 0, 0];
	if (h < 60) [r, g, b] = [c, x, 0];
	else if (h < 120) [r, g, b] = [x, c, 0];
	else if (h < 180) [r, g, b] = [0, c, x];
	else if (h < 240) [r, g, b] = [0, x, c];
	else if (h < 300) [r, g, b] = [x, 0, c];
	else [r, g, b] = [c, 0, x];
	const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
	return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Target lightness/saturation per shade step, approximating the visual feel of a
// Tailwind-style palette — not a reproduction of Tailwind's exact algorithm, just a
// coherent-looking ramp derived from one admin-supplied hex so an override doesn't leave
// some shades (hover states, dark-mode tints) stuck at the original brand color while only
// one specific shade changes.
const SHADE_STOPS: { shade: string; lightness: number; satMul: number }[] = [
	{ shade: '50', lightness: 97, satMul: 0.35 },
	{ shade: '100', lightness: 94, satMul: 0.45 },
	{ shade: '200', lightness: 86, satMul: 0.55 },
	{ shade: '300', lightness: 77, satMul: 0.7 },
	{ shade: '400', lightness: 66, satMul: 0.85 },
	{ shade: '500', lightness: 55, satMul: 1 },
	{ shade: '600', lightness: 45, satMul: 1 },
	{ shade: '700', lightness: 37, satMul: 0.95 },
	{ shade: '800', lightness: 30, satMul: 0.9 },
	{ shade: '900', lightness: 24, satMul: 0.85 },
	{ shade: '950', lightness: 15, satMul: 0.8 },
];

/** Generates an 11-step Tailwind-style shade ramp (50–950) from a single hex color. */
export function generateShadeRamp(hex: string | undefined | null): Record<string, string> | null {
	if (!hex) return null;
	const hsl = hexToHsl(hex);
	if (!hsl) return null;
	const ramp: Record<string, string> = {};
	for (const { shade, lightness, satMul } of SHADE_STOPS) {
		ramp[shade] = hslToHex(hsl.h, Math.min(100, hsl.s * satMul), lightness);
	}
	return ramp;
}
