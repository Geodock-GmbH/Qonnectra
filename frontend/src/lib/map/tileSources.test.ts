import type { FeatureLike } from 'ol/Feature';
import type Projection from 'ol/proj/Projection';
import type VectorTile from 'ol/VectorTile';
import { invalidateAll } from '$app/navigation';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { tileLoadingManager } from './tileLoadingManager';
import {
	createAddressTileSource,
	createAreaTileSource,
	createNodeTileSource,
	createTrenchTileSource
} from './tileSources';
import { getWorkerPool } from './workerPool';

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

vi.mock('./workerPool', () => ({
	getWorkerPool: vi.fn()
}));

vi.mock('./featureReconstructor', () => ({
	reconstructFeatures: vi.fn((features: unknown[]) => features)
}));

const fetchMock = vi.fn();

interface TileStub {
	setState: ReturnType<typeof vi.fn>;
	setLoader: ReturnType<typeof vi.fn>;
	setFeatures: ReturnType<typeof vi.fn>;
	getFormat: () => { readFeatures: ReturnType<typeof vi.fn> };
	loader?: (extent: number[], resolution: number, projection: string) => void;
}

function makeTileStub(): TileStub {
	const readFeatures = vi.fn(() => ['parsed-feature']);
	const tile: TileStub = {
		setState: vi.fn(),
		setLoader: vi.fn((loader) => {
			tile.loader = loader;
		}),
		setFeatures: vi.fn(),
		getFormat: () => ({ readFeatures })
	};
	return tile;
}

function loadTile(
	source: ReturnType<typeof createTrenchTileSource>,
	tile: TileStub,
	url: string | undefined
) {
	source.getTileLoadFunction()(
		tile as unknown as VectorTile<FeatureLike>,
		url as unknown as string
	);
	tile.loader?.([0, 0, 100, 100], 1, 'EPSG:25832' as unknown as string);
}

beforeEach(() => {
	vi.stubGlobal('fetch', fetchMock);
	vi.mocked(getWorkerPool).mockReturnValue({
		workers: [],
		parse: vi.fn()
	} as unknown as ReturnType<typeof getWorkerPool>);
});

afterEach(() => {
	vi.unstubAllGlobals();
	fetchMock.mockReset();
	vi.mocked(tileLoadingManager.isLoadingPaused).mockReturnValue(false);
	vi.clearAllMocks();
});

describe('tile URL functions', () => {
	const cases = [
		['trench', createTrenchTileSource, 'ol_trench_tiles'],
		['address', createAddressTileSource, 'ol_address_tiles'],
		['node', createNodeTileSource, 'ol_node_tiles'],
		['area', createAreaTileSource, 'ol_area_tiles']
	] as const;

	test.each(cases)('should build project-scoped %s tile URLs', (_name, factory, path) => {
		const source = factory('7', undefined);

		const url = source.getTileUrlFunction()([14, 8600, 5300], 1, {} as Projection);

		expect(url).toBe(`http://mock-api.test/${path}/14/8600/5300.mvt?project=7`);
	});

	test.each(cases)('should build unscoped %s tile URLs in global view', (_name, factory, path) => {
		const source = factory('7', undefined, true);

		const url = source.getTileUrlFunction()([2, 1, 0], 1, {} as Projection);

		expect(url).toBe(`http://mock-api.test/${path}/2/1/0.mvt`);
	});

	test('should return no URL for an invalid project id', () => {
		const source = createTrenchTileSource('not-a-number', undefined);

		expect(source.getTileUrlFunction()([14, 1, 1], 1, {} as Projection)).toBeUndefined();
	});
});

describe('tile load function', () => {
	test('should mark the tile as empty when there is no URL', () => {
		const tile = makeTileStub();

		createTrenchTileSource('7', undefined).getTileLoadFunction()(
			tile as unknown as VectorTile<FeatureLike>,
			undefined as unknown as string
		);

		expect(tile.setState).toHaveBeenCalledWith(4);
		expect(tile.setLoader).not.toHaveBeenCalled();
	});

	test('should mark the tile as empty while loading is paused', () => {
		vi.mocked(tileLoadingManager.isLoadingPaused).mockReturnValue(true);
		const tile = makeTileStub();

		loadTile(createTrenchTileSource('7', undefined), tile, 'http://mock-api.test/tile.mvt');

		expect(tile.setState).toHaveBeenCalledWith(4);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	test('should parse fetched tile data on the main thread without workers', async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			status: 200,
			arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
		});
		const tile = makeTileStub();

		loadTile(createTrenchTileSource('7', undefined), tile, 'http://mock-api.test/tile.mvt');

		await vi.waitFor(() => expect(tile.setFeatures).toHaveBeenCalledWith(['parsed-feature']));
		expect(tileLoadingManager.removeAbortController).toHaveBeenCalled();
	});

	test('should parse tile data in the worker pool when workers are available', async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			status: 200,
			arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
		});
		vi.mocked(getWorkerPool).mockReturnValue({
			workers: [{}],
			parse: vi.fn(() => Promise.resolve({ success: true, features: [{ id: 'worker-feature' }] }))
		} as unknown as ReturnType<typeof getWorkerPool>);
		const tile = makeTileStub();

		loadTile(createTrenchTileSource('7', undefined), tile, 'http://mock-api.test/tile.mvt');

		await vi.waitFor(() =>
			expect(tile.setFeatures).toHaveBeenCalledWith([{ id: 'worker-feature' }])
		);
	});

	test('should refresh the session and retry once on 401', async () => {
		fetchMock.mockResolvedValueOnce({ ok: false, status: 401 }).mockResolvedValueOnce({
			ok: true,
			status: 200,
			arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
		});
		const tile = makeTileStub();

		loadTile(createTrenchTileSource('7', undefined), tile, 'http://mock-api.test/tile.mvt');

		await vi.waitFor(() => expect(tile.setFeatures).toHaveBeenCalled());
		expect(invalidateAll).toHaveBeenCalledTimes(1);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	test('should mark the tile as errored and notify on fetch failure', async () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		fetchMock.mockResolvedValue({ ok: false, status: 500, statusText: 'Server Error' });
		const onError = vi.fn();
		const tile = makeTileStub();

		loadTile(createTrenchTileSource('7', onError), tile, 'http://mock-api.test/tile.mvt');

		await vi.waitFor(() => expect(tile.setState).toHaveBeenCalledWith(3));
		expect(onError).toHaveBeenCalledWith(
			'Error loading trench tile',
			'Failed to load trench tile: Server Error'
		);
		errorSpy.mockRestore();
	});

	test('should mark the tile as empty when the request is aborted', async () => {
		const abortError = new Error('aborted');
		abortError.name = 'AbortError';
		fetchMock.mockRejectedValue(abortError);
		const onError = vi.fn();
		const tile = makeTileStub();

		loadTile(createTrenchTileSource('7', onError), tile, 'http://mock-api.test/tile.mvt');

		await vi.waitFor(() => expect(tile.setState).toHaveBeenCalledWith(4));
		expect(onError).not.toHaveBeenCalled();
	});
});
