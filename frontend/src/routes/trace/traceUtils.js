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
 * Builds a GeoJSON FeatureCollection from trace result geometries.
 * Includes cable/trench LineStrings and node/address Point features.
 * @param {Record<string, any>} traceResult - The trace result containing cable_infrastructure and trace tree(s)
 * @param {number} srid - The EPSG code for the coordinate reference system (e.g. 25832)
 * @returns {Record<string, any>} GeoJSON FeatureCollection in the specified SRID
 */
export function buildGeoJSON(traceResult, srid) {
	const features = [];
	const cableInfra = traceResult.cable_infrastructure || {};

	for (const [cableId, infra] of Object.entries(cableInfra)) {
		if (infra.merged_geometry) {
			features.push({
				type: 'Feature',
				properties: {
					feature_type: 'cable',
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
							feature_type: 'trench',
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

	const seenIds = new Set();
	const trees = traceResult.trace_trees || (traceResult.trace_tree ? [traceResult.trace_tree] : []);

	/** @param {Record<string, any>} endpointNode */
	function addNodeFeature(endpointNode) {
		if (!endpointNode?.geometry || seenIds.has(endpointNode.id)) return;
		seenIds.add(endpointNode.id);
		features.push({
			type: 'Feature',
			properties: { feature_type: 'node', id: endpointNode.id, name: endpointNode.name },
			geometry: endpointNode.geometry
		});
		if (endpointNode.address?.geometry && !seenIds.has(endpointNode.address.id)) {
			seenIds.add(endpointNode.address.id);
			features.push({
				type: 'Feature',
				properties: {
					feature_type: 'address',
					id: endpointNode.address.id,
					street: endpointNode.address.street,
					housenumber: endpointNode.address.housenumber,
					suffix: endpointNode.address.suffix || '',
					zip_code: endpointNode.address.zip_code,
					city: endpointNode.address.city
				},
				geometry: endpointNode.address.geometry
			});
		}
	}

	/** @param {Record<string, any>} treeNode */
	function extractPointFeatures(treeNode) {
		if (!treeNode) return;
		addNodeFeature(treeNode.node);
		const endpoints = treeNode.cable_endpoints;
		if (endpoints) {
			addNodeFeature(endpoints.start_node);
			addNodeFeature(endpoints.end_node);
		}
		for (const child of treeNode.children || []) {
			extractPointFeatures(child);
		}
	}

	for (const tree of trees) {
		extractPointFeatures(tree);
	}

	return {
		type: 'FeatureCollection',
		name: 'fiber_trace_infrastructure',
		crs: {
			type: 'name',
			properties: { name: `urn:ogc:def:crs:EPSG::${srid}` }
		},
		features
	};
}

/**
 * Checks whether the trace result contains any geometry data (trench or point).
 * @param {Record<string, any>} traceResult - The trace result
 * @returns {boolean} True if at least one geometry exists
 */
export function hasGeometries(traceResult) {
	if (!traceResult) return false;

	if (traceResult.cable_infrastructure) {
		for (const infra of Object.values(traceResult.cable_infrastructure)) {
			if (infra.merged_geometry) return true;
			if (infra.trenches?.some((/** @type {any} */ t) => t.geometry)) return true;
		}
	}

	const trees = traceResult.trace_trees || (traceResult.trace_tree ? [traceResult.trace_tree] : []);

	/** @param {Record<string, any>} treeNode */
	function hasPointGeometry(treeNode) {
		if (!treeNode) return false;
		if (treeNode.node?.geometry) return true;
		if (treeNode.node?.address?.geometry) return true;
		const ep = treeNode.cable_endpoints;
		if (ep?.start_node?.geometry || ep?.end_node?.geometry) return true;
		return (treeNode.children || []).some(hasPointGeometry);
	}

	return trees.some(hasPointGeometry);
}

/**
 * Triggers a browser download of the trace infrastructure as a GeoJSON file.
 * @param {Record<string, any>} result - The trace result data
 * @param {string} filenamePrefix - Prefix for the download filename (e.g. 'fiber-trace' or 'signal-analysis')
 * @param {string} entryId - Entry UUID used in the filename
 * @param {number} srid - The EPSG code for the coordinate reference system (e.g. 25832)
 * @returns {void}
 */
export function downloadGeoJSON(result, filenamePrefix, entryId, srid) {
	const geojson = buildGeoJSON(result, srid);
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
