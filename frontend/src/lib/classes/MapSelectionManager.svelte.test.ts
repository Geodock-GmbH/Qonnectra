import type VectorTileLayer from 'ol/layer/VectorTile.js';
import { describe, expect, test, vi } from 'vitest';

import { MapSelectionManager } from './MapSelectionManager.svelte';

class FakeLayer {
	changed = vi.fn();
}

function makeLayer(): VectorTileLayer & FakeLayer {
	return new FakeLayer() as unknown as VectorTileLayer & FakeLayer;
}

class FakeFeature {
	getId = () => 'f1';
}

const featureStub = new FakeFeature() as never;

describe('MapSelectionManager', () => {
	test('should select a single feature and clear the previous selection', () => {
		const manager = new MapSelectionManager();

		manager.selectFeature('f1', featureStub);
		expect(manager.isSelected('f1')).toBe(true);

		manager.selectFeature('f2', featureStub);
		expect(manager.isSelected('f1')).toBe(false);
		expect(manager.isSelected('f2')).toBe(true);
	});

	test('should select multiple features at once', () => {
		const manager = new MapSelectionManager();

		manager.selectMultipleFeatures(['a', 'b']);

		expect(manager.isSelected('a')).toBe(true);
		expect(manager.isSelected('b')).toBe(true);
		expect(manager.isSelected('c')).toBe(false);
	});

	test('should clear the selection', () => {
		const manager = new MapSelectionManager();
		manager.selectFeature('f1', featureStub);

		manager.clearSelection();

		expect(manager.isSelected('f1')).toBe(false);
		expect(manager.getSelectedFeature()).toBeNull();
	});

	test('should return the selected feature object', () => {
		const manager = new MapSelectionManager();

		expect(manager.getSelectedFeature()).toBeNull();

		manager.selectFeature('f1', featureStub);
		expect(manager.getSelectedFeature()).toBe(featureStub);
	});

	test('should notify registered selection layers on every selection change', () => {
		const manager = new MapSelectionManager();
		const layer = makeLayer();

		manager.registerSelectionLayer(layer);
		manager.selectFeature('f1', featureStub);
		manager.clearSelection();

		expect(layer.changed).toHaveBeenCalledTimes(2);
	});

	test('should not register the same layer twice', () => {
		const manager = new MapSelectionManager();
		const layer = makeLayer();

		manager.registerSelectionLayer(layer);
		manager.registerSelectionLayer(layer);

		expect(manager.selectionLayers).toHaveLength(1);
	});

	test('should expose the selection store for style functions', () => {
		const manager = new MapSelectionManager();

		manager.selectMultipleFeatures(['a']);

		expect(manager.getSelectionStore()).toEqual({ a: true });
	});

	test('should reset everything on cleanup', () => {
		const manager = new MapSelectionManager();
		manager.registerSelectionLayer(makeLayer());
		manager.selectFeature('f1', featureStub);

		manager.cleanup();

		expect(manager.getSelectionStore()).toEqual({});
		expect(manager.selectionLayers).toEqual([]);
	});
});
