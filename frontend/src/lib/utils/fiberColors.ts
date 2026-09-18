import type { FiberColor } from '$lib/server/nodeData';

const UNKNOWN_COLOR_HEX = '#808080';

/**
 * Finds a fiber color by its German or English name, ignoring case.
 * @param colors - The known fiber colors.
 * @param colorName - German or English color name.
 * @returns The matching color, if any.
 */
function findFiberColor(colors: FiberColor[], colorName: string): FiberColor | undefined {
	const name = colorName.toLowerCase();
	return colors.find((c) => c.name_de?.toLowerCase() === name || c.name_en?.toLowerCase() === name);
}

/**
 * Hex code of a fiber color.
 * @param colors - The known fiber colors.
 * @param colorName - German or English color name.
 * @returns The hex code, or grey for an unknown color.
 */
export function fiberColorHex(colors: FiberColor[], colorName: string): string {
	if (!colorName) return UNKNOWN_COLOR_HEX;
	return findFiberColor(colors, colorName)?.hex_code || UNKNOWN_COLOR_HEX;
}

/**
 * Name of a fiber color in the given locale.
 * @param colors - The known fiber colors.
 * @param colorName - German or English color name.
 * @param locale - Locale to translate the name to.
 * @returns The translated name, or `colorName` for an unknown color.
 */
export function fiberColorName(
	colors: FiberColor[],
	colorName: string,
	locale: 'de' | 'en'
): string {
	if (!colorName) return colorName;
	const color = findFiberColor(colors, colorName);
	return (locale === 'en' ? color?.name_en : color?.name_de) || colorName;
}
