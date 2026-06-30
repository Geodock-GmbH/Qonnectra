/** @type {string} */
export const DEFAULT_TRENCH_COLOR = '#0033ff';
/** @type {number} */
export const DEFAULT_TRENCH_WIDTH = 2;

/** @type {string} */
export const DEFAULT_NODE_COLOR = '#ff6b35';
/** @type {number} */
export const DEFAULT_NODE_SIZE = 6;

/** @type {string} */
export const DEFAULT_ADDRESS_COLOR = '#949494';
/** @type {number} */
export const DEFAULT_ADDRESS_SIZE = 4;

/** @type {string} */
export const DEFAULT_AREA_COLOR = '#22c55e';
/** @type {number} */
export const DEFAULT_AREA_OPACITY = 0.3;

/** @type {string} */
export const DEFAULT_SELECTED_COLOR = '#fff700';

/** @type {Record<string, {color: string, size: number}>} */
export const NODE_TYPE_DEFAULTS = {
	Bauerschwernis: { color: '#000000', size: 12 },
	FCC4: { color: '#006eff', size: 16 },
	FCC8: { color: '#006eff', size: 16 },
	Hausanschluss: { color: '#ff6b35', size: 6 },
	Kabelring: { color: '#63605f', size: 12 },
	MFG: { color: '#ff0000', size: 16 },
	Muffe: { color: '#00ffe1', size: 12 },
	'NVt 48': { color: '#006eff', size: 16 },
	PoP: { color: '#ff0000', size: 22 },
	Rohrabzweig: { color: '#11ff00', size: 12 },
	Schacht: { color: '#00ffe1', size: 12 }
};

/**
 * @param {string} nodeTypeName
 * @returns {{color: string, size: number}}
 */
export function getNodeTypeDefault(nodeTypeName) {
	return NODE_TYPE_DEFAULTS[nodeTypeName] || { color: DEFAULT_NODE_COLOR, size: DEFAULT_NODE_SIZE };
}
