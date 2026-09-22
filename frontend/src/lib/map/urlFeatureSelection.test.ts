import type OlMap from 'ol/Map';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { getFeatureDetails } from '$lib/remote/map/feature-search.remote';

import { parseFeatureGeometry, zoomToFeature } from './searchUtils';
import { selectUrlFeature } from './urlFeatureSelection';

vi.mock('$lib/remote/map/feature-search.remote', () => ({
	getFeatureDetails: vi.fn()
}));

vi.mock('./searchUtils', () => ({
	parseFeatureGeometry: vi.fn(),
	zoomToFeature: vi.fn()
}));

vi.mock('./projectionUtils', () => ({
	storageReadOptions: () => ({ dataProjection: 'EPSG:25832', featureProjection: 'EPSG:3857' })
}));

const map = { getView: () => ({ getProjection: () => ({ getCode: () => 'EPSG:3857' }) }) } as OlMap;
const storage = { srid: 25832, proj4Def: '+proj=utm' };

function createSelection(selected: string[] = []) {
	return {
		isSelected: vi.fn((id: string | number) => selected.includes(String(id))),
		selectMultipleFeatures: vi.fn(),
		clearSelection: vi.fn()
	};
}

afterEach(() => {
	vi.clearAllMocks();
});

beforeEach(() => {
	vi.mocked(getFeatureDetails).mockResolvedValue({ id: 'abc', properties: {} });
	vi.mocked(parseFeatureGeometry).mockResolvedValue({ getExtent: () => [0, 0, 1, 1] } as never);
	vi.mocked(zoomToFeature).mockResolvedValue();
});

describe('selectUrlFeature', () => {
	test('should select and zoom to a feature that arrived by URL', async () => {
		const selectionManager = createSelection();

		await selectUrlFeature({
			map,
			selectionManager,
			feature: { kind: 'trench', id: 'abc' },
			hash: '',
			lookupProjectId: '5',
			storage
		});

		expect(selectionManager.selectMultipleFeatures).toHaveBeenCalledWith(['abc']);
		expect(getFeatureDetails).toHaveBeenCalledWith({
			featureType: 'trench',
			featureUuid: 'abc',
			projectId: '5'
		});
		expect(zoomToFeature).toHaveBeenCalled();
	});

	test('should leave a feature alone that was clicked on the map', async () => {
		const selectionManager = createSelection(['abc']);

		await selectUrlFeature({
			map,
			selectionManager,
			feature: { kind: 'trench', id: 'abc' },
			hash: '',
			lookupProjectId: '5',
			storage
		});

		expect(selectionManager.selectMultipleFeatures).not.toHaveBeenCalled();
		expect(zoomToFeature).not.toHaveBeenCalled();
	});

	test('should respect a map view carried in the hash', async () => {
		const selectionManager = createSelection();

		await selectUrlFeature({
			map,
			selectionManager,
			feature: { kind: 'node', id: 'n1' },
			hash: '#map=17/1/2',
			lookupProjectId: '5',
			storage
		});

		expect(selectionManager.selectMultipleFeatures).toHaveBeenCalledWith(['n1']);
		expect(zoomToFeature).not.toHaveBeenCalled();
	});

	test('should clear the selection when the URL names no feature', async () => {
		const selectionManager = createSelection(['abc']);

		await selectUrlFeature({
			map,
			selectionManager,
			feature: null,
			hash: '',
			lookupProjectId: '5',
			storage
		});

		expect(selectionManager.clearSelection).toHaveBeenCalledOnce();
	});

	test('should do nothing while the map is not ready', async () => {
		const selectionManager = createSelection();

		await selectUrlFeature({
			map: null,
			selectionManager,
			feature: { kind: 'trench', id: 'abc' },
			hash: '',
			lookupProjectId: '5',
			storage
		});

		expect(selectionManager.selectMultipleFeatures).not.toHaveBeenCalled();
	});

	test('should keep the selection when the lookup fails', async () => {
		vi.mocked(getFeatureDetails).mockRejectedValue(new Error('404'));
		const selectionManager = createSelection();

		await selectUrlFeature({
			map,
			selectionManager,
			feature: { kind: 'trench', id: 'gone' },
			hash: '',
			lookupProjectId: '5',
			storage
		});

		expect(selectionManager.selectMultipleFeatures).toHaveBeenCalledWith(['gone']);
		expect(zoomToFeature).not.toHaveBeenCalled();
	});
});
