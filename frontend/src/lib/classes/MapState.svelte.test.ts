import type { Map } from 'ol';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { tileLoadingManager } from '$lib/map/tileLoadingManager';
import { wmsSourcesData } from '$lib/stores/store';
import { globalToaster } from '$lib/stores/toaster';
import { fetchWMSAccessToken, fetchWMSSources } from '$lib/utils/wmsApi';
import {
	isWMSHeartbeatRunning,
	requestImmediateWMSRefresh,
	startWMSHeartbeat,
	stopWMSHeartbeat
} from '$lib/utils/wmsTokenHeartbeat.svelte';

import { MapState } from './MapState.svelte';

vi.mock('$env/static/public', () => ({
	PUBLIC_API_URL: 'http://mock-api.test/'
}));

vi.mock('$app/navigation', () => ({
	invalidateAll: vi.fn(() => Promise.resolve())
}));

vi.mock('$app/environment', () => ({
	browser: true
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => (params?: { count?: number }) =>
				params?.count !== undefined ? `${prop}:${params.count}` : `${prop}`
		}
	)
}));

vi.mock('$lib/stores/toaster', () => ({
	globalToaster: {
		success: vi.fn(),
		error: vi.fn(),
		warning: vi.fn()
	}
}));

vi.mock('$lib/utils/wmsApi', () => ({
	fetchWMSAccessToken: vi.fn(() => Promise.resolve('wms-token')),
	fetchWMSSources: vi.fn(() => Promise.resolve([])),
	getWMSProxyUrl: vi.fn(
		(sourceId: string, token?: string) =>
			`http://mock-api.test/wms-proxy/${sourceId}/?token=${token ?? ''}`
	)
}));

vi.mock('$lib/utils/wmsTokenHeartbeat.svelte', () => ({
	getCurrentWMSToken: vi.fn(() => null),
	isWMSHeartbeatRunning: vi.fn(() => false),
	requestImmediateWMSRefresh: vi.fn(),
	startWMSHeartbeat: vi.fn(),
	stopWMSHeartbeat: vi.fn()
}));

vi.mock('$lib/map/tileLoadingManager', () => ({
	tileLoadingManager: {
		isLoadingPaused: vi.fn(() => false),
		createAbortController: vi.fn(() => new AbortController()),
		removeAbortController: vi.fn(),
		cancelAllRequests: vi.fn(),
		resume: vi.fn()
	}
}));

vi.mock('$lib/map/workerPool', () => ({
	getWorkerPool: vi.fn(() => ({ workers: [], parse: vi.fn(), cancelAllRequests: vi.fn() }))
}));

class FakeOlMap {
	layerList: unknown[] = [];
	addLayer = vi.fn((layer: unknown) => this.layerList.push(layer));
	removeLayer = vi.fn((layer: unknown) => {
		const index = this.layerList.indexOf(layer);
		if (index >= 0) this.layerList.splice(index, 1);
	});
	getLayers = () => ({
		forEach: (callback: (layer: unknown, index: number) => void) =>
			this.layerList.forEach((layer, index) => callback(layer, index)),
		insertAt: (index: number, layer: unknown) => this.layerList.splice(index, 0, layer)
	});
}

const wmsSource = {
	id: 'src-1',
	name: 'DOP',
	is_active: true,
	layers: [
		{ name: 'dop20', title: 'Orthophotos', is_enabled: true, min_zoom: 10, opacity: 0.8 },
		{ name: 'disabled-layer', title: 'Aus', is_enabled: false }
	]
};

beforeEach(() => {
	localStorage.clear();
	wmsSourcesData.set({ sources: [], loaded: false });
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.mocked(fetchWMSSources).mockReset();
	vi.mocked(fetchWMSSources).mockResolvedValue([]);
	vi.mocked(fetchWMSAccessToken).mockReset();
	vi.mocked(fetchWMSAccessToken).mockResolvedValue('wms-token');
	vi.mocked(isWMSHeartbeatRunning).mockReset();
	vi.mocked(isWMSHeartbeatRunning).mockReturnValue(false);
	vi.clearAllMocks();
});

