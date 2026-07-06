/** @type {string} */
export const DEFAULT_TRENCH_COLOR = '#0033ff';
/** @type {number} */
export const DEFAULT_TRENCH_WIDTH = 2;

/** @type {string} */
export const DEFAULT_NODE_COLOR = '#ff6b35';
/** @type {number} */
export const DEFAULT_NODE_SIZE = 6;
/** @type {'circle' | 'square'} */
export const DEFAULT_NODE_SHAPE = 'square';

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

/** @type {Record<string, {color: string, size: number, shape: 'circle' | 'square'}>} */
export const NODE_TYPE_DEFAULTS = {
	Bauerschwernis: { color: '#000000', size: 12, shape: 'square' },
	FCC4: { color: '#006eff', size: 16, shape: 'square' },
	FCC8: { color: '#006eff', size: 16, shape: 'square' },
	Hausanschluss: { color: '#ff6b35', size: 6, shape: 'square' },
	Kabelring: { color: '#63605f', size: 12, shape: 'square' },
	MFG: { color: '#ff0000', size: 16, shape: 'square' },
	Muffe: { color: '#00ffe1', size: 12, shape: 'square' },
	'NVt 48': { color: '#006eff', size: 16, shape: 'square' },
	POP: { color: '#ff0000', size: 22, shape: 'square' },
	Rohrabzweig: { color: '#11ff00', size: 12, shape: 'square' },
	Schacht: { color: '#00ffe1', size: 12, shape: 'square' }
};

/**
 * @param {string} nodeTypeName
 * @returns {{color: string, size: number, shape: 'circle' | 'square'}}
 */
export function getNodeTypeDefault(nodeTypeName) {
	return (
		NODE_TYPE_DEFAULTS[nodeTypeName] || {
			color: DEFAULT_NODE_COLOR,
			size: DEFAULT_NODE_SIZE,
			shape: DEFAULT_NODE_SHAPE
		}
	);
}
