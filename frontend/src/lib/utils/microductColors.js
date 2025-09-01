/**
 * Mapping from German color names to CSS color values for microduct colors
 * Used for styling microduct handles in the pipe branch interface
 */
export const microductColorMap = {
	// German color name -> CSS color value
	rot: '#dc2626', // red-600
	grün: '#16a34a', // green-600
	blau: '#2563eb', // blue-600
	gelb: '#ca8a04', // yellow-600
	weiss: '#f8fafc', // slate-50 (white with slight tint for visibility)
	grau: '#64748b', // slate-500
	braun: '#92400e', // amber-800 (brown)
	violett: '#7c3aed', // violet-600
	türkis: '#0891b2', // cyan-600 (turquoise)
	schwarz: '#1e293b', // slate-800
	orange: '#ea580c', // orange-600
	pink: '#db2777' // pink-600
};

/**
 * Get the CSS color value for a German color name
 * @param {string} germanColor - German color name (e.g. 'rot', 'grün', 'rot-weiss')
 * @returns {string} CSS color value or default gray if color not found
 */
export function getMicroductColor(germanColor) {
	const color = germanColor?.toLowerCase();

	if (color?.includes('-')) {
		const [primaryColor] = color.split('-');
		return microductColorMap[primaryColor] || '#64748b';
	}

	return microductColorMap[color] || '#64748b';
}

/**
 * Get the border color for two-layer microduct colors
 * @param {string} germanColor - German color name (e.g. 'rot-weiss', 'grün-weiss')
 * @returns {string|null} CSS color value for border, or null if not a two-layer color
 */
export function getMicroductBorderColor(germanColor) {
	const color = germanColor?.toLowerCase();

	if (color?.includes('-')) {
		const [, secondaryColor] = color.split('-');
		return microductColorMap[secondaryColor] || null;
	}

	return null;
}

/**
 * Check if a color is a two-layer color
 * @param {string} germanColor - German color name
 * @returns {boolean} true if the color has two layers
 */
export function isTwoLayerColor(germanColor) {
	return germanColor?.toLowerCase()?.includes('-') || false;
}

/**
 * Get contrasting text color (black or white) for a given background color
 * @param {string} germanColor - German color name
 * @returns {string} 'black' or 'white' for optimal contrast
 */
export function getContrastColor(germanColor) {
	const lightColors = ['weiss', 'gelb'];
	return lightColors.includes(germanColor?.toLowerCase()) ? 'black' : 'white';
}
