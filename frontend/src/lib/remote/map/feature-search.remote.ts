import type { ConduitTrenches, GeoJSONFeature, SearchResult } from './feature-search-data';
import { query } from '$app/server';
import * as v from 'valibot';

import { djangoHeaders } from '$lib/remote/shared/remote-auth';

import {
	getFeatureDetailsByType,
	getTrenchesForConduit,
	searchFeaturesInProject
} from './feature-search-data';

const UuidSchema = v.pipe(v.string(), v.nonEmpty());

const SearchFeaturesSchema = v.object({
	searchQuery: v.pipe(v.string(), v.trim(), v.nonEmpty()),
	projectId: v.optional(v.string(), '')
});

const FeatureDetailsSchema = v.object({
	featureType: v.picklist(['address', 'node', 'trench', 'area']),
	featureUuid: UuidSchema,
	projectId: v.optional(v.string(), '')
});

/**
 * Search addresses, nodes, trenches, conduits and areas by a free-text term.
 * @param input.searchQuery - The search term.
 * @param input.projectId - Project to scope the search to; empty searches all projects.
 * @returns The combined search results.
 * @throws When a backend request fails.
 */
export const searchFeatures = query(
	SearchFeaturesSchema,
	async ({ searchQuery, projectId }): Promise<SearchResult[]> =>
		searchFeaturesInProject(djangoHeaders(), searchQuery, projectId)
);

/**
 * Fetch one searchable feature with its geometry.
 * @param input.featureType - Kind of feature to look up.
 * @param input.featureUuid - UUID of the feature.
 * @param input.projectId - Project to scope the lookup to; empty looks in all projects.
 * @returns The feature.
 * @throws With 404 when no feature matches, or when the backend request fails.
 */
export const getFeatureDetails = query(
	FeatureDetailsSchema,
	async ({ featureType, featureUuid, projectId }): Promise<GeoJSONFeature> =>
		getFeatureDetailsByType(djangoHeaders(), featureType, featureUuid, projectId)
);

/**
 * Fetch every trench a conduit runs through, including the geometries.
 * @param conduitUuid - UUID of the conduit.
 * @returns The trench UUIDs and the trench features that could be resolved.
 * @throws When a backend request fails.
 */
export const getConduitTrenches = query(
	UuidSchema,
	async (conduitUuid): Promise<ConduitTrenches> =>
		getTrenchesForConduit(djangoHeaders(), conduitUuid)
);
