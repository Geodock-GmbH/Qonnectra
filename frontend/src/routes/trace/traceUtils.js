import { goto } from '$app/navigation';

/**
 * Navigates to the trace page for a given entity.
 * @param {string} type - Entity type (e.g. 'fiber', 'cable', 'node', 'address', 'residential_unit')
 * @param {string} id - Entity UUID
 */
export function traceFrom(type, id) {
	const typeSlug = type === 'residential_unit' ? 'residential-unit' : type;
	goto(`/trace/${typeSlug}/${id}`);
}

/**
 * Builds a GeoJSON FeatureCollection from cable infrastructure geometries.
 * Prefers merged geometry per cable; falls back to individual trench segments.
 * @param {Record<string, any>} traceResult - The trace result containing cable_infrastructure
 * @returns {Record<string, any>} GeoJSON FeatureCollection in EPSG:25832
 */
export function buildGeoJSON(traceResult) {
	const features = [];
	const cableInfra = traceResult.cable_infrastructure || {};

	for (const [cableId, infra] of Object.entries(cableInfra)) {
		if (infra.merged_geometry) {
			features.push({
				type: 'Feature',
				properties: {
					cable_id: cableId,
					conduit_name: infra.conduit?.name || null,
					conduit_type: infra.conduit?.type || null,
					microduct_number: infra.microduct?.number || null,
					microduct_color: infra.microduct?.color || null,
					total_length: infra.total_length || null,
					trench_count: infra.trenches?.length || 0,
					geometry_mode: 'merged'
				},
				geometry: infra.merged_geometry
			});
		} else if (infra.trenches) {
			for (const trench of infra.trenches) {
				if (trench.geometry) {
					features.push({
						type: 'Feature',
						properties: {
							cable_id: cableId,
							trench_id: trench.id,
							id_trench: trench.id_trench,
							construction_type: trench.construction_type,
							surface: trench.surface,
							length: trench.length,
							conduit_name: infra.conduit?.name || null,
							conduit_type: infra.conduit?.type || null,
							microduct_number: infra.microduct?.number || null,
							microduct_color: infra.microduct?.color || null,
							geometry_mode: 'segments'
						},
						geometry: trench.geometry
					});
				}
			}
		}
	}

	return {
		type: 'FeatureCollection',
		name: 'fiber_trace_infrastructure',
		crs: {
			type: 'name',
			properties: { name: 'urn:ogc:def:crs:EPSG::25832' }
		},
		features
	};
}

/**
 * Checks whether any cable infrastructure in the trace result contains geometry data.
 * @param {Record<string, any>} traceResult - The trace result containing cable_infrastructure
 * @returns {boolean} True if at least one geometry exists
 */
export function hasGeometries(traceResult) {
	if (!traceResult?.cable_infrastructure) return false;
	for (const infra of Object.values(traceResult.cable_infrastructure)) {
		if (infra.merged_geometry) return true;
		if (infra.trenches?.some((/** @type {any} */ t) => t.geometry)) return true;
	}
	return false;
}

/**
 * Triggers a browser download of the trace infrastructure as a GeoJSON file.
 * @param {Record<string, any>} result - The trace result data
 * @param {string} filenamePrefix - Prefix for the download filename (e.g. 'fiber-trace' or 'signal-analysis')
 * @param {string} entryId - Entry UUID used in the filename
 */
export function downloadGeoJSON(result, filenamePrefix, entryId) {
	const geojson = buildGeoJSON(result);
	const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	const entryIdShort = entryId?.slice(0, 8) || 'unknown';
	a.download = `${filenamePrefix}-${entryIdShort}.geojson`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}
