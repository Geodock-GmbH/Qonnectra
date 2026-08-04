import type { AreaTypeStyles, LabelOptions, NodeShape, NodeTypeStyles } from './styles';
import type ImageTile from 'ol/ImageTile';
import type Projection from 'ol/proj/Projection';
import type VectorTileSource from 'ol/source/VectorTile';
import { getTopLeft, getWidth } from 'ol/extent.js';
import TileLayer from 'ol/layer/Tile.js';
import VectorTileLayer from 'ol/layer/VectorTile.js';
import { get as getProjection } from 'ol/proj.js';
import TileWMS from 'ol/source/TileWMS.js';
import { Style } from 'ol/style';
import TileGrid from 'ol/tilegrid/TileGrid.js';

import {
	getCurrentWMSToken,
	requestImmediateWMSRefresh
} from '$lib/utils/wmsTokenHeartbeat.svelte';

import {
	createAddressStyleWithLabels,
	createAreaStyleByType,
	createAreaStyleWithLabels,
	createNodeStyle,
	createNodeStyleByType,
	createNodeStyleWithLabels,
	createSelectedStyle,
	createTrenchStyle,
	createTrenchStyleWithLabels,
	DEFAULT_ADDRESS_COLOR,
	DEFAULT_ADDRESS_SIZE,
	DEFAULT_AREA_COLOR,
	DEFAULT_NODE_SHAPE,
	DEFAULT_TRENCH_COLOR,
	getNodeTypeDefault
} from './styles';
import { tileLoadingManager } from './tileLoadingManager';
import {
	createAddressTileSource,
	createAreaTileSource,
	createNodeTileSource,
	createTrenchTileSource
} from './tileSources';

export type LayerErrorCallback = (title: string, message: string) => void;

export interface WMSLayerOptions {
	proxyUrl: string;
	layerName: string;
	layerId: string;
	displayName: string;
	sourceId: string;
	sourceName: string;
	minZoom?: number;
	maxZoom?: number;
	opacity?: number;
}

/** Creates a vector tile layer for trench features with optional labeling. */
export function createTrenchLayer(
	selectedProject: string,
	layerName: string,
	onError: LayerErrorCallback | undefined,
	labelOptions: LabelOptions = {}
): VectorTileLayer {
	const tileSource = createTrenchTileSource(selectedProject, onError);

	const style = labelOptions.enabled
		? createTrenchStyleWithLabels(DEFAULT_TRENCH_COLOR, labelOptions)
		: createTrenchStyle(DEFAULT_TRENCH_COLOR);

	return new VectorTileLayer({
		source: tileSource,
		style: style,
		renderMode: 'vector',
		declutter: labelOptions.enabled,
		properties: {
			layerId: 'trench-layer',
			layerName: layerName
		}
	});
}

/** Creates a vector tile layer for address features with optional labeling. */
export function createAddressLayer(
	selectedProject: string,
	layerName: string,
	onError: LayerErrorCallback | undefined,
	labelOptions: LabelOptions = {}
): VectorTileLayer {
	const tileSource = createAddressTileSource(selectedProject, onError);

	const style = createAddressStyleWithLabels(
		DEFAULT_ADDRESS_COLOR,
		DEFAULT_ADDRESS_SIZE,
		labelOptions
	);

	return new VectorTileLayer({
		source: tileSource,
		style: style,
		renderMode: 'vector',
		declutter: labelOptions.enabled,
		properties: {
			layerId: 'address-layer',
			layerName: layerName
		}
	});
}

/** Creates a vector tile layer for node features with optional per-type styling and labels. */
export function createNodeLayer(
	selectedProject: string,
	layerName: string,
	onError: LayerErrorCallback | undefined,
	labelOptions: LabelOptions = {},
	nodeTypeStyles: NodeTypeStyles | null = null
): VectorTileLayer {
	const tileSource = createNodeTileSource(selectedProject, onError);

	let style;
	if (nodeTypeStyles !== null) {
		style = createNodeStyleByType(nodeTypeStyles, labelOptions);
	} else if (labelOptions.enabled) {
		style = createNodeStyleWithLabels(labelOptions);
	} else {
		style = createNodeStyle();
	}

	return new VectorTileLayer({
		source: tileSource,
		style: style,
		renderMode: 'vector',
		declutter: labelOptions.enabled,
		properties: {
			layerId: 'node-layer',
			layerName: layerName
		}
	});
}

/** Creates a vector tile layer for area (polygon) features with optional per-type styling and labels. */
export function createAreaLayer(
	selectedProject: string,
	layerName: string,
	onError: LayerErrorCallback | undefined,
	labelOptions: LabelOptions = {},
	areaTypeStyles: AreaTypeStyles | null = null
): VectorTileLayer {
	const tileSource = createAreaTileSource(selectedProject, onError);

	let style;
	if (areaTypeStyles !== null) {
		style = createAreaStyleByType(areaTypeStyles, labelOptions);
	} else {
		style = createAreaStyleWithLabels(DEFAULT_AREA_COLOR, 0.3, labelOptions);
	}

	return new VectorTileLayer({
		source: tileSource,
		style: style,
		renderMode: 'vector',
		declutter: labelOptions.enabled,
		properties: {
			layerId: 'area-layer',
			layerName: layerName
		}
	});
}

