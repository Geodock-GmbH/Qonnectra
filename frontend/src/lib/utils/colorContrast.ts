/** Luminance above which white text or strokes no longer stand out. */
const LIGHT_LUMINANCE_THRESHOLD = 0.5;

/**
 * WCAG relative luminance of a hex color.
 * @param hex - `#rgb` or `#rrggbb` color.
 * @returns Luminance between 0 (black) and 1 (white), or `null` for an unparsable color.
 */
function relativeLuminance(hex: string): number | null {
	const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
	if (!match) return null;
	const digits =
		match[1].length === 3
			? match[1]
					.split('')
					.map((d) => d + d)
					.join('')
			: match[1];
	const [r, g, b] = [0, 2, 4].map((i) => {
		const channel = parseInt(digits.slice(i, i + 2), 16) / 255;
		return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Whether a color is so light that white text or strokes on it are unreadable
 * (white, yellow, light green, ...).
 * @param hex - `#rgb` or `#rrggbb` color.
 * @returns `true` for light colors; `false` for dark or unparsable ones.
 */
export function isLightColor(hex: string | null | undefined): boolean {
	if (!hex) return false;
	return (relativeLuminance(hex) ?? 0) > LIGHT_LUMINANCE_THRESHOLD;
}
