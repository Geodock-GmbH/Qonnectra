export type NodeShape = 'circle' | 'square';

export interface NodeTypeStyle {
	color: string;
	size: number;
	shape: NodeShape;
}

export const DEFAULT_TRENCH_COLOR = '#0033ff';
export const DEFAULT_TRENCH_WIDTH = 2;

export const DEFAULT_NODE_COLOR = '#ff6b35';
export const DEFAULT_NODE_SIZE = 6;
export const DEFAULT_NODE_SHAPE: NodeShape = 'square';

export const DEFAULT_ADDRESS_COLOR = '#949494';
export const DEFAULT_ADDRESS_SIZE = 4;

export const DEFAULT_AREA_COLOR = '#22c55e';
export const DEFAULT_AREA_OPACITY = 0.3;

export const DEFAULT_SELECTED_COLOR = '#fff700';

export const NODE_TYPE_DEFAULTS: Record<string, NodeTypeStyle> = {
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

/** Returns the style defaults for a given node type name, falling back to global defaults. */
export function getNodeTypeDefault(nodeTypeName: string): NodeTypeStyle {
	return (
		NODE_TYPE_DEFAULTS[nodeTypeName] || {
			color: DEFAULT_NODE_COLOR,
			size: DEFAULT_NODE_SIZE,
			shape: DEFAULT_NODE_SHAPE
		}
	);
}