describe('initializeLayers', () => {
	test('should create all four layers and tile sources by default', () => {
		const mapState = new MapState('7');

		expect(mapState.initializeLayers()).toBe(true);
		expect(mapState.vectorTileLayer).not.toBeNull();
		expect(mapState.addressLayer).not.toBeNull();
		expect(mapState.nodeLayer).not.toBeNull();
		expect(mapState.areaLayer).not.toBeNull();
		expect(mapState.tileSource).not.toBeNull();
	});

	test('should skip layers disabled in the layer config', () => {
		const mapState = new MapState('7', undefined, {
			trench: true,
			address: false,
			node: false,
			area: false
		});

		mapState.initializeLayers();

		expect(mapState.vectorTileLayer).not.toBeNull();
		expect(mapState.addressLayer).toBeNull();
		expect(mapState.nodeLayer).toBeNull();
		expect(mapState.areaLayer).toBeNull();
	});
});

describe('layer accessors', () => {
	test('getLayers should order layers WMS first, then area, trench, address, node', () => {
		const mapState = new MapState('7');
		mapState.initializeLayers();

		const layers = mapState.getLayers();

		expect(layers).toEqual([
			mapState.areaLayer,
			mapState.vectorTileLayer,
			mapState.addressLayer,
			mapState.nodeLayer
		]);
	});

	test('getLayerReferences should expose all feature layers', () => {
		const mapState = new MapState('7');
		mapState.initializeLayers();

		expect(mapState.getLayerReferences()).toEqual({
			vectorTileLayer: mapState.vectorTileLayer,
			addressLayer: mapState.addressLayer,
			nodeLayer: mapState.nodeLayer,
			areaLayer: mapState.areaLayer
		});
	});
});

describe('initializeSelectionLayers', () => {
	test('should add selection layers for every tile source', () => {
		const mapState = new MapState('7');
		mapState.initializeLayers();
		const olMap = new FakeOlMap();

		mapState.initializeSelectionLayers(olMap as unknown as Map, () => ({}));

		expect(olMap.addLayer).toHaveBeenCalledTimes(4);
		expect(mapState.getSelectionLayers()).toHaveLength(4);
	});

	test('should do nothing without a trench tile source', () => {
		const mapState = new MapState('7', undefined, {
			trench: false,
			address: true,
			node: true,
			area: true
		});
		mapState.initializeLayers();
		const olMap = new FakeOlMap();

		mapState.initializeSelectionLayers(olMap as unknown as Map, () => ({}));

		expect(olMap.addLayer).not.toHaveBeenCalled();
	});
});

describe('loadWMSLayers', () => {
	test('should build layers for enabled WMS layers and start the heartbeat', async () => {
		vi.mocked(fetchWMSSources).mockResolvedValue([wmsSource] as never);
		const mapState = new MapState('7');
		mapState.initializeLayers();
		mapState.olMap = new FakeOlMap() as unknown as Map;

		await mapState.loadWMSLayers();

		expect(mapState.wmsLayers).toHaveLength(1);
		expect(mapState.wmsLayers[0].get('layerId')).toBe('wms-src-1-dop20');
		expect(mapState.wmsLayers[0].getMinZoom()).toBe(10);
		expect(mapState.wmsLayers[0].getOpacity()).toBe(0.8);
		expect(get(wmsSourcesData)).toEqual({ sources: [wmsSource], loaded: true });
		expect(startWMSHeartbeat).toHaveBeenCalledWith(
			expect.any(Function),
			'wms-token',
			expect.any(Function)
		);
	});

	test('should skip inactive sources and not start the heartbeat without layers', async () => {
		vi.mocked(fetchWMSSources).mockResolvedValue([{ ...wmsSource, is_active: false }] as never);
		const mapState = new MapState('7');

		await mapState.loadWMSLayers();

		expect(mapState.wmsLayers).toHaveLength(0);
		expect(startWMSHeartbeat).not.toHaveBeenCalled();
	});

	test('should abort when the project changes mid-load', async () => {
		vi.mocked(fetchWMSSources).mockImplementation(async () => {
			mapState.selectedProject = 'other';
			return [wmsSource] as never;
		});
		const mapState = new MapState('7');

		await mapState.loadWMSLayers();

		expect(mapState.wmsLayers).toHaveLength(0);
	});

	test('should swallow WMS loading errors', async () => {
		vi.mocked(fetchWMSAccessToken).mockRejectedValue(new Error('offline'));
		const mapState = new MapState('7');

		await expect(mapState.loadWMSLayers()).resolves.toBeUndefined();
		expect(console.warn).toHaveBeenCalled();
	});
});

