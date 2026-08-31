import '@testing-library/jest-dom/vitest';

import type { PageData } from './$types';
import { render, screen } from '@testing-library/svelte';
import { describe, expect, test, vi } from 'vitest';

import Page from './+page.svelte';

// Paraglide messages - use Proxy to handle all message keys
vi.mock('$lib/paraglide/messages', () => {
	const mockMessages = new Proxy(
		{},
		{
			get: (target: Record<string, string>, prop: string | symbol) => {
				const messageMap: Record<string, string> = {
					nav_network_schema: 'Network Schema',
					common_attributes: 'Attributes',
					common_name: 'Name',
					common_warning: 'Warning',
					form_snapping: 'Snapping',
					placeholder_select_cable_type: 'Select cable type',
					title_error_canvas_sync_failed: 'Canvas sync failed',
					message_error_canvas_sync_failed: 'Sync failed',
					title_success_canvas_sync_complete: 'Sync complete',
					message_network_schema_settings_not_configured: 'Settings not configured'
				};
				return () => messageMap[prop as string] || String(prop);
			}
		}
	);
	return { m: mockMessages };
});

vi.mock('$env/dynamic/public', () => ({
	env: { PUBLIC_TILE_SERVER_URL: '' }
}));

vi.mock('$lib/utils/tokenHeartbeat.svelte.js', () => ({
	startHeartbeat: vi.fn(),
	stopHeartbeat: vi.fn()
}));

vi.mock('$lib/utils/svelteFlowLock', () => ({
	autoLockSvelteFlow: vi.fn().mockResolvedValue(undefined)
}));

// Mock SvelteFlow components with actual Svelte component mocks
vi.mock('@xyflow/svelte', async () => {
	const mocks = await import('$lib/test-utils/mocks/xyflow-svelte.js');
	return mocks;
});

