import type { FeatureLike } from 'ol/Feature';
import type ImageTile from 'ol/ImageTile';
import type { StyleFunction } from 'ol/style/Style';
import VectorTileSource from 'ol/source/VectorTile.js';
import { Style } from 'ol/style';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
	getCurrentWMSToken,
	requestImmediateWMSRefresh
} from '$lib/utils/wmsTokenHeartbeat.svelte';

import {
	createAddressLayer,
	createAreaLayer,
	createNodeLayer,
	createNodeSelectionLayer,
	createSelectionLayer,
	createTrenchLayer,
	createWMSLayer
} from './layers';
import { tileLoadingManager } from './tileLoadingManager';

vi.mock('$env/static/public', () => ({
	PUBLIC_API_URL: 'http://mock-api.test/'
}));

vi.mock('$app/navigation', () => ({
	invalidateAll: vi.fn(() => Promise.resolve())
}));

vi.mock('./tileLoadingManager', () => ({
	tileLoadingManager: {
		isLoadingPaused: vi.fn(() => false),
		createAbortController: vi.fn(() => new AbortController()),
		removeAbortController: vi.fn()
	}
}));

vi.mock('$lib/utils/wmsTokenHeartbeat.svelte', () => ({
	getCurrentWMSToken: vi.fn((): string | null => null),
	requestImmediateWMSRefresh: vi.fn()
}));

function makeFeature(
	id: string | undefined,
	properties: Record<string, unknown> = {}
): FeatureLike {
	return {
		getId: () => id,
		get: (key: string) => properties[key]
	} as unknown as FeatureLike;
}

describe('feature layers', () => {
	test.each([
		['trench', createTrenchLayer, 'trench-layer'],
		['address', createAddressLayer, 'address-layer'],
		['node', createNodeLayer, 'node-layer'],
		['area', createAreaLayer, 'area-layer']
	] as const)('should tag the %s layer with its layer id and name', (_type, factory, layerId) => {
		const layer = factory('7', 'Display Name', undefined);

		expect(layer.get('layerId')).toBe(layerId);
		expect(layer.get('layerName')).toBe('Display Name');
		expect(layer.getDeclutter()).toBeFalsy();
	});

	test('should enable decluttering when labels are on', () => {
		const layer = createTrenchLayer('7', 'Trenches', undefined, { enabled: true });

		expect(layer.getDeclutter()).toBeTruthy();
		expect(typeof layer.getStyle()).toBe('function');
	});

	test('should use a plain style for unlabeled trench layers', () => {
		const layer = createTrenchLayer('7', 'Trenches', undefined);

		expect(layer.getStyle()).toBeInstanceOf(Style);
	});

	test('should use a per-type style function when node type styles are given', () => {
		const layer = createNodeLayer('7', 'Nodes', undefined, {}, { POP: { visible: true } });

		expect(typeof layer.getStyle()).toBe('function');
	});

	test('should use a per-type style function when area type styles are given', () => {
		const layer = createAreaLayer('7', 'Areas', undefined, {}, { forest: { visible: true } });

		expect(typeof layer.getStyle()).toBe('function');
	});
});

describe('createSelectionLayer', () => {
	test('should style only selected features', () => {
		const selection: Record<string, unknown> = { 'uuid-1': true };
		const layer = createSelectionLayer(new VectorTileSource({}), '#fff700', () => selection);
		const styleFn = layer.getStyle() as StyleFunction;

		expect(layer.get('isSelectionLayer')).toBe(true);
		expect(styleFn(makeFeature('uuid-1'), 1)).toBeInstanceOf(Style);
		expect(styleFn(makeFeature('uuid-2'), 1)).toBeUndefined();
		expect(styleFn(makeFeature(undefined), 1)).toBeUndefined();
	});
});

describe('createNodeSelectionLayer', () => {
	test('should style selected nodes with their per-type shape', () => {
		const selection: Record<string, unknown> = { 'uuid-1': true };
		const layer = createNodeSelectionLayer(
			new VectorTileSource({}),
			'#fff700',
			() => selection,
			() => ({ POP: { shape: 'circle' } })
		);
		const styleFn = layer.getStyle() as StyleFunction;

		const selected = styleFn(makeFeature('uuid-1', { node_type: 'POP' }), 1);
		expect(selected).toBeInstanceOf(Style);
		expect(styleFn(makeFeature('uuid-2', { node_type: 'POP' }), 1)).toBeUndefined();
	});

	test('should cache styles per shape', () => {
		const selection: Record<string, unknown> = { 'uuid-1': true };
		const layer = createNodeSelectionLayer(
			new VectorTileSource({}),
			'#fff700',
			() => selection,
			() => ({})
		);
		const styleFn = layer.getStyle() as StyleFunction;

		const first = styleFn(makeFeature('uuid-1', { node_type: 'Muffe' }), 1);
		const second = styleFn(makeFeature('uuid-1', { node_type: 'Schacht' }), 1);

		expect(first).toBe(second);
	});
});

