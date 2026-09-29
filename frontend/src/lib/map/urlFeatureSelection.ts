import type { MapFeatureKind } from './featureDetails';
import type { StorageProjection } from './projectionUtils';
import type { MapSelectionManager } from '$lib/classes/MapSelectionManager.svelte';
import type { UrlFeature } from '$lib/utils/urlState';
import type OlMap from 'ol/Map';

import { getFeatureDetails } from '$lib/remote/map/feature-search.remote';

import { storageReadOptions } from './projectionUtils';
import { parseFeatureGeometry, zoomToFeature } from './searchUtils';

type SelectionTarget = Pick<
	MapSelectionManager,
	'isSelected' | 'selectMultipleFeatures' | 'clearSelection'
>;

export interface UrlSelectionOptions {
	/** The map, or null while it is still loading. */
	map: OlMap | null;
	selectionManager: SelectionTarget;
	/** The drawer feature from the URL, or null when the drawer is closed. */
	feature: UrlFeature<MapFeatureKind> | null;
	/** The URL hash; a `#map=` view means the sender chose the view, so no zoom. */
	hash: string;
	/** Project to look the feature up in; empty in the global view. */
	lookupProjectId: string;
	/** Projection the backend geometries are stored in; null means no zoom is possible. */
	storage: StorageProjection | null;
}

/**
 * Mirrors the drawer feature from the URL onto the map selection: the URL
 * is the source, the selection its cache. A feature that is already
 * selected was clicked on the map, so nothing moves; a feature arriving by
 * URL (initial load, back, forward, a shared link) is selected and, unless
 * the URL carries a map view, zoomed to. Does nothing while the map is not
 * ready; the map-ready handler calls this again.
 * @param options - The map, the selection, and what the URL says.
 * @returns Resolves once the selection, and any zoom, are applied.
 */
export async function selectUrlFeature(options: UrlSelectionOptions): Promise<void> {
	const { map, selectionManager, feature, hash, lookupProjectId, storage } = options;
	if (!map) return;
	if (!feature) {
		selectionManager.clearSelection();
		return;
	}
	if (selectionManager.isSelected(feature.id)) return;

	selectionManager.selectMultipleFeatures([feature.id]);
	if (hash.startsWith('#map=') || !storage) return;

	try {
		const details = await getFeatureDetails({
			featureType: feature.kind,
			featureUuid: feature.id,
			projectId: lookupProjectId
		});
		const mapProjection = map.getView().getProjection().getCode();
		const { dataProjection } = storageReadOptions(storage, mapProjection);
		const geometry = await parseFeatureGeometry(
			details,
			dataProjection ?? mapProjection,
			mapProjection
		);
		if (geometry) await zoomToFeature(map, geometry, undefined, { blinkCount: 0 });
	} catch {
		// The drawer shows the lookup failure; the map just stays where it is.
	}
}
