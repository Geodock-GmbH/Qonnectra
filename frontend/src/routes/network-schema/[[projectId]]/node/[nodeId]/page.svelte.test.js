import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/svelte';
import { describe, expect, test, vi } from 'vitest';

import Page from './+page.svelte';

// Paraglide messages - use Proxy to handle all message keys
vi.mock('$lib/paraglide/messages', () => {
	const mockMessages = new Proxy(
		{},
		{
			get: (target, prop) => () => String(prop)
		}
	);
	return { m: mockMessages };
});

vi.mock('$env/dynamic/public', () => ({
	env: { PUBLIC_TILE_SERVER_URL: '' }
}));

vi.mock('$lib/utils/svelteFlowLock', () => ({
	autoLockSvelteFlow: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('@xyflow/svelte', async () => {
	const mocks = await import('$lib/test-utils/mocks/xyflow-svelte.js');
	return mocks;
});

vi.mock('$lib/stores/drawer', () => ({
	drawerStore: {
		subscribe: (/** @type {Function} */ cb) => {
			cb({ open: false });
			return () => {};
		},
		open: vi.fn()
	}
}));

vi.mock('$lib/stores/toaster', () => ({
	globalToaster: {
		success: vi.fn(),
		error: vi.fn(),
		warning: vi.fn()
	}
}));

vi.mock('$app/stores', () => {
	const pageStore = {
		subscribe: (/** @type {Function} */ cb) => {
			cb({ url: new URL('http://localhost/network-schema/1/node/abc') });
			return () => {};
		}
	};
	return {
		navigating: {
			subscribe: (/** @type {Function} */ cb) => {
				cb(null);
				return () => {};
			}
		},
		page: pageStore
	};
});

vi.mock('$app/navigation', () => ({
	goto: vi.fn()
}));

vi.mock('$lib/stores/store', () => ({
	selectedProject: {
		subscribe: (/** @type {Function} */ cb) => {
			cb(null);
			return () => {};
		}
	},
	edgeSnappingEnabled: {
		subscribe: (/** @type {Function} */ cb) => {
			cb(false);
			return () => {};
		},
		set: vi.fn()
	},
	networkSchemaPanelExpanded: {
		subscribe: (/** @type {Function} */ cb) => {
			cb(true);
			return () => {};
		},
		set: vi.fn()
	},
	networkSchemaDisplayOptionsExpanded: {
		subscribe: (/** @type {Function} */ cb) => {
			cb(true);
			return () => {};
		},
		set: vi.fn()
	},
	cableDirectionAnimationEnabled: {
		subscribe: (/** @type {Function} */ cb) => {
			cb(false);
			return () => {};
		},
		set: vi.fn()
	}
}));

vi.mock('$lib/components/Drawer.svelte', async () => {
	const { default: MockDrawer } = await import('$lib/test-utils/mocks/MockDrawer.svelte');
	return { default: MockDrawer };
});

vi.mock('$lib/components/GenericCombobox.svelte', async () => {
	const { default: MockGenericCombobox } =
		await import('$lib/test-utils/mocks/MockGenericCombobox.svelte');
	return { default: MockGenericCombobox };
});

vi.mock('../../CableDiagramNode.svelte', async () => {
	const { default: MockCableDiagramNode } =
		await import('$lib/test-utils/mocks/MockCableDiagramNode.svelte');
	return { default: MockCableDiagramNode };
});

vi.mock('../../CableDiagramEdge.svelte', async () => {
	const { default: MockCableDiagramEdge } =
		await import('$lib/test-utils/mocks/MockCableDiagramEdge.svelte');
	return { default: MockCableDiagramEdge };
});

vi.mock('../../NetworkSchemaSearch.svelte', async () => {
	const { default: MockNetworkSchemaSearch } =
		await import('$lib/test-utils/mocks/MockNetworkSchemaSearch.svelte');
	return { default: MockNetworkSchemaSearch };
});

vi.mock('../../ViewportPersistence.svelte', async () => {
	const { default: MockViewportPersistence } =
		await import('$lib/test-utils/mocks/MockViewportPersistence.svelte');
	return { default: MockViewportPersistence };
});

vi.mock('../../MicroductChoiceDialog.svelte', async () => {
	const { default: MockMicroductChoiceDialog } =
		await import('$lib/test-utils/mocks/MockMicroductChoiceDialog.svelte');
	return { default: MockMicroductChoiceDialog };
});

describe('/network-schema/node/[nodeId]/+page.svelte (child view)', () => {
	/** @type {any} */
	const mockData = {
		nodes: [],
		cables: [],
		cableMicropipeConnections: {},
		cableTypes: [],
		parentNodeId: 'parent-node-uuid',
		parentNodeName: 'Parent Node',
		parentNodeOptions: []
	};

	test('should render the SvelteFlow container', () => {
		render(Page, { props: { data: mockData } });

		expect(screen.getByTestId('svelte-flow')).toBeInTheDocument();
	});

	test('should mount the MicroductChoiceDialog so auto-link choices can appear in child view', () => {
		render(Page, { props: { data: mockData } });

		expect(screen.getByTestId('microduct-choice-dialog')).toBeInTheDocument();
	});
});
