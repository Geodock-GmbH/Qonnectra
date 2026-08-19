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
 * Strips internal fields from feature properties for display purposes.
 */
export function formatFeatureProperties(
	properties: Record<string, unknown>,
	type: FeatureType
): Record<string, unknown> {
	if (!properties) return {};

	const excludeFields = ['geometry', 'layer', 'uuid'];

	const formatted: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(properties)) {
		if (excludeFields.includes(key) || value === null || value === undefined) {
			continue;
		}
		formatted[key] = value;
	}

	return formatted;
}

/**
 * Builds a human-readable display title for a feature based on its type and properties.
 */
export function getFeatureTitle(feature: FeatureLike, type: FeatureType): string {
	if (!feature || !type) return 'Feature Details';

	const props = feature.getProperties();

	switch (type) {
		case 'trench':
			return props.id_trench ? `${props.id_trench}` : 'Trench Details';
		case 'address':
			if (props.street && props.housenumber) {
				return `${props.street} ${props.housenumber}${props.house_number_suffix || ''}, ${props.zip_code} ${props.city}`;
			}
			return props.id_address ? `${props.id_address}` : 'Address Details';
		case 'node':
			return props.name ? `${props.name}` : 'Node Details';
		case 'area':
			return props.name ? `${props.name}` : 'Area Details';
		default:
			return 'Feature Details';
	}
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
