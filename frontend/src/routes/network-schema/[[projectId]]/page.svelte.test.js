import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import Page from './+page.svelte';

// Paraglide messages
vi.mock('$lib/paraglide/messages', () => ({
	m: {
		nav_network_schema: () => 'Network Schema'
	}
}));

// Mock SvelteFlow components
vi.mock('@xyflow/svelte', () => ({
	SvelteFlow: vi.fn().mockImplementation(({ children, ...props }) => {
		return {
			$$: {
				render: () =>
					`<div data-testid="svelte-flow" ${Object.entries(props)
						.map(([k, v]) => `${k}="${v}"`)
						.join(' ')}>${children || ''}</div>`
			}
		};
	}),
	Background: vi.fn().mockImplementation(() => ({
		$$: { render: () => '<div data-testid="background"></div>' }
	})),
	Controls: vi.fn().mockImplementation(() => ({
		$$: { render: () => '<div data-testid="controls"></div>' }
	})),
	Panel: vi.fn().mockImplementation(({ children }) => ({
		$$: { render: () => `<div data-testid="panel">${children || ''}</div>` }
	}))
}));

// Mock stores
vi.mock('$lib/stores/drawer', () => ({
	drawerStore: {
		open: vi.fn()
	}
}));

vi.mock('$app/stores', () => ({
	navigating: { subscribe: vi.fn() },
	page: { subscribe: vi.fn() }
}));

vi.mock('$app/navigation', () => ({
	goto: vi.fn()
}));

vi.mock('$lib/stores/store', () => ({
	selectedProject: { subscribe: vi.fn() }
}));

// Mock custom components
vi.mock('./Card.svelte', () => ({
	default: vi.fn().mockImplementation(() => ({
		$$: { render: () => '<div data-testid="card">Card Component</div>' }
	}))
}));

vi.mock('$lib/components/Drawer.svelte', () => ({
	default: vi.fn().mockImplementation(({ children }) => ({
		$$: { render: () => `<div data-testid="drawer">${children || ''}</div>` }
	}))
}));

vi.mock('./CableDiagramNode.svelte', () => ({
	default: vi.fn().mockImplementation(() => ({
		$$: { render: () => '<div data-testid="cable-diagram-node">Cable Diagram Node</div>' }
	}))
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
		syncStatus: null
	};

	test('should render network schema title', () => {
		render(Page, { props: { data: mockData } });

		expect(screen.getByText('Network Schema')).toBeInTheDocument();
	});

	test('should display node count in panel', () => {
		render(Page, { props: { data: mockData } });

		expect(screen.getByText(/Total: 2 nodes/)).toBeInTheDocument();
	});

	test('should show canvas coordinates ready when nodes loaded', () => {
		render(Page, { props: { data: mockData } });

		expect(screen.getByText('✓ Canvas coordinates ready')).toBeInTheDocument();
	});

	test('should show no nodes warning when no nodes loaded', () => {
		const emptyData = { ...mockData, nodes: [] };
		render(Page, { props: { data: emptyData } });

		expect(screen.getByText('⚠ No nodes loaded')).toBeInTheDocument();
		expect(screen.getByText(/Total: 0 nodes/)).toBeInTheDocument();
	});

	test('should display sync in progress status', () => {
		const syncInProgressData = {
			...mockData,
			syncStatus: {
				sync_in_progress: true,
				sync_progress: 75.5,
				sync_started_by: 'test_user',
				sync_status: 'IN_PROGRESS'
			}
		};

		render(Page, { props: { data: syncInProgressData } });

		expect(screen.getByText('🔄 Canvas sync in progress')).toBeInTheDocument();
		expect(screen.getByText('75.5% complete')).toBeInTheDocument();
		expect(screen.getByText('Started by: test_user')).toBeInTheDocument();
	});

	test('should display sync failed status', () => {
		const syncFailedData = {
			...mockData,
			syncStatus: {
				sync_in_progress: false,
				sync_status: 'FAILED',
				error_message: 'Database connection failed'
			}
		};

		render(Page, { props: { data: syncFailedData } });

		expect(screen.getByText('❌ Canvas sync failed')).toBeInTheDocument();
		expect(screen.getByText('Database connection failed')).toBeInTheDocument();
	});

	test('should not show started by user if not provided', () => {
		const syncInProgressData = {
			...mockData,
			syncStatus: {
				sync_in_progress: true,
				sync_progress: 50.0,
				sync_status: 'IN_PROGRESS'
				// sync_started_by is undefined
			}
		};

		render(Page, { props: { data: syncInProgressData } });

		expect(screen.getByText('🔄 Canvas sync in progress')).toBeInTheDocument();
		expect(screen.queryByText(/Started by:/)).not.toBeInTheDocument();
	});

	test('should not show error message if not provided in failed state', () => {
		const syncFailedData = {
			...mockData,
			syncStatus: {
				sync_in_progress: false,
				sync_status: 'FAILED'
				// error_message is undefined
			}
		};

		render(Page, { props: { data: syncFailedData } });

		expect(screen.getByText('❌ Canvas sync failed')).toBeInTheDocument();
		expect(screen.queryByText(/Database/)).not.toBeInTheDocument();
	});

	test('should handle sync status with completed state', () => {
		const syncCompletedData = {
			...mockData,
			syncStatus: {
				sync_in_progress: false,
				sync_status: 'COMPLETED',
				sync_progress: 100.0
			}
		};

		render(Page, { props: { data: syncCompletedData } });

		// Should show canvas coordinates ready since sync is not in progress and not failed
		expect(screen.getByText('✓ Canvas coordinates ready')).toBeInTheDocument();
		expect(screen.queryByText('sync in progress')).not.toBeInTheDocument();
		expect(screen.queryByText('sync failed')).not.toBeInTheDocument();
	});

	test('should open drawer when button clicked', async () => {
		const { drawerStore } = await import('$lib/stores/drawer');
		const user = userEvent.setup();

		render(Page, { props: { data: mockData } });

		const button = screen.getByRole('button', { name: /Node Details/ });
		await user.click(button);

		expect(drawerStore.open).toHaveBeenCalledWith({ title: 'Node Details' });
	});

	test('should transform nodes to SvelteFlow format correctly', () => {
		render(Page, { props: { data: mockData } });

		// The component should render SvelteFlow component
		expect(screen.getByTestId('svelte-flow')).toBeInTheDocument();
	});

	test('should handle nodes with missing canvas coordinates', () => {
		const nodesWithoutCanvas = {
			nodes: [
				{
					id: '1',
					name: 'Node Without Canvas',
					canvas_x: null,
					canvas_y: null,
					geometry: {
						coordinates: [1000.0, 2000.0]
					},
					node_type: { node_type: 'Type A' },
					status: { status: 'Active' },
					network_level: { network_level: 'Level 1' },
					owner: { company: 'Company A' }
				}
			],
			syncStatus: null
		};

		render(Page, { props: { data: nodesWithoutCanvas } });

		// Should still render the component without errors
		expect(screen.getByText(/Total: 1 nodes/)).toBeInTheDocument();
	});

	test('should handle GeoJSON feature format nodes', () => {
		const geoJsonData = {
			nodes: {
				features: [
					{
						id: '1',
						properties: {
							name: 'GeoJSON Node',
							canvas_x: 150,
							canvas_y: 250,
							node_type: { node_type: 'GeoType' },
							status: { status: 'Active' },
							network_level: { network_level: 'Level 1' },
							owner: { company: 'GeoCompany' }
						},
						geometry: {
							coordinates: [1500.0, 2500.0]
						}
					}
				]
			},
			syncStatus: null
		};

		render(Page, { props: { data: geoJsonData } });

		// Should handle GeoJSON format correctly
		expect(screen.getByText(/Total: 1 nodes/)).toBeInTheDocument();
	});

	test('should handle mixed sync status priorities correctly', () => {
		// sync_in_progress should take priority over sync_status
		const mixedSyncData = {
			...mockData,
			syncStatus: {
				sync_in_progress: true,
				sync_status: 'FAILED', // This should be ignored because sync_in_progress is true
				sync_progress: 25.0,
				error_message: 'This should not show'
			}
		};

		render(Page, { props: { data: mixedSyncData } });

		expect(screen.getByText('🔄 Canvas sync in progress')).toBeInTheDocument();
		expect(screen.queryByText('❌ Canvas sync failed')).not.toBeInTheDocument();
		expect(screen.queryByText('This should not show')).not.toBeInTheDocument();
	});

	test('should handle zero progress correctly', () => {
		const zeroProgressData = {
			...mockData,
			syncStatus: {
				sync_in_progress: true,
				sync_progress: 0.0,
				sync_status: 'IN_PROGRESS'
			}
		};

		render(Page, { props: { data: zeroProgressData } });

		expect(screen.getByText('0.0% complete')).toBeInTheDocument();
	});

	test('should handle high precision progress values', () => {
		const preciseProgressData = {
			...mockData,
			syncStatus: {
				sync_in_progress: true,
				sync_progress: 33.333333333,
				sync_status: 'IN_PROGRESS'
			}
		};

		render(Page, { props: { data: preciseProgressData } });

		expect(screen.getByText('33.3% complete')).toBeInTheDocument();
	});

	test('should handle null syncStatus gracefully', () => {
		const nullSyncData = { ...mockData, syncStatus: null };

		render(Page, { props: { data: nullSyncData } });

		// Should show canvas coordinates ready for loaded nodes
		expect(screen.getByText('✓ Canvas coordinates ready')).toBeInTheDocument();
	});

	test('should handle undefined syncStatus gracefully', () => {
		const undefinedSyncData = { ...mockData };
		delete undefinedSyncData.syncStatus;

		render(Page, { props: { data: undefinedSyncData } });

		// Should show canvas coordinates ready for loaded nodes
		expect(screen.getByText('✓ Canvas coordinates ready')).toBeInTheDocument();
	});

	test('should display correct project ID', () => {
		render(Page, { props: { data: mockData } });

		expect(screen.getByText(/Project: 1/)).toBeInTheDocument();
	});

	test('should render all main UI components', () => {
		render(Page, { props: { data: mockData } });

		// Check that all major components are rendered
		expect(screen.getByTestId('svelte-flow')).toBeInTheDocument();
		expect(screen.getByTestId('background')).toBeInTheDocument();
		expect(screen.getByTestId('controls')).toBeInTheDocument();
		expect(screen.getByTestId('panel')).toBeInTheDocument();
		expect(screen.getByTestId('drawer')).toBeInTheDocument();
		expect(screen.getByTestId('card')).toBeInTheDocument();
	});
});
