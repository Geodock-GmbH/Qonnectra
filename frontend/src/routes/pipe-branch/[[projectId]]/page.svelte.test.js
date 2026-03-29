import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/svelte';
import { describe, expect, test, vi } from 'vitest';

import Page from './+page.svelte';

vi.mock('$lib/paraglide/messages', () => {
	const mockMessages = new Proxy(
		{},
		{
			get: (target, prop) => {
				/** @type {Record<string, string>} */
				const messageMap = {
					nav_pipe_branch: 'Pipe Branch',
					common_attributes: 'Attributes',
					common_error: 'Error',
					common_warning: 'Warning',
					common_selected: 'Selected',
					form_node: 'Node',
					form_select_exactly_2_nodes: 'Please select exactly 2 nodes',
					placeholder_select_pipe_branch: 'Select pipe branch',
					message_pipe_branch_not_configured: 'Pipe branch not configured',
					action_edit_trench_selection: 'Edit trench selection',
					action_connect_selected_nodes: 'Connect selected nodes',
					action_clear_selection: 'Clear selection',
					title_success: 'Success',
					message_please_select_exactly_2_nodes: 'Please select exactly 2 nodes',
					message_error_cannot_connect_from_source: 'Cannot connect from source',
					message_error_cannot_connect_microduct_to_itself: 'Cannot connect microduct to itself',
					message_error_could_not_find_selected_nodes: 'Could not find selected nodes',
					message_error_no_matching_microducts: 'No matching microducts',
					message_created_connections: 'connections created',
					message_failed_to_create_connections: 'Failed to create connections',
					message_no_trenches_near_node: 'No trenches near node'
				};
				return () => messageMap[/** @type {string} */ (prop)] || String(prop);
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

vi.mock('@xyflow/svelte', async () => {
	const mocks = await import('$lib/test-utils/mocks/xyflow-svelte.js');
	return { ...mocks, ConnectionMode: { Loose: 'loose' } };
});

vi.mock('@xyflow/svelte/dist/style.css', () => ({}));

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
			cb({ url: new URL('http://localhost/pipe-branch/proj-1') });
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
			cb('proj-1');
			return () => {};
		}
	}
}));

vi.mock('$lib/components/VirtualCombobox.svelte', async () => {
	const { default: MockGenericCombobox } =
		await import('$lib/test-utils/mocks/MockGenericCombobox.svelte');
	return { default: MockGenericCombobox };
});

vi.mock('./TrenchSelector.svelte', async () => {
	const { default: MockTrenchSelector } =
		await import('$lib/test-utils/mocks/MockTrenchSelector.svelte');
	return { default: MockTrenchSelector };
});

vi.mock('./LassoModeSwitch.svelte', async () => {
	const { default: MockLassoModeSwitch } =
		await import('$lib/test-utils/mocks/MockLassoModeSwitch.svelte');
	return { default: MockLassoModeSwitch };
});

vi.mock('./PipeBranchLasso.svelte', async () => {
	const { default: MockPipeBranchLasso } =
		await import('$lib/test-utils/mocks/MockPipeBranchLasso.svelte');
	return { default: MockPipeBranchLasso };
});

vi.mock('./PipeBranchEdge.svelte', () => ({
	default: vi.fn()
}));

vi.mock('./PipeBranchNode.svelte', () => ({
	default: vi.fn()
}));

describe('/pipe-branch/+page.svelte', () => {
	/** @type {any} */
	const mockData = {
		nodes: [
			{ label: 'Node A', value: 'Node A', uuid: 'uuid-a' },
			{ label: 'Node B', value: 'Node B', uuid: 'uuid-b' }
		],
		pipeBranchConfigured: true
	};

	test('should render the SvelteFlow container', () => {
		render(Page, { props: { data: mockData } });

		expect(screen.getByTestId('svelte-flow')).toBeInTheDocument();
	});

	test('should render Background component', () => {
		render(Page, { props: { data: mockData } });

		expect(screen.getByTestId('background')).toBeInTheDocument();
	});

	test('should render Controls component', () => {
		render(Page, { props: { data: mockData } });

		expect(screen.getByTestId('controls')).toBeInTheDocument();
	});

	test('should render Panel component', () => {
		render(Page, { props: { data: mockData } });

		expect(screen.getByTestId('panel')).toBeInTheDocument();
	});

	test('should render the Attributes heading', () => {
		render(Page, { props: { data: mockData } });

		expect(screen.getByText('Attributes')).toBeInTheDocument();
	});

	test('should render VirtualCombobox for node selection', () => {
		render(Page, { props: { data: mockData } });

		expect(screen.getByTestId('generic-combobox')).toBeInTheDocument();
	});

	test('should render LassoModeSwitch component', () => {
		render(Page, { props: { data: mockData } });

		expect(screen.getByTestId('lasso-mode-switch')).toBeInTheDocument();
	});

	test('should render with empty nodes array', () => {
		const emptyData = { ...mockData, nodes: [] };
		render(Page, { props: { data: emptyData } });

		expect(screen.getByTestId('svelte-flow')).toBeInTheDocument();
	});

	test('should render with null data nodes', () => {
		const nullData = { ...mockData, nodes: null };
		render(Page, { props: { data: nullData } });

		expect(screen.getByTestId('svelte-flow')).toBeInTheDocument();
	});

	test('should show warning when pipe branch is not configured', () => {
		const unconfiguredData = {
			...mockData,
			pipeBranchConfigured: false
		};
		render(Page, { props: { data: unconfiguredData } });

		expect(screen.getByText('Pipe branch not configured')).toBeInTheDocument();
	});

	test('should not show warning when pipe branch is configured', () => {
		render(Page, { props: { data: mockData } });

		expect(screen.queryByText('Pipe branch not configured')).not.toBeInTheDocument();
	});

	test('should not show warning when there are no branches', () => {
		const emptyBranches = { ...mockData, nodes: [], pipeBranchConfigured: false };
		render(Page, { props: { data: emptyBranches } });

		expect(screen.queryByText('Pipe branch not configured')).not.toBeInTheDocument();
	});

	test('should render all main UI components together', () => {
		render(Page, { props: { data: mockData } });

		expect(screen.getByTestId('svelte-flow')).toBeInTheDocument();
		expect(screen.getByTestId('background')).toBeInTheDocument();
		expect(screen.getByTestId('controls')).toBeInTheDocument();
		expect(screen.getByTestId('panel')).toBeInTheDocument();
		expect(screen.getByTestId('generic-combobox')).toBeInTheDocument();
		expect(screen.getByTestId('lasso-mode-switch')).toBeInTheDocument();
	});
});
