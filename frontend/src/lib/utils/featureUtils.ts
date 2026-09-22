import type { FeatureLike } from 'ol/Feature';
import type Layer from 'ol/layer/Layer';

type FeatureType = 'trench' | 'address' | 'node' | 'area';

/**
 * Detects the feature type from its layer metadata or property keys.
 * Checks layer ID first, then layer name, then falls back to property-based heuristics.
 */
export function detectFeatureType(feature: FeatureLike, layer?: Layer): FeatureType | null {
	if (!feature) return null;

	if (layer) {
		const layerId = layer.get('layerId');
		if (layerId) {
			if (layerId === 'trench-layer') return 'trench';
			if (layerId === 'address-layer') return 'address';
			if (layerId === 'node-layer') return 'node';
			if (layerId === 'area-layer') return 'area';
		}

		const layerName = layer.get('layerName');
		if (layerName) {
			if (layerName.includes('trench') || layerName.includes('Trench')) return 'trench';
			if (layerName.includes('address') || layerName.includes('Address')) return 'address';
			if (layerName.includes('node') || layerName.includes('Node')) return 'node';
			if (layerName.includes('area') || layerName.includes('Area') || layerName.includes('Fläche'))
				return 'area';
		}
	}

	const props = feature.getProperties();
	if (props.id_trench !== undefined || props.construction_depth !== undefined) {
		return 'trench';
	}
	if (props.id_address !== undefined || props.zip_code !== undefined) {
		return 'address';
	}
	if (props.node_type !== undefined || props.network_level !== undefined) {
		return 'node';
	}
	if (props.area_type !== undefined) {
		return 'area';
	}

	return null;
}

/**
 * Converts a snake_case property key to a Title Case label.
 */
export function getFieldLabel(key: string): string {
	return key
		.split('_')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
}
