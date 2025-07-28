// OpenLayers
import MVT from 'ol/format/MVT.js';
import VectorTileSource from 'ol/source/VectorTile.js';
import { PUBLIC_API_URL } from '$env/static/public';

/**
 * Creates a vector tile source for trenches
 * @param {import('svelte/store').Readable<string>} selectedProject - Store containing the selected project ID
 * @param {Function} onError - Error callback function
 * @returns {VectorTileSource}
 */
export function createTrenchTileSource(selectedProject, onError) {
	return new VectorTileSource({
		format: new MVT({
			idProperty: 'uuid'
		}),
		tileUrlFunction: (tileCoord) => {
			const [z, x, y] = tileCoord;
			const projectId = parseInt(selectedProject, 10);
			if (isNaN(projectId)) {
				return undefined;
			}
			return `${PUBLIC_API_URL}ol_trench_tiles/${z}/${x}/${y}.mvt?project=${projectId}`;
		},
		tileLoadFunction: (tile, url) => {
			if (!url) {
				tile.setState(4); // EMPTY
				return;
			}
			tile.setLoader((extent, resolution, projection) => {
				fetch(url, {
					credentials: 'include'
				})
					.then((response) => {
						if (!response.ok) {
							throw new Error(`Failed to load tile: ${response.statusText}`);
						}
						return response.arrayBuffer();
					})
					.then((data) => {
						const format = tile.getFormat();
						const features = format.readFeatures(data, {
							extent: extent,
							featureProjection: projection
						});
						tile.setFeatures(features);
					})
					.catch((error) => {
						console.error('Error loading vector tile:', error);
						tile.setState(3); // ERROR
						if (onError) {
							onError('Error loading a map tile', error.message || 'Could not fetch tile data.');
						}
					});
			});
		}
	});
}

/**
 * Creates a vector tile source for addresses
 * @param {import('svelte/store').Readable<string>} selectedProject - Store containing the selected project ID
 * @param {Function} onError - Error callback function
 * @returns {VectorTileSource}
 */
export function createAddressTileSource(selectedProject, onError) {
	return new VectorTileSource({
		format: new MVT({
			idProperty: 'uuid'
		}),
		tileUrlFunction: (tileCoord) => {
			const [z, x, y] = tileCoord;
			const projectId = parseInt(selectedProject, 10);
			if (isNaN(projectId)) {
				return undefined;
			}
			return `${PUBLIC_API_URL}ol_address_tiles/${z}/${x}/${y}.mvt?project=${projectId}`;
		},
		tileLoadFunction: (tile, url) => {
			if (!url) {
				tile.setState(4); // EMPTY
				return;
			}
			tile.setLoader((extent, resolution, projection) => {
				fetch(url, {
					credentials: 'include'
				})
					.then((response) => {
						if (!response.ok) {
							throw new Error(`Failed to load address tile: ${response.statusText}`);
						}
						return response.arrayBuffer();
					})
					.then((data) => {
						const format = tile.getFormat();
						const features = format.readFeatures(data, {
							extent: extent,
							featureProjection: projection
						});
						tile.setFeatures(features);
					})
					.catch((error) => {
						console.error('Error loading address vector tile:', error);
						tile.setState(3); // ERROR
						if (onError) {
							onError('Error loading address tile', error.message || 'Could not fetch address tile data.');
						}
					});
			});
		}
	});
}

/**
 * Creates a vector tile source for nodes
 * @param {import('svelte/store').Readable<string>} selectedProject - Store containing the selected project ID
 * @param {Function} onError - Error callback function
 * @returns {VectorTileSource}
 */
export function createNodeTileSource(selectedProject, onError) {
	return new VectorTileSource({
		format: new MVT({
			idProperty: 'uuid'
		}),
		tileUrlFunction: (tileCoord) => {
			const [z, x, y] = tileCoord;
			const projectId = parseInt(selectedProject, 10);
			if (isNaN(projectId)) {
				return undefined;
			}
			return `${PUBLIC_API_URL}ol_node_tiles/${z}/${x}/${y}.mvt?project=${projectId}`;
		},
		tileLoadFunction: (tile, url) => {
			if (!url) {
				tile.setState(4); // EMPTY
				return;
			}
			tile.setLoader((extent, resolution, projection) => {
				fetch(url, {
					credentials: 'include'
				})
					.then((response) => {
						if (!response.ok) {
							throw new Error(`Failed to load node tile: ${response.statusText}`);
						}
						return response.arrayBuffer();
					})
					.then((data) => {
						const format = tile.getFormat();
						const features = format.readFeatures(data, {
							extent: extent,
							featureProjection: projection
						});
						tile.setFeatures(features);
					})
					.catch((error) => {
						console.error('Error loading node vector tile:', error);
						tile.setState(3); // ERROR
						if (onError) {
							onError('Error loading node tile', error.message || 'Could not fetch node tile data.');
						}
					});
			});
		}
	});
}