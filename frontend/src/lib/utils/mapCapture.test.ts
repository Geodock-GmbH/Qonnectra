// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { captureMapCanvases, getVisibleWMSAttributions } from './mapCapture';

interface MockStore<T> {
	subscribe: (fn: (val: T) => void) => () => void;
	_set: (val: T) => void;
}

vi.mock('$lib/stores/store', () => {
	let sourcesData = { sources: [] as Record<string, unknown>[], loaded: false };
	let visibilityConfig: Record<string, unknown> = {};

	return {
		wmsSourcesData: {
			subscribe: (fn: (val: typeof sourcesData) => void) => {
				fn(sourcesData);
				return () => {};
			},
			_set(val: typeof sourcesData) {
				sourcesData = val;
			}
		},
		wmsLayerVisibilityConfig: {
			subscribe: (fn: (val: Record<string, unknown>) => void) => {
				fn(visibilityConfig);
				return () => {};
			},
			_set(val: Record<string, unknown>) {
				visibilityConfig = val;
			}
		},
		getWMSLayerVisibility: vi.fn(
			(_config: unknown, _projectId: string, _layerId: string, defaultVal: boolean) => defaultVal
		)
	};
});

describe('captureMapCanvases', () => {
	test('returns null when container has no canvas elements', () => {
		const container = {
			querySelectorAll: vi.fn(() => [])
		} as unknown as HTMLElement;

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

		const container = {
			querySelectorAll: vi.fn(() => [sourceCanvas])
		} as unknown as HTMLElement;

		const origCreateElement = document.createElement;
		document.createElement = vi.fn(
			() => mockMergedCanvas
		) as unknown as typeof document.createElement;

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

		const container = {
			querySelectorAll: vi.fn(() => [canvas1, canvas2, canvas3])
		} as unknown as HTMLElement;

		const origCreateElement = document.createElement;
		document.createElement = vi.fn(
			() => mockMergedCanvas
		) as unknown as typeof document.createElement;

		captureMapCanvases(container);

		expect(mockContext.drawImage).toHaveBeenCalledTimes(3);
		expect(mockContext.drawImage).toHaveBeenCalledWith(canvas1, 0, 0);
		expect(mockContext.drawImage).toHaveBeenCalledWith(canvas2, 0, 0);
		expect(mockContext.drawImage).toHaveBeenCalledWith(canvas3, 0, 0);

		document.createElement = origCreateElement;
	});
});

describe('getVisibleWMSAttributions', () => {
	let storeModule: typeof import('$lib/stores/store') & {
		wmsSourcesData: MockStore<{ sources: Record<string, unknown>[]; loaded: boolean }>;
		wmsLayerVisibilityConfig: MockStore<Record<string, unknown>>;
	};

	beforeEach(async () => {
		storeModule = (await import('$lib/stores/store')) as typeof storeModule;
	});

	test('returns empty array when no sources are loaded', () => {
		storeModule.wmsSourcesData._set({ sources: [], loaded: false });

		expect(getVisibleWMSAttributions('project-1')).toEqual([]);
	});

	test('returns attributions from visible, active sources', () => {
		storeModule.wmsSourcesData._set({
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

		const { getWMSLayerVisibility } = storeModule as unknown as Record<
			string,
			ReturnType<typeof vi.fn>
		>;
		getWMSLayerVisibility.mockReturnValue(true);

		const result = getVisibleWMSAttributions('project-1');

		expect(result).toEqual(['© WMS Provider']);
	});

	test('skips inactive sources', () => {
		storeModule.wmsSourcesData._set({
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
		storeModule.wmsSourcesData._set({
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
		const { getWMSLayerVisibility } = storeModule as unknown as Record<
			string,
			ReturnType<typeof vi.fn>
		>;
		getWMSLayerVisibility.mockReturnValue(true);

		storeModule.wmsSourcesData._set({
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
		const { getWMSLayerVisibility } = storeModule as unknown as Record<
			string,
			ReturnType<typeof vi.fn>
		>;
		getWMSLayerVisibility.mockReturnValue(true);

		storeModule.wmsSourcesData._set({
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
		const { getWMSLayerVisibility } = storeModule as unknown as Record<
			string,
			ReturnType<typeof vi.fn>
		>;
		getWMSLayerVisibility.mockReturnValue(false);

		storeModule.wmsSourcesData._set({
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
