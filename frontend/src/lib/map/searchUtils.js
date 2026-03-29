/**
 * Search utilities for map features
 */

/**
 * Creates a highlight layer for temporarily highlighting features
 * @param {import('ol/style/Style').default} highlightStyle - Style for the highlight
 * @returns {Promise<import('ol/layer/Vector').default>} Vector layer for highlighting
 */
export async function createHighlightLayer(highlightStyle) {
	const [{ default: VectorLayer }, { default: VectorSource }] = await Promise.all([
		import('ol/layer/Vector'),
		import('ol/source/Vector')
	]);

	return new VectorLayer({
		source: new VectorSource(),
		style: highlightStyle,
		zIndex: 1000,
		properties: {
			isHighlightLayer: true
		}
	});
}

/**
 * Creates a highlight style for features
 * @param {string} color - Color for the highlight (default: '#ff0000')
 * @returns {Promise<import('ol/style/Style').default>} Highlight style
 */
export async function createHighlightStyle(color = '#ff0000') {
	const [{ default: Style }, { default: Stroke }, { default: Fill }, { default: Circle }] =
		await Promise.all([
			import('ol/style/Style'),
			import('ol/style/Stroke'),
			import('ol/style/Fill'),
			import('ol/style/Circle')
		]);

	return new Style({
		stroke: new Stroke({
			color: color,
			width: 4,
			lineDash: [10, 10]
		}),
		fill: new Fill({
			color: color + '40' // 25% opacity
		}),
		image: new Circle({
			radius: 8,
			fill: new Fill({
				color: color + '80' // 50% opacity
			}),
			stroke: new Stroke({
				color: color,
				width: 3
			})
		})
	});
}

/**
 * Parses geometry from GeoJSON feature and converts to OL geometry
 * @param {Object} feature - GeoJSON feature from API
 * @param {string} fromProjection - Source projection (e.g. 'EPSG:25832')
 * @param {string | null} toProjection - Target projection (default: map projection)
 * @returns {Promise<import('ol/geom/Geometry').default | undefined>} OpenLayers geometry
 */
export async function parseFeatureGeometry(feature, fromProjection, toProjection = null) {
	const [{ default: GeoJSON }] = await Promise.all([import('ol/format/GeoJSON')]);

	const geoJsonFormat = new GeoJSON();

	const olFeature = geoJsonFormat.readFeature(feature, {
		dataProjection: fromProjection,
		featureProjection: toProjection || fromProjection
	});

	if (Array.isArray(olFeature)) {
		return olFeature[0]?.getGeometry();
	}

	return olFeature.getGeometry();
}

/**
 * Zooms the map to a feature with animation and highlighting
 * @param {import('ol/Map').default} map - OpenLayers map instance
 * @param {import('ol/geom/Geometry').default} geometry - Geometry to zoom to
 * @param {import('ol/layer/Vector').default} highlightLayer - Layer for highlighting
 * @param {Object} [options] - Zoom options
 * @param {number[]} [options.padding] - Padding around the feature [top, right, bottom, left]
 * @param {number} [options.duration] - Animation duration in ms
 * @param {number} [options.maxZoom] - Maximum zoom level
 * @param {number} [options.blinkCount] - Number of blinks for highlight
 */
export async function zoomToFeature(map, geometry, highlightLayer, options = {}) {
	const { padding = [50, 50, 50, 50], duration = 1000, maxZoom = 20, blinkCount = 6 } = options;

	const [{ default: Feature }] = await Promise.all([import('ol/Feature')]);

	const view = map.getView();
	const extent = geometry.getExtent();

	view.fit(extent, {
		duration: duration,
		padding: padding,
		maxZoom: maxZoom,
		callback: () => {
			if (highlightLayer) {
				const highlightFeature = new Feature(geometry);
				const source = highlightLayer.getSource();
				if (!source) return;
				let currentBlinkCount = 0;

				const blinkInterval = setInterval(() => {
					if (currentBlinkCount % 2 === 0) {
						source.addFeature(highlightFeature);
					} else {
						source.removeFeature(highlightFeature);
					}
					currentBlinkCount++;

					if (currentBlinkCount >= blinkCount) {
						clearInterval(blinkInterval);
						source.removeFeature(highlightFeature);
					}
				}, 300);
			}
		}
	});
}

/**
 * Debounce function to limit API calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
	/** @type {ReturnType<typeof setTimeout> | undefined} */
	let timeout;
	return function executedFunction(/** @type {unknown[]} */ ...args) {
		const later = () => {
			clearTimeout(timeout);
			func(...args);
		};
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
	};
}

