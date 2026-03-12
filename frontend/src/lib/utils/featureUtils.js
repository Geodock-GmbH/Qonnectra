/**
 * @typedef {'trench' | 'address' | 'node' | 'area'} FeatureType
 */

/**
 * Detects the feature type from its layer metadata or property keys.
 * Checks layer ID first, then layer name, then falls back to property-based heuristics.
 * @param {import('ol/Feature').default} feature - OpenLayers feature.
 * @param {import('ol/layer/Layer').default | null} [layer=null] - OpenLayers layer the feature belongs to.
 * @returns {FeatureType | null} The detected feature type, or null if unknown.
 */
export function detectFeatureType(feature, layer = null) {
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
 * @param {Record<string, unknown>} properties - Raw feature properties from MVT.
 * @param {FeatureType} type - The feature type (currently unused but reserved for type-specific filtering).
 * @returns {Record<string, unknown>} Cleaned properties without geometry, layer, uuid, or null values.
 */
export function formatFeatureProperties(properties, type) {
	if (!properties) return {};

	const excludeFields = ['geometry', 'layer', 'uuid'];

	/** @type {Record<string, unknown>} */
	const formatted = {};
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
 * @param {import('ol/Feature').default} feature - OpenLayers feature.
 * @param {FeatureType} type - The feature type.
 * @returns {string} A display title derived from feature properties, or a generic fallback.
 */
export function getFeatureTitle(feature, type) {
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
 * @param {string} key - The property key (e.g., 'construction_depth').
 * @returns {string} Title-cased label (e.g., 'Construction Depth').
 */
export function getFieldLabel(key) {
	return key
		.split('_')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
}