/** Creates a selection overlay layer that highlights selected features. */
export function createSelectionLayer(
	tileSource: VectorTileSource,
	selectedColor: string,
	getSelectionStore: () => Record<string, unknown>
): VectorTileLayer {
	const selectedStyle = createSelectedStyle(selectedColor);

	return new VectorTileLayer({
		renderMode: 'vector',
		source: tileSource,
		style: function (feature) {
			const selectionStore = getSelectionStore();
			const featureId = feature.getId();
			if (featureId !== undefined && selectionStore[featureId]) {
				return selectedStyle;
			}
			return undefined;
		},
		properties: {
			isSelectionLayer: true
		}
	});
}

/** Creates a node-specific selection layer that respects per-type shapes. */
export function createNodeSelectionLayer(
	tileSource: VectorTileSource,
	selectedColor: string,
	getSelectionStore: () => Record<string, unknown>,
	getNodeTypeStyles: () => Record<
		string,
		{ color?: string; size?: number; visible?: boolean; shape?: NodeShape }
	>
): VectorTileLayer {
	const styleCache = new Map<string, Style>();

	return new VectorTileLayer({
		renderMode: 'vector',
		source: tileSource,
		style: function (feature) {
			const selectionStore = getSelectionStore();
			const featureId = feature.getId();
			if (featureId === undefined || !selectionStore[featureId]) {
				return undefined;
			}

			const nodeType = feature.get('node_type') as string;
			const nodeTypeStyles = getNodeTypeStyles();
			const typeConfig = nodeTypeStyles[nodeType];
			const defaults = getNodeTypeDefault(nodeType);
			const shape = typeConfig?.shape || defaults.shape || DEFAULT_NODE_SHAPE;

			const cacheKey = `${selectedColor}_${shape}`;
			let style = styleCache.get(cacheKey);
			if (!style) {
				style = createSelectedStyle(selectedColor, shape);
				styleCache.set(cacheKey, style);
			}
			return style;
		},
		properties: {
			isSelectionLayer: true
		}
	});
}

/** Creates a TileWMS layer with AbortController support for request cancellation. */
export function createWMSLayer({
	proxyUrl,
	layerName,
	layerId,
	displayName,
	sourceId,
	sourceName,
	minZoom = 8,
	maxZoom = undefined,
	opacity = 1.0
}: WMSLayerOptions): TileLayer<TileWMS> {
	let requestCounter = 0;
	let authFailed = false;
	let authErrorLogged = false;
	let had401 = false;

	const projection = getProjection('EPSG:3857') as Projection;
	const projectionExtent = projection.getExtent();
	const size = getWidth(projectionExtent) / 512;
	const resolutions = Array.from({ length: 23 }, (_, z) => size / Math.pow(2, z));

	const wmsTileGrid = new TileGrid({
		origin: getTopLeft(projectionExtent),
		resolutions: resolutions,
		tileSize: 512
	});

	const source = new TileWMS({
		url: proxyUrl,
		params: {
			LAYERS: layerName,
			FORMAT: 'image/png',
			TRANSPARENT: true,
			VERSION: '1.3.0',
			CRS: 'EPSG:3857'
		},
		projection: 'EPSG:3857',
		tileGrid: wmsTileGrid,
		crossOrigin: 'anonymous',
		tileLoadFunction: (baseTile, src) => {
			const tile = baseTile as ImageTile;

			if (tileLoadingManager.isLoadingPaused() || authFailed) {
				tile.setState(4);
				return;
			}

			const requestId = `wms-${layerId}-${Date.now()}-${requestCounter++}`;
			const controller = tileLoadingManager.createAbortController(requestId);
			const image = tile.getImage() as HTMLImageElement;

			let tileUrl = src;
			const liveToken = getCurrentWMSToken();
			if (liveToken) {
				tileUrl = tileUrl.replace(/([?&])token=[^&]*/, `$1token=${encodeURIComponent(liveToken)}`);
			}

			fetch(tileUrl, {
				signal: controller.signal,
				credentials: 'include'
			})
				.then((response) => {
					if (!response.ok) {
						const error = new Error(`WMS request failed: ${response.statusText}`);
						(error as Error & { status: number }).status = response.status;
						throw error;
					}
					authErrorLogged = false;
					return response.blob();
				})
				.then((blob) => {
					const objectUrl = URL.createObjectURL(blob);
					image.src = objectUrl;
					image.onload = () => {
						URL.revokeObjectURL(objectUrl);
					};
				})
				.catch((error) => {
					if (error.name === 'AbortError') {
						tile.setState(4);
						return;
					}

					const status = (error as Error & { status?: number })?.status;
					if (status === 401 || status === 403) {
						had401 = true;
						if (!authErrorLogged) {
							authErrorLogged = true;
							console.warn(`WMS layer ${layerId}: tile got ${status}, requesting token refresh`);
							requestImmediateWMSRefresh();
						}
						tile.setState(4);
						return;
					}

					console.error(`WMS tile load error for ${layerId}:`, error);
					tile.setState(3);
				})
				.finally(() => {
					tileLoadingManager.removeAbortController(requestId);
				});
		}
	});

	/**
	 * Resets the auth failure flag so tiles can load again after a token refresh.
	 * Returns whether the source was in the failed state.
	 */
	source.set('resetAuthFailure', () => {
		const needsRefresh = authFailed || had401;
		authFailed = false;
		authErrorLogged = false;
		had401 = false;
		return needsRefresh;
	});

	source.set('setAuthFailed', () => {
		authFailed = true;
	});

	return new TileLayer({
		source: source,
		minZoom: minZoom,
		maxZoom: maxZoom,
		opacity: opacity,
		properties: {
			layerId: layerId,
			layerName: displayName,
			layerType: 'wms',
			wmsSourceId: sourceId,
			wmsSourceName: sourceName,
			wmsLayerName: layerName
		}
	});
}