describe('createWMSLayer', () => {
	const fetchMock = vi.fn();

	const options = {
		proxyUrl: 'http://mock-api.test/wms-proxy/s1/?token=old-token',
		layerName: 'dop',
		layerId: 'wms-l1',
		displayName: 'Orthophotos',
		sourceId: 's1',
		sourceName: 'DOP Source'
	};

	interface WmsTileStub {
		setState: ReturnType<typeof vi.fn>;
		getImage: () => { src: string; onload: (() => void) | null };
		image: { src: string; onload: (() => void) | null };
	}

	function makeWmsTile(): WmsTileStub {
		const image = { src: '', onload: null };
		return {
			setState: vi.fn(),
			getImage: () => image,
			image
		};
	}

	beforeEach(() => {
		vi.stubGlobal('fetch', fetchMock);
		vi.stubGlobal('URL', {
			...URL,
			createObjectURL: vi.fn(() => 'blob:mock-url'),
			revokeObjectURL: vi.fn()
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		fetchMock.mockReset();
		vi.mocked(tileLoadingManager.isLoadingPaused).mockReturnValue(false);
		vi.mocked(getCurrentWMSToken).mockReturnValue(null);
		vi.clearAllMocks();
	});

	test('should tag the layer with WMS metadata and apply zoom limits', () => {
		const layer = createWMSLayer({ ...options, minZoom: 10, maxZoom: 18, opacity: 0.5 });

		expect(layer.get('layerId')).toBe('wms-l1');
		expect(layer.get('layerType')).toBe('wms');
		expect(layer.get('wmsSourceId')).toBe('s1');
		expect(layer.getMinZoom()).toBe(10);
		expect(layer.getMaxZoom()).toBe(18);
		expect(layer.getOpacity()).toBe(0.5);
		expect(layer.getSource()?.getParams().LAYERS).toBe('dop');
	});

	test('should load tile images through fetch and object URLs', async () => {
		fetchMock.mockResolvedValue({ ok: true, blob: () => Promise.resolve(new Blob(['img'])) });
		const layer = createWMSLayer(options);
		const tile = makeWmsTile();

		layer.getSource()?.getTileLoadFunction()(
			tile as unknown as ImageTile,
			'http://mock-api.test/wms-proxy/s1/?token=old-token&LAYERS=dop'
		);

		await vi.waitFor(() => expect(tile.image.src).toBe('blob:mock-url'));
		expect(tileLoadingManager.removeAbortController).toHaveBeenCalled();
	});

	test('should inject the live WMS token into tile requests', async () => {
		vi.mocked(getCurrentWMSToken).mockReturnValue('fresh-token');
		fetchMock.mockResolvedValue({ ok: true, blob: () => Promise.resolve(new Blob(['img'])) });
		const layer = createWMSLayer(options);
		const tile = makeWmsTile();

		layer.getSource()?.getTileLoadFunction()(
			tile as unknown as ImageTile,
			'http://mock-api.test/wms-proxy/s1/?token=old-token&LAYERS=dop'
		);

		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
		expect(fetchMock.mock.calls[0][0]).toContain('token=fresh-token');
		expect(fetchMock.mock.calls[0][0]).not.toContain('token=old-token');
	});

	test('should skip loading while paused', () => {
		vi.mocked(tileLoadingManager.isLoadingPaused).mockReturnValue(true);
		const layer = createWMSLayer(options);
		const tile = makeWmsTile();

		layer.getSource()?.getTileLoadFunction()(tile as unknown as ImageTile, 'http://x/');

		expect(tile.setState).toHaveBeenCalledWith(4);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	test('should request a token refresh once on auth failures', async () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		fetchMock.mockResolvedValue({ ok: false, status: 401, statusText: 'Unauthorized' });
		const layer = createWMSLayer(options);
		const first = makeWmsTile();
		const second = makeWmsTile();

		const loadFunction = layer.getSource()!.getTileLoadFunction();
		loadFunction(first as unknown as ImageTile, 'http://x/?token=t');
		await vi.waitFor(() => expect(first.setState).toHaveBeenCalledWith(4));
		loadFunction(second as unknown as ImageTile, 'http://x/?token=t');
		await vi.waitFor(() => expect(second.setState).toHaveBeenCalledWith(4));

		expect(requestImmediateWMSRefresh).toHaveBeenCalledTimes(1);
		warnSpy.mockRestore();
	});

	test('should mark tiles as errored on other failures', async () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		fetchMock.mockResolvedValue({ ok: false, status: 500, statusText: 'Server Error' });
		const layer = createWMSLayer(options);
		const tile = makeWmsTile();

		layer.getSource()?.getTileLoadFunction()(tile as unknown as ImageTile, 'http://x/');

		await vi.waitFor(() => expect(tile.setState).toHaveBeenCalledWith(3));
		errorSpy.mockRestore();
	});

	test('should stop loading tiles after setAuthFailed and resume after resetAuthFailure', async () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		fetchMock.mockResolvedValue({ ok: true, blob: () => Promise.resolve(new Blob(['img'])) });
		const layer = createWMSLayer(options);
		const source = layer.getSource()!;
		const tile = makeWmsTile();

		(source.get('setAuthFailed') as () => void)();
		source.getTileLoadFunction()(tile as unknown as ImageTile, 'http://x/');
		expect(tile.setState).toHaveBeenCalledWith(4);
		expect(fetchMock).not.toHaveBeenCalled();

		const needsRefresh = (source.get('resetAuthFailure') as () => boolean)();
		expect(needsRefresh).toBe(true);

		const retryTile = makeWmsTile();
		source.getTileLoadFunction()(retryTile as unknown as ImageTile, 'http://x/');
		await vi.waitFor(() => expect(retryTile.image.src).toBe('blob:mock-url'));
		warnSpy.mockRestore();
	});
});
