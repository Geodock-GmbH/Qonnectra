import type { MapState } from '$lib/classes/MapState.svelte';
import { derived } from 'svelte/store';

import {
	addressStyle,
	areaTypeStyles,
	labelVisibilityConfig,
	nodeTypeStyles,
	trenchColor,
	trenchConstructionTypeStyles,
	trenchStyleMode,
	trenchSurfaceStyles
} from '$lib/stores/store';

type StyledMapState = Pick<
	MapState,
	| 'updateNodeLayerStyle'
	| 'updateTrenchLayerStyle'
	| 'updateAddressLayerStyle'
	| 'updateAreaLayerStyle'
	| 'updateLabelVisibility'
>;

const LABEL_LAYERS = ['trench', 'conduit', 'address', 'node', 'area'] as const;

/**
 * Keeps a map's layer styles and label visibility in step with the persisted
 * style stores. Applies the current store values immediately, then on every change.
 * @param mapState - The map state whose layers are restyled.
 * @returns Stops the syncing; call it when the map is torn down.
 */
export function syncLayerStyles(mapState: StyledMapState): () => void {
	const trenchStyle = derived(
		[trenchStyleMode, trenchSurfaceStyles, trenchConstructionTypeStyles, trenchColor],
		([mode, surfaceStyles, constructionTypeStyles, color]) => ({
			mode,
			surfaceStyles,
			constructionTypeStyles,
			color
		})
	);
	const labels = derived(
		[labelVisibilityConfig, trenchStyle, nodeTypeStyles, areaTypeStyles],
		([config, trench, nodeStyles, areaStyles]) => ({ config, trench, nodeStyles, areaStyles })
	);

	const subscriptions = [
		nodeTypeStyles.subscribe((styles) => {
			if (Object.keys(styles).length > 0) mapState.updateNodeLayerStyle(styles);
		}),
		trenchStyle.subscribe(({ mode, surfaceStyles, constructionTypeStyles, color }) => {
			mapState.updateTrenchLayerStyle(mode, surfaceStyles, constructionTypeStyles, color);
		}),
		addressStyle.subscribe(({ color, size }) => {
			mapState.updateAddressLayerStyle(color, size);
		}),
		areaTypeStyles.subscribe((styles) => {
			if (Object.keys(styles).length > 0) mapState.updateAreaLayerStyle(styles);
		}),
		labels.subscribe(({ config, trench, nodeStyles, areaStyles }) => {
			const currentStyles = { ...trench, nodeTypeStyles: nodeStyles, areaTypeStyles: areaStyles };
			for (const layer of LABEL_LAYERS) {
				if (config[layer] !== undefined) {
					mapState.updateLabelVisibility(layer, config[layer], currentStyles);
				}
			}
		})
	];

	return () => subscriptions.forEach((unsubscribe) => unsubscribe());
}