describe('reinitializeForProject', () => {
	test('should recreate tile sources and cancel pending requests', () => {
		const mapState = new MapState('7');
		mapState.initializeLayers();
		const oldSource = mapState.tileSource;

		mapState.reinitializeForProject('8');

		expect(mapState.selectedProject).toBe('8');
		expect(mapState.tileSource).not.toBe(oldSource);
		expect(tileLoadingManager.cancelAllRequests).toHaveBeenCalled();
	});

	test('should do nothing for the same project', () => {
		const mapState = new MapState('7');
		mapState.initializeLayers();
		const oldSource = mapState.tileSource;

		mapState.reinitializeForProject('7');

		expect(mapState.tileSource).toBe(oldSource);
	});
});

describe('reinitializeForGlobalView', () => {
	test('should recreate sources when toggling global view', () => {
		const mapState = new MapState('7');
		mapState.initializeLayers();
		const oldSource = mapState.tileSource;

		mapState.reinitializeForGlobalView(true);

		expect(mapState.isGlobalView).toBe(true);
		expect(mapState.tileSource).not.toBe(oldSource);
	});

	test('should do nothing when the mode is unchanged', () => {
		const mapState = new MapState('7');
		mapState.initializeLayers();
		const oldSource = mapState.tileSource;

		mapState.reinitializeForGlobalView(false);

		expect(mapState.tileSource).toBe(oldSource);
	});
});

describe('layer style updates', () => {
	test('updateNodeLayerStyle should restyle and refresh the node source', () => {
		const mapState = new MapState('7');
		mapState.initializeLayers();
		const refreshSpy = vi.spyOn(mapState.nodeTileSource!, 'refresh');

		mapState.updateNodeLayerStyle({ POP: { color: '#ff0000' } });

		expect(typeof mapState.nodeLayer!.getStyle()).toBe('function');
		expect(refreshSpy).toHaveBeenCalled();
	});

	test('updateTrenchLayerStyle should use attribute styling for the surface mode', () => {
		const mapState = new MapState('7');
		mapState.initializeLayers();
		const refreshSpy = vi.spyOn(mapState.tileSource!, 'refresh');

		mapState.updateTrenchLayerStyle('surface', { asphalt: { color: '#111111' } }, {}, '#0033ff');

		expect(typeof mapState.vectorTileLayer!.getStyle()).toBe('function');
		expect(refreshSpy).toHaveBeenCalled();
	});

	test('updateAddressLayerStyle should remember color and size overrides', () => {
		const mapState = new MapState('7');
		mapState.initializeLayers();

		mapState.updateAddressLayerStyle('#123456', 9);

		expect(mapState.addressColor).toBe('#123456');
		expect(mapState.addressSize).toBe(9);
	});

	test('updateAreaLayerStyle should restyle and refresh the area source', () => {
		const mapState = new MapState('7');
		mapState.initializeLayers();
		const refreshSpy = vi.spyOn(mapState.areaTileSource!, 'refresh');

		mapState.updateAreaLayerStyle({ forest: { color: '#005500' } });

		expect(refreshSpy).toHaveBeenCalled();
	});
});