// Mock stores
vi.mock('$lib/stores/drawer', () => ({
	drawerStore: {
		subscribe: (cb: (value: unknown) => void) => {
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
		subscribe: (cb: (value: unknown) => void) => {
			cb({ url: new URL('http://localhost/network-schema/1') });
			return () => {};
		}
	};
	return {
		navigating: {
			subscribe: (cb: (value: unknown) => void) => {
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
		subscribe: (cb: (value: unknown) => void) => {
			cb(null);
			return () => {};
		}
	},
	edgeSnappingEnabled: {
		subscribe: (cb: (value: unknown) => void) => {
			cb(false);
			return () => {};
		},
		set: vi.fn()
	},
	networkSchemaPanelExpanded: {
		subscribe: (cb: (value: unknown) => void) => {
			cb(true);
			return () => {};
		},
		set: vi.fn()
	},
	networkSchemaDisplayOptionsExpanded: {
		subscribe: (cb: (value: unknown) => void) => {
			cb(true);
			return () => {};
		},
		set: vi.fn()
	},
	cableDirectionAnimationEnabled: {
		subscribe: (cb: (value: unknown) => void) => {
			cb(false);
			return () => {};
		},
		set: vi.fn()
	}
}));

// Mock custom Svelte components
vi.mock('$lib/components/Drawer.svelte', async () => {
	const { default: MockDrawer } = await import('$lib/test-utils/mocks/MockDrawer.svelte');
	return { default: MockDrawer };
});

vi.mock('$lib/components/GenericCombobox.svelte', async () => {
	const { default: MockGenericCombobox } =
		await import('$lib/test-utils/mocks/MockGenericCombobox.svelte');
	return { default: MockGenericCombobox };
});

vi.mock('./CableDiagramNode.svelte', async () => {
	const { default: MockCableDiagramNode } =
		await import('$lib/test-utils/mocks/MockCableDiagramNode.svelte');
	return { default: MockCableDiagramNode };
});

vi.mock('./CableDiagramEdge.svelte', async () => {
	const { default: MockCableDiagramEdge } =
		await import('$lib/test-utils/mocks/MockCableDiagramEdge.svelte');
	return { default: MockCableDiagramEdge };
});

vi.mock('./NetworkSchemaSearch.svelte', async () => {
	const { default: MockNetworkSchemaSearch } =
		await import('$lib/test-utils/mocks/MockNetworkSchemaSearch.svelte');
	return { default: MockNetworkSchemaSearch };
});

vi.mock('./ViewportPersistence.svelte', async () => {
	const { default: MockViewportPersistence } =
		await import('$lib/test-utils/mocks/MockViewportPersistence.svelte');
	return { default: MockViewportPersistence };
});

vi.mock('./MicroductChoiceDialog.svelte', async () => {
	const { default: MockMicroductChoiceDialog } =
		await import('$lib/test-utils/mocks/MockMicroductChoiceDialog.svelte');
	return { default: MockMicroductChoiceDialog };
});

vi.mock('@skeletonlabs/skeleton-svelte', async () => {
	const { default: MockSwitch } = await import('$lib/test-utils/mocks/MockSwitch.svelte');
	return {
		Switch: MockSwitch
	};
});

// Mock the classes - must use actual class syntax for Svelte 5 runes compatibility
vi.mock('$lib/classes/NetworkSchemaState.svelte', () => ({
	NetworkSchemaState: class MockNetworkSchemaState {
		nodes: Record<string, unknown>[] = [];
		edges: Record<string, unknown>[] = [];
		cableTypes: Record<string, unknown>[] = [];
		selectedCableType = null;
		userCableName = '';
		initialized = true;
		parentNodeContext = null;
		shiftPressed = false;
		initialize = vi.fn();
		handleNodeDragStop = vi.fn();
		handleConnect = vi.fn();
		updateEdgeMicropipeConnections = vi.fn();
		updateCableHandles = vi.fn();
		updateEdgeConnection = vi.fn();
		deselectAllNodes = vi.fn();
		setShiftFromKeyboard = vi.fn();
		clearShift = vi.fn();
		transformNodesToSvelteFlow = vi.fn().mockReturnValue([]);
		transformCablesToSvelteFlowEdges = vi.fn().mockReturnValue([]);
	}
}));

vi.mock('$lib/classes/NetworkSchemaSearchManager.svelte.js', () => ({
	NetworkSchemaSearchManager: class MockNetworkSchemaSearchManager {}
}));

describe('/network-schema/+page.svelte', () => {
	const mockData = {
		nodes: [
			{
				id: '1',
				name: 'Test Node 1',
				canvas_x: 100,
				canvas_y: 200,
				node_type: { node_type: 'Type A' },
				status: { status: 'Active' },
				network_level: { network_level: 'Level 1' },
				owner: { company: 'Company A' }
			},
			{
				id: '2',
				name: 'Test Node 2',
				canvas_x: 300,
				canvas_y: 400,
				node_type: { node_type: 'Type B' },
				status: { status: 'Inactive' },
				network_level: { network_level: 'Level 2' },
				owner: { company: 'Company B' }
			}
		],
		cables: [],
		nodeTypes: [],
		cableTypes: [],
		statuses: [],
		networkLevels: [],
		companies: [],
		flags: [],
		excludedNodeTypeIds: [],
		childViewEnabledNodeTypeIds: [],
		networkSchemaSettingsConfigured: true,
		syncStatus: null
	} as unknown as PageData;

	test('should render the SvelteFlow container', () => {
		render(Page, { props: { data: mockData } });

		expect(screen.getByTestId('svelte-flow')).toBeInTheDocument();
	});

	test('should render Background component inside SvelteFlow', () => {
		render(Page, { props: { data: mockData } });

		expect(screen.getByTestId('background')).toBeInTheDocument();
	});

	test('should render Controls component inside SvelteFlow', () => {
		render(Page, { props: { data: mockData } });

		expect(screen.getByTestId('controls')).toBeInTheDocument();
	});

	test('should render Panel component inside SvelteFlow', () => {
		render(Page, { props: { data: mockData } });

		expect(screen.getByTestId('panel')).toBeInTheDocument();
	});

	test('should render the Attributes heading in the panel', () => {
		render(Page, { props: { data: mockData } });

		expect(screen.getByText('Attributes')).toBeInTheDocument();
	});

	test('should render the name input field', () => {
		render(Page, { props: { data: mockData } });

		const input = screen.getByPlaceholderText('Name');
		expect(input).toBeInTheDocument();
	});

	test('should render the Snapping label', () => {
		render(Page, { props: { data: mockData } });

		expect(screen.getByText('Snapping')).toBeInTheDocument();
	});

	test('should render the snapping switch', () => {
		render(Page, { props: { data: mockData } });

		const switches = screen.getAllByTestId('switch');
		expect(switches.length).toBeGreaterThanOrEqual(1);
	});

	test('should render the Drawer component', () => {
		render(Page, { props: { data: mockData } });

		expect(screen.getByTestId('drawer')).toBeInTheDocument();
	});

	test('should render GenericCombobox for cable type selection', () => {
		render(Page, { props: { data: mockData } });

		expect(screen.getByTestId('generic-combobox')).toBeInTheDocument();
	});

	test('should render NetworkSchemaSearch component', () => {
		render(Page, { props: { data: mockData } });

		expect(screen.getByTestId('network-schema-search')).toBeInTheDocument();
	});

	test('should render ViewportPersistence component', () => {
		render(Page, { props: { data: mockData } });

		expect(screen.getByTestId('viewport-persistence')).toBeInTheDocument();
	});

	test('should render with empty nodes array', () => {
		const emptyData = { ...mockData, nodes: [] };
		render(Page, { props: { data: emptyData } });

		expect(screen.getByTestId('svelte-flow')).toBeInTheDocument();
	});

	test('should render with null syncStatus', () => {
		const nullSyncData = { ...mockData, syncStatus: null };
		render(Page, { props: { data: nullSyncData } });

		expect(screen.getByTestId('svelte-flow')).toBeInTheDocument();
	});

	test('should render with completed sync status', () => {
		const syncCompletedData = {
			...mockData,
			syncStatus: {
				sync_in_progress: false,
				sync_status: 'COMPLETED',
				sync_progress: 100.0
			}
		};

		render(Page, { props: { data: syncCompletedData as unknown as PageData } });

		expect(screen.getByTestId('svelte-flow')).toBeInTheDocument();
	});

	test('should render with failed sync status', () => {
		const syncFailedData = {
			...mockData,
			syncStatus: {
				sync_in_progress: false,
				sync_status: 'FAILED',
				error_message: 'Database connection failed'
			}
		};

		render(Page, { props: { data: syncFailedData as unknown as PageData } });

		expect(screen.getByTestId('svelte-flow')).toBeInTheDocument();
	});

	test('should render with in-progress sync status', () => {
		const syncInProgressData = {
			...mockData,
			syncStatus: {
				sync_in_progress: true,
				sync_progress: 75.5,
				sync_started_by: 'test_user',
				sync_status: 'IN_PROGRESS'
			}
		};

		render(Page, { props: { data: syncInProgressData as unknown as PageData } });

		expect(screen.getByTestId('svelte-flow')).toBeInTheDocument();
	});

	test('should render all main UI components together', () => {
		render(Page, { props: { data: mockData } });

		expect(screen.getByTestId('svelte-flow')).toBeInTheDocument();
		expect(screen.getByTestId('background')).toBeInTheDocument();
		expect(screen.getByTestId('controls')).toBeInTheDocument();
		expect(screen.getByTestId('panel')).toBeInTheDocument();
		expect(screen.getByTestId('drawer')).toBeInTheDocument();
		expect(screen.getByTestId('generic-combobox')).toBeInTheDocument();
		expect(screen.getAllByTestId('switch').length).toBeGreaterThanOrEqual(1);
		expect(screen.getByTestId('network-schema-search')).toBeInTheDocument();
		expect(screen.getByTestId('viewport-persistence')).toBeInTheDocument();
	});
});
