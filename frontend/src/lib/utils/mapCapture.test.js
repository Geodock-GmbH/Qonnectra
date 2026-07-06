// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { captureMapCanvases, getVisibleWMSAttributions } from './mapCapture.js';

vi.mock('$lib/stores/store', () => {
	/** @type {{ sources: any[], loaded: boolean }} */
	let sourcesData = { sources: [], loaded: false };
	/** @type {Record<string, any>} */
	let visibilityConfig = {};

	return {
		wmsSourcesData: {
			subscribe: (/** @type {Function} */ fn) => {
				fn(sourcesData);
				return () => {};
			},
			/** @param {{ sources: any[], loaded: boolean }} val */
			_set(val) {
				sourcesData = val;
			}
		},
		wmsLayerVisibilityConfig: {
			subscribe: (/** @type {Function} */ fn) => {
				fn(visibilityConfig);
				return () => {};
			},
			/** @param {Record<string, any>} val */
			_set(val) {
				visibilityConfig = val;
			}
		},
		getWMSLayerVisibility: vi.fn((_config, _projectId, _layerId, defaultVal) => defaultVal)
	};
});

describe('captureMapCanvases', () => {
	test('returns null when container has no canvas elements', () => {
		const container = /** @type {any} */ ({
			querySelectorAll: vi.fn(() => [])
		});

		expect(captureMapCanvases(container)).toBeNull();
	});

	test('returns a PNG data URL when container has one canvas', () => {
		const mockContext = {
			drawImage: vi.fn()
		};
		const mockMergedCanvas = {
			width: 0,
			height: 0,
			getContext: vi.fn(() => mockContext),
			toDataURL: vi.fn(() => 'data:image/png;base64,abc123')
		};

		const sourceCanvas = { width: 800, height: 600 };

		const container = /** @type {any} */ ({
			querySelectorAll: vi.fn(() => [sourceCanvas])
		});

		const origCreateElement = document.createElement;
		document.createElement = vi.fn(() => /** @type {any} */ (mockMergedCanvas));

		const result = captureMapCanvases(container);

		expect(result).toBe('data:image/png;base64,abc123');
		expect(mockMergedCanvas.width).toBe(800);
		expect(mockMergedCanvas.height).toBe(600);
		expect(mockContext.drawImage).toHaveBeenCalledWith(sourceCanvas, 0, 0);

		document.createElement = origCreateElement;
	});

	test('composites multiple canvases onto a single merged canvas', () => {
		const mockContext = {
			drawImage: vi.fn()
		};
		const mockMergedCanvas = {
			width: 0,
			height: 0,
			getContext: vi.fn(() => mockContext),
			toDataURL: vi.fn(() => 'data:image/png;base64,merged')
		};

		const canvas1 = { width: 800, height: 600 };
		const canvas2 = { width: 800, height: 600 };
		const canvas3 = { width: 800, height: 600 };

		const container = /** @type {any} */ ({
			querySelectorAll: vi.fn(() => [canvas1, canvas2, canvas3])
		});

		const origCreateElement = document.createElement;
		document.createElement = vi.fn(() => /** @type {any} */ (mockMergedCanvas));

		captureMapCanvases(container);

		expect(mockContext.drawImage).toHaveBeenCalledTimes(3);
		expect(mockContext.drawImage).toHaveBeenCalledWith(canvas1, 0, 0);
		expect(mockContext.drawImage).toHaveBeenCalledWith(canvas2, 0, 0);
		expect(mockContext.drawImage).toHaveBeenCalledWith(canvas3, 0, 0);

		document.createElement = origCreateElement;
	});
});

describe('getVisibleWMSAttributions', () => {
	/** @type {typeof import('$lib/stores/store')} */
	let storeModule;

	beforeEach(async () => {
		storeModule = await import('$lib/stores/store');
	});

	test('returns empty array when no sources are loaded', () => {
		/** @type {any} */ (storeModule.wmsSourcesData)._set({ sources: [], loaded: false });

		expect(getVisibleWMSAttributions('project-1')).toEqual([]);
	});

	test('returns attributions from visible, active sources', () => {
		/** @type {any} */ (storeModule.wmsSourcesData)._set({
			sources: [
				{
					id: 1,
					is_active: true,
					attribution: '© WMS Provider',
					layers: [{ name: 'layer1', is_enabled: true }]
				}
			],
			loaded: true
		});

		const { getWMSLayerVisibility } = /** @type {any} */ (storeModule);
		getWMSLayerVisibility.mockReturnValue(true);

		const result = getVisibleWMSAttributions('project-1');

		expect(result).toEqual(['© WMS Provider']);
	});

	test('skips inactive sources', () => {
		/** @type {any} */ (storeModule.wmsSourcesData)._set({
			sources: [
				{
					id: 1,
					is_active: false,
					attribution: '© Inactive Provider',
					layers: [{ name: 'layer1', is_enabled: true }]
				}
			],
			loaded: true
		});

		expect(getVisibleWMSAttributions('project-1')).toEqual([]);
	});

	test('skips sources without attribution', () => {
		/** @type {any} */ (storeModule.wmsSourcesData)._set({
			sources: [
				{
					id: 1,
					is_active: true,
					attribution: '',
					layers: [{ name: 'layer1', is_enabled: true }]
				}
			],
			loaded: true
		});

		expect(getVisibleWMSAttributions('project-1')).toEqual([]);
	});

	test('deduplicates attributions per source', () => {
		const { getWMSLayerVisibility } = /** @type {any} */ (storeModule);
		getWMSLayerVisibility.mockReturnValue(true);

		/** @type {any} */ (storeModule.wmsSourcesData)._set({
			sources: [
				{
					id: 1,
					is_active: true,
					attribution: '© Same Provider',
					layers: [
						{ name: 'layer1', is_enabled: true },
						{ name: 'layer2', is_enabled: true }
					]
				},
				{
					id: 2,
					is_active: true,
					attribution: '© Same Provider',
					layers: [{ name: 'layer3', is_enabled: true }]
				}
			],
			loaded: true
		});

		const result = getVisibleWMSAttributions('project-1');

		expect(result).toEqual(['© Same Provider']);
	});

	test('skips disabled layers', () => {
		const { getWMSLayerVisibility } = /** @type {any} */ (storeModule);
		getWMSLayerVisibility.mockReturnValue(true);

		/** @type {any} */ (storeModule.wmsSourcesData)._set({
			sources: [
				{
					id: 1,
					is_active: true,
					attribution: '© Provider',
					layers: [{ name: 'layer1', is_enabled: false }]
				}
			],
			loaded: true
		});

		expect(getVisibleWMSAttributions('project-1')).toEqual([]);
	});

	test('skips layers where visibility is false', () => {
		const { getWMSLayerVisibility } = /** @type {any} */ (storeModule);
		getWMSLayerVisibility.mockReturnValue(false);

		/** @type {any} */ (storeModule.wmsSourcesData)._set({
			sources: [
				{
					id: 1,
					is_active: true,
					attribution: '© Provider',
					layers: [{ name: 'layer1', is_enabled: true }]
				}
			],
			loaded: true
		});

		expect(getVisibleWMSAttributions('project-1')).toEqual([]);
	});
});
