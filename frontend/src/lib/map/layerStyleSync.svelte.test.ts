import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
	addressStyle,
	areaTypeStyles,
	labelVisibilityConfig,
	nodeTypeStyles,
	trenchColor,
	trenchConstructionTypeStyles,
	trenchStyleMode,
	trenchSurfaceStyles
} from '$lib/stores/store';

import { syncLayerStyles } from './layerStyleSync';

function createMapState() {
	return {
		updateNodeLayerStyle: vi.fn(),
		updateTrenchLayerStyle: vi.fn(),
		updateAddressLayerStyle: vi.fn(),
		updateAreaLayerStyle: vi.fn(),
		updateLabelVisibility: vi.fn()
	};
}

let stop: () => void = () => {};

beforeEach(() => {
	nodeTypeStyles.set({});
	areaTypeStyles.set({});
	trenchSurfaceStyles.set({});
	trenchConstructionTypeStyles.set({});
	trenchStyleMode.set('none');
	trenchColor.set('#111111');
	addressStyle.set({ color: '#222222', size: 4 });
	labelVisibilityConfig.set({
		trench: false,
		address: false,
		node: false,
		area: false,
		conduit: false
	});
});

afterEach(() => stop());

describe('syncLayerStyles', () => {
	test('should apply the current trench and address styles immediately', () => {
		const mapState = createMapState();

		stop = syncLayerStyles(mapState);

		expect(mapState.updateTrenchLayerStyle).toHaveBeenCalledWith('none', {}, {}, '#111111');
		expect(mapState.updateAddressLayerStyle).toHaveBeenCalledWith('#222222', 4);
	});

	test('should skip node and area restyling while no type styles exist', () => {
		const mapState = createMapState();

		stop = syncLayerStyles(mapState);

		expect(mapState.updateNodeLayerStyle).not.toHaveBeenCalled();
		expect(mapState.updateAreaLayerStyle).not.toHaveBeenCalled();
	});

	test('should restyle layers when a style store changes', () => {
		const mapState = createMapState();
		stop = syncLayerStyles(mapState);
		const nodeStyles = {
			PoP: { color: '#ff0000', size: 8, visible: true, shape: 'circle' as const }
		};
		const areaStyles = { Cluster: { color: '#00ff00', visible: true } };

		nodeTypeStyles.set(nodeStyles);
		areaTypeStyles.set(areaStyles);
		trenchStyleMode.set('surface');

		expect(mapState.updateNodeLayerStyle).toHaveBeenLastCalledWith(nodeStyles);
		expect(mapState.updateAreaLayerStyle).toHaveBeenLastCalledWith(areaStyles);
		expect(mapState.updateTrenchLayerStyle).toHaveBeenLastCalledWith('surface', {}, {}, '#111111');
	});

	test('should forward label visibility with the styles needed to restyle', () => {
		const mapState = createMapState();
		stop = syncLayerStyles(mapState);

		labelVisibilityConfig.update((config) => ({ ...config, node: true }));

		expect(mapState.updateLabelVisibility).toHaveBeenLastCalledWith(
			'area',
			false,
			expect.objectContaining({ mode: 'none', color: '#111111' })
		);
		expect(mapState.updateLabelVisibility).toHaveBeenCalledWith(
			'node',
			true,
			expect.objectContaining({ nodeTypeStyles: {} })
		);
	});

	test('should stop restyling once stopped', () => {
		const mapState = createMapState();
		syncLayerStyles(mapState)();
		mapState.updateTrenchLayerStyle.mockClear();

		trenchColor.set('#333333');

		expect(mapState.updateTrenchLayerStyle).not.toHaveBeenCalled();
	});
});
