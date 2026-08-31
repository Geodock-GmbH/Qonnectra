import '@testing-library/jest-dom/vitest';

import { settled, tick } from 'svelte';
import { cleanup } from '@testing-library/svelte';
import { afterEach, vi } from 'vitest';

// With `compilerOptions.experimental.async` on, component unmount is deferred:
// testing-library's auto-cleanup calls `unmount()` but the DOM removal and any
// in-flight async teardown settle on a later microtask. Without awaiting that,
// stale DOM from one test leaks into the next → `getByRole` "multiple elements"
// and hook timeouts. This afterEach registers last, so it runs first in
// vitest's reverse-order teardown: it settles pending async work, unmounts, and
// waits for the deferred teardown to flush before the next test renders.
afterEach(async () => {
	await settled();
	cleanup();
	await tick();
	await settled();
});

// The remote functions ($app/server query/command) can't load in the jsdom
// unit-test SSR context (the SvelteKit remote plugin references build-time
// path globals). Any component/class that imports them transitively gets
// these inert stubs; tests that need to observe a call override with their
// own vi.mock in the test file.
vi.mock('$lib/remote/network-schema/paths.remote', () => ({
	saveCableGeometry: vi.fn().mockResolvedValue({})
}));
vi.mock('$lib/remote/network-schema/labels.remote', () => ({
	upsertCableLabel: vi.fn().mockResolvedValue({ position_x: 0, position_y: 0, text: '', uuid: '' }),
	deleteCableLabel: vi.fn().mockResolvedValue(undefined)
}));
vi.mock('$lib/remote/network-schema/cables.remote', () => ({
	getCableDetails: vi.fn().mockResolvedValue({}),
	createCable: vi.fn().mockResolvedValue({ uuid: '' }),
	updateCable: vi.fn().mockResolvedValue({}),
	deleteCable: vi.fn().mockResolvedValue(undefined),
	getConduitsForCable: vi.fn(() => ({ current: [], loading: false, error: undefined })),
	getCableSplices: vi.fn().mockResolvedValue([])
}));
vi.mock('$lib/remote/network-schema/nodes.remote', () => ({
	getNodeDetails: vi.fn().mockResolvedValue({}),
	saveNodeGeometry: vi.fn().mockResolvedValue({}),
	getNodeDependencies: vi.fn(() => ({
		loading: false,
		error: undefined,
		current: {
			cables: [],
			structures: [],
			children: [],
			childrenWithCables: [],
			hasChildren: false,
			hasCables: false,
			hasChildrenWithCables: false
		}
	})),
	updateNode: vi.fn().mockResolvedValue({}),
	deleteNode: vi.fn().mockResolvedValue(undefined)
}));
vi.mock('$lib/remote/network-schema/micropipes.remote', () => ({
	autoLinkMicropipe: vi.fn().mockResolvedValue({ results: [], linked_count: 0 }),
	getMicropipeConnectionsForCable: vi.fn().mockResolvedValue([])
}));
vi.mock('$lib/remote/network-schema/component-types.remote', () => ({
	getComponentTypes: vi.fn(() => ({ current: [], loading: false, error: undefined }))
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