/**
 * Formats search results for combobox display
 * @param {{label: string, [key: string]: unknown}[]} results - Raw search results from API
 * @param {string} searchTerm - Original search term
 * @returns {{label: string, displayLabel: string, [key: string]: unknown}[]} Formatted results for combobox
 */
export function formatSearchResults(results, searchTerm) {
	return results.map((result) => ({
		...result,
		displayLabel: highlightSearchTerm(result.label, searchTerm)
	}));
}

/**
 * Highlights search term in text (for display purposes)
 * @param {string} text - Text to highlight in
 * @param {string} searchTerm - Term to highlight
 * @returns {string} Text with highlighted terms
 */
function highlightSearchTerm(text, searchTerm) {
	if (!searchTerm) return text;

	const regex = new RegExp(`(${searchTerm})`, 'gi');
	return text.replace(regex, '<mark>$1</mark>');
}

/**
 * Parse multiple GeoJSON features to OpenLayers geometries
 * @param {Object[]} features - Array of GeoJSON features from API
 * @param {string} fromProjection - Source projection (e.g. 'EPSG:25832')
 * @param {string | null} toProjection - Target projection (default: map projection)
 * @returns {Promise<(import('ol/geom/Geometry').default | undefined)[]>} Array of OpenLayers geometries
 */
export async function parseMultipleFeatureGeometries(
	features,
	fromProjection,
	toProjection = null
) {
	const geometries = await Promise.all(
		features.map((feature) => parseFeatureGeometry(feature, fromProjection, toProjection))
	);
	return geometries;
}

/**
 * Zooms the map to a bounding box extent with animation
 * @param {import('ol/Map').default} map - OpenLayers map instance
 * @param {number[]} extent - Bounding box [xmin, ymin, xmax, ymax] in EPSG:3857
 * @param {Object} [options] - Zoom options
 * @param {number[]} [options.padding] - Padding around the extent [top, right, bottom, left]
 * @param {number} [options.duration] - Animation duration in ms
 * @param {number} [options.maxZoom] - Maximum zoom level
 */
export function zoomToExtent(map, extent, options = {}) {
	const { padding = [50, 50, 50, 50], duration = 800, maxZoom = 18 } = options;

	const view = map.getView();
	view.fit(extent, { duration, padding, maxZoom });
}

/**
 * Zooms the map to multiple features with animation and highlighting
 * @param {import('ol/Map').default} map - OpenLayers map instance
 * @param {import('ol/geom/Geometry').default[]} geometries - Array of geometries to zoom to
 * @param {import('ol/layer/Vector').default} highlightLayer - Layer for highlighting
 * @param {Object} [options] - Zoom options
 * @param {number[]} [options.padding] - Padding around the features [top, right, bottom, left]
 * @param {number} [options.duration] - Animation duration in ms
 * @param {number} [options.maxZoom] - Maximum zoom level
 * @param {number} [options.blinkCount] - Number of blinks for highlight
 */
export async function zoomToMultipleFeatures(map, geometries, highlightLayer, options = {}) {
	const { padding = [50, 50, 50, 50], duration = 1000, maxZoom = 17, blinkCount = 6 } = options;

	const [{ default: Feature }, { extend, createEmpty }] = await Promise.all([
		import('ol/Feature'),
		import('ol/extent')
	]);

	let combinedExtent = createEmpty();
	geometries.forEach((geometry) => {
		extend(combinedExtent, geometry.getExtent());
	});

	const view = map.getView();

	view.fit(combinedExtent, {
		duration: duration,
		padding: padding,
		maxZoom: maxZoom,
		callback: () => {
			if (highlightLayer) {
				const highlightFeatures = geometries.map((g) => new Feature(g));
				const source = highlightLayer.getSource();
				if (!source) return;
				let currentBlinkCount = 0;

				const blinkInterval = setInterval(() => {
					if (currentBlinkCount % 2 === 0) {
						highlightFeatures.forEach((f) => source.addFeature(f));
					} else {
						highlightFeatures.forEach((f) => source.removeFeature(f));
					}
					currentBlinkCount++;

					if (currentBlinkCount >= blinkCount) {
						clearInterval(blinkInterval);
						highlightFeatures.forEach((f) => {
							if (!source.hasFeature(f)) {
								source.addFeature(f);
							}
						});
					}
				}, 300);
			}
		}
	});
}