describe('updateLabelVisibility', () => {
	test('should enable labels and restyle the affected layer', () => {
		const mapState = new MapState('7');
		mapState.initializeLayers();
		const refreshSpy = vi.spyOn(mapState.addressTileSource!, 'refresh');

		mapState.updateLabelVisibility('address', true);

		expect(mapState.labelConfig.address.enabled).toBe(true);
		expect(refreshSpy).toHaveBeenCalled();
	});

	test('should do nothing when the flag is unchanged', () => {
		const mapState = new MapState('7');
		mapState.initializeLayers();
		const refreshSpy = vi.spyOn(mapState.addressTileSource!, 'refresh');

		mapState.updateLabelVisibility('address', false);

		expect(refreshSpy).not.toHaveBeenCalled();
	});

	test('should restyle trenches with the given mode', () => {
		const mapState = new MapState('7');
		mapState.initializeLayers();
		const refreshSpy = vi.spyOn(mapState.tileSource!, 'refresh');

		mapState.updateLabelVisibility('trench', true, { mode: 'none', color: '#0033ff' });

		expect(mapState.labelConfig.trench.enabled).toBe(true);
		expect(refreshSpy).toHaveBeenCalled();
	});
});

describe('WMS auth handling', () => {
	function makeWmsLayerStub(needsRefresh: boolean) {
		const source = {
			values: {
				setAuthFailed: vi.fn(),
				resetAuthFailure: vi.fn(() => needsRefresh)
			} as Record<string, unknown>,
			get(key: string) {
				return this.values[key];
			},
			refresh: vi.fn(),
			dispose: vi.fn()
		};
		return {
			source,
			layer: { getSource: () => source, get: () => undefined } as never
		};
	}

	test('pauseAllWMSLayers should flag every WMS source', () => {
		const mapState = new MapState('7');
		const { layer, source } = makeWmsLayerStub(false);
		mapState.wmsLayers = [layer];

		mapState.pauseAllWMSLayers();

		expect(source.values.setAuthFailed).toHaveBeenCalled();
	});

	test('updateWMSLayerTokens should refresh only sources that were paused', () => {
		const mapState = new MapState('7');
		const paused = makeWmsLayerStub(true);
		const healthy = makeWmsLayerStub(false);
		mapState.wmsLayers = [paused.layer, healthy.layer];

		mapState.updateWMSLayerTokens();

		expect(paused.source.refresh).toHaveBeenCalled();
		expect(healthy.source.refresh).not.toHaveBeenCalled();
	});

	test('visibility change should request an immediate refresh while the heartbeat runs', async () => {
		vi.mocked(isWMSHeartbeatRunning).mockReturnValue(true);
		const mapState = new MapState('7');
		mapState.wmsLayers = [makeWmsLayerStub(false).layer];

		await mapState._handleVisibilityChange();

		expect(requestImmediateWMSRefresh).toHaveBeenCalledWith(true);
		expect(fetchWMSAccessToken).not.toHaveBeenCalled();
	});

	test('visibility change should restart a stopped heartbeat with a fresh token', async () => {
		const mapState = new MapState('7');
		mapState.wmsLayers = [makeWmsLayerStub(false).layer];

		await mapState._handleVisibilityChange();

		expect(fetchWMSAccessToken).toHaveBeenCalled();
		expect(startWMSHeartbeat).toHaveBeenCalledWith(
			expect.any(Function),
			'wms-token',
			expect.any(Function)
		);
	});
});

describe('handleTileError', () => {
	test('should toast tile errors', () => {
		const mapState = new MapState('7');

		mapState.handleTileError('Titel', 'Beschreibung');

		expect(globalToaster.error).toHaveBeenCalledWith({
			title: 'Titel',
			description: 'Beschreibung'
		});
	});
});

describe('cleanup', () => {
	test('should stop the heartbeat and clear all layers and sources', () => {
		const mapState = new MapState('7');
		mapState.initializeLayers();
		const olMap = new FakeOlMap();
		mapState.initializeSelectionLayers(olMap as unknown as Map, () => ({}));

		mapState.cleanup();

		expect(stopWMSHeartbeat).toHaveBeenCalled();
		expect(olMap.removeLayer).toHaveBeenCalledTimes(4);
		expect(mapState.olMap).toBeNull();
		expect(mapState.vectorTileLayer).toBeNull();
		expect(mapState.tileSource).toBeNull();
		expect(mapState.wmsLayers).toEqual([]);
	});

	test('should still stop the heartbeat when no map was attached', () => {
		const mapState = new MapState('7');

		mapState.cleanup();

		expect(stopWMSHeartbeat).toHaveBeenCalled();
	});
});
