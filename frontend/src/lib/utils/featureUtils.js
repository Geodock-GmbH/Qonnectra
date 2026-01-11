/**
 * Utility functions for working with map features
 */

/**
 * Detect the type of feature based on layer or properties
 * @param {Object} feature - OpenLayers feature
 * @param {Object} layer - OpenLayers layer (optional)
 * @returns {string|null} - 'trench', 'address', 'node', 'area', or null
 */
export function detectFeatureType(feature, layer = null) {
	if (!feature) return null;

	// Try to detect from layer ID if available
	if (layer) {
		const layerId = layer.get('layerId');
		if (layerId) {
			if (layerId === 'trench-layer') return 'trench';
			if (layerId === 'address-layer') return 'address';
			if (layerId === 'node-layer') return 'node';
			if (layerId === 'area-layer') return 'area';
		}

		// Fallback: try layer name
		const layerName = layer.get('layerName');
		if (layerName) {
			if (layerName.includes('trench') || layerName.includes('Trench')) return 'trench';
			if (layerName.includes('address') || layerName.includes('Address')) return 'address';
			if (layerName.includes('node') || layerName.includes('Node')) return 'node';
			if (layerName.includes('area') || layerName.includes('Area') || layerName.includes('Fläche'))
				return 'area';
		}
	}

	// Fallback: detect from feature properties
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
 * Format feature properties for display (remove internal fields)
 * @param {Object} properties - Raw feature properties from MVT
 * @param {string} type - Feature type ('trench', 'address', 'node')
 * @returns {Object} - Cleaned properties object
 */
export function formatFeatureProperties(properties, type) {
	if (!properties) return {};

	// Fields to always exclude
	const excludeFields = ['geometry', 'layer', 'uuid'];

	// Create a new object with filtered properties
	const formatted = {};
	for (const [key, value] of Object.entries(properties)) {
		// Skip excluded fields and null/undefined values
		if (excludeFields.includes(key) || value === null || value === undefined) {
			continue;
		}
		formatted[key] = value;
	}

	return formatted;
}

/**
 * Get a display title for a feature
 * @param {Object} feature - OpenLayers feature
 * @param {string} type - Feature type ('trench', 'address', 'node', 'area')
 * @returns {string} - Display title
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
 * Get human-readable field name for property key
 * @param {string} key - Property key
 * @returns {string} - Human-readable label
 */
export function getFieldLabel(key) {
	// Convert snake_case to Title Case
	return key
		.split('_')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
}
