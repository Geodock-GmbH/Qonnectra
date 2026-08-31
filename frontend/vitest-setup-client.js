import '@testing-library/jest-dom/vitest';

import { vi } from 'vitest';

// The network-schema remote functions ($app/server query/command) can't load in
// the jsdom unit-test SSR context (the SvelteKit remote plugin references
// build-time path globals). Any component/class that imports them transitively
// gets these inert stubs; tests that need to observe a call override with their
// own vi.mock in the test file.
vi.mock('./src/routes/network-schema/[[projectId]]/paths.remote', () => ({
	saveCableGeometry: vi.fn().mockResolvedValue({})
}));
vi.mock('./src/routes/network-schema/[[projectId]]/labels.remote', () => ({
	upsertCableLabel: vi.fn().mockResolvedValue({ position_x: 0, position_y: 0, text: '', uuid: '' }),
	deleteCableLabel: vi.fn().mockResolvedValue(undefined)
}));
vi.mock('./src/routes/network-schema/[[projectId]]/cables.remote', () => ({
	getCableDetails: vi.fn().mockResolvedValue({})
}));
vi.mock('./src/routes/network-schema/[[projectId]]/nodes.remote', () => ({
	getNodeDetails: vi.fn().mockResolvedValue({})
}));

// jsdom does not provide ResizeObserver (required by @zag-js/tabs / Skeleton Tabs)
global.ResizeObserver = class ResizeObserver {
	constructor() {}
	observe() {}
	unobserve() {}
	disconnect() {}
};

// required for svelte5 + jsdom as jsdom does not support matchMedia
Object.defineProperty(window, 'matchMedia', {
	writable: true,
	enumerable: true,
	value: vi.fn().mockImplementation((query) => ({
		matches: false,
		media: query,
		onchange: null,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn()
	}))
});

// add more mocks here if you need them
