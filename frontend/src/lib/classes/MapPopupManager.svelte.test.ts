import type Feature from 'ol/Feature.js';
import type OlMap from 'ol/Map.js';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { MapPopupManager } from './MapPopupManager.svelte';

function makeMapStub() {
	return {
		addOverlay: vi.fn(),
		removeOverlay: vi.fn()
	} as unknown as OlMap & {
		addOverlay: ReturnType<typeof vi.fn>;
		removeOverlay: ReturnType<typeof vi.fn>;
	};
}

function makeFeature(properties: Record<string, unknown>): Feature {
	return { getProperties: () => properties } as unknown as Feature;
}

function mountPopupDom() {
	document.body.innerHTML = `
		<div id="popup">
			<a href="#" id="popup-closer"></a>
			<div id="popup-content"></div>
		</div>
	`;
}

beforeEach(() => {
	vi.spyOn(console, 'error').mockImplementation(() => {});
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
	document.body.innerHTML = '';
	vi.restoreAllMocks();
});

describe('initialize', () => {
	test('should attach the overlay to the map and wire the closer', () => {
		mountPopupDom();
		const map = makeMapStub();
		const manager = new MapPopupManager();

		expect(manager.initialize(map)).toBe(true);
		expect(map.addOverlay).toHaveBeenCalledTimes(1);
		expect(manager.overlay).not.toBeNull();
	});

	test('should fail without a map instance', () => {
		const manager = new MapPopupManager();

		expect(manager.initialize(null as unknown as OlMap)).toBe(false);
	});

	test('should fail when the popup container is missing', () => {
		const manager = new MapPopupManager();

		expect(manager.initialize(makeMapStub())).toBe(false);
	});
});

describe('show and hide', () => {
	test('should render feature properties and position the popup', () => {
		mountPopupDom();
		const manager = new MapPopupManager({ name: 'Name' });
		manager.initialize(makeMapStub());

		manager.show([10, 20], makeFeature({ name: 'PoP-1', status: 'aktiv' }));

		expect(manager.contentElement?.innerHTML).toBe(
			'<ul><li><strong>Name:</strong> PoP-1</li><li><strong>status:</strong> aktiv</li></ul>'
		);
		expect(manager.overlay?.getPosition()).toEqual([10, 20]);
	});

	test('should warn instead of throwing when not initialized', () => {
		const manager = new MapPopupManager();

		expect(() => manager.show([0, 0], makeFeature({}))).not.toThrow();
		expect(console.warn).toHaveBeenCalled();
	});

	test('should hide the popup by clearing its position', () => {
		mountPopupDom();
		const manager = new MapPopupManager();
		manager.initialize(makeMapStub());
		manager.show([10, 20], makeFeature({ name: 'x' }));

		manager.hide();

		expect(manager.overlay?.getPosition()).toBeUndefined();
	});

	test('should hide the popup when the closer is clicked', () => {
		mountPopupDom();
		const manager = new MapPopupManager();
		manager.initialize(makeMapStub());
		manager.show([10, 20], makeFeature({ name: 'x' }));

		manager.closerElement?.onclick?.(new MouseEvent('click') as never);

		expect(manager.overlay?.getPosition()).toBeUndefined();
	});
});

describe('generatePopupContent', () => {
	test('should skip objects and internal fields', () => {
		const manager = new MapPopupManager();

		const html = manager.generatePopupContent({
			name: 'PoP-1',
			geometry: { type: 'Point' },
			layer: 'node-layer',
			source: 'tiles'
		});

		expect(html).toBe('<ul><li><strong>name:</strong> PoP-1</li></ul>');
	});

	test('should use alias names when available', () => {
		const manager = new MapPopupManager({ id_trench: 'Graben-ID' });

		const html = manager.generatePopupContent({ id_trench: 'T-1' });

		expect(html).toContain('<strong>Graben-ID:</strong> T-1');
	});
});

describe('updateAlias', () => {
	test('should replace the alias mapping', () => {
		const manager = new MapPopupManager({ old: 'Old' });

		manager.updateAlias({ name: 'Name' });
		expect(manager.alias).toEqual({ name: 'Name' });

		manager.updateAlias(null as unknown as Record<string, string>);
		expect(manager.alias).toEqual({});
	});
});

describe('cleanup', () => {
	test('should remove the overlay and clear references', () => {
		mountPopupDom();
		const map = makeMapStub();
		const manager = new MapPopupManager();
		manager.initialize(map);
		const overlay = manager.overlay;

		manager.cleanup(map);

		expect(map.removeOverlay).toHaveBeenCalledWith(overlay);
		expect(manager.overlay).toBeNull();
		expect(manager.popupContainer).toBeNull();
		expect(manager.contentElement).toBeNull();
		expect(manager.closerElement).toBeNull();
	});
});
