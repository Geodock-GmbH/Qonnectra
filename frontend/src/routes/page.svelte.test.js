import { describe, expect, test, vi } from 'vitest';

import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/svelte';

import Page from './dashboard/[[projectId]]/[[flagId]]/+page.svelte';

// Mock paraglide messages
vi.mock('$lib/paraglide/messages', () => {
	const mockMessages = new Proxy(
		{},
		{
			get: (target, prop) => {
				const messageMap = {
					nav_dashboard: 'Dashboard',
					common_overview: 'Overview',
					nav_trench: 'Trench',
					nav_conduit: 'Conduit',
					nav_node: 'Node',
					nav_address: 'Address',
					form_project: 'Projects',
					form_trench_statistics: 'Trench Statistics',
					form_total_length: 'Total Length',
					form_breakdown_by_type: 'Breakdown by Type'
				};
				return () => messageMap[prop] || String(prop);
			}
		}
	);
	return { m: mockMessages };
});

// Mock app stores
vi.mock('$app/stores', () => ({
	navigating: {
		subscribe: (cb) => {
			cb(null);
			return () => {};
		}
	}
}));

// Mock child components that may have complex dependencies
vi.mock('$lib/components/AddressStatistics.svelte', async () => {
	const { default: MockAddressStatistics } =
		await import('$lib/test-utils/mocks/MockAddressStatistics.svelte');
	return { default: MockAddressStatistics };
});

vi.mock('$lib/components/ConduitStatistics.svelte', async () => {
	const { default: MockConduitStatistics } =
		await import('$lib/test-utils/mocks/MockConduitStatistics.svelte');
	return { default: MockConduitStatistics };
});

vi.mock('$lib/components/NodeStatistics.svelte', async () => {
	const { default: MockNodeStatistics } =
		await import('$lib/test-utils/mocks/MockNodeStatistics.svelte');
	return { default: MockNodeStatistics };
});

vi.mock('$lib/components/TrenchStatistics.svelte', async () => {
	const { default: MockTrenchStatistics } =
		await import('$lib/test-utils/mocks/MockTrenchStatistics.svelte');
	return { default: MockTrenchStatistics };
});

const mockDashboardData = {
	projects: [],
	totalLength: 0,
	count: 0,
	lengthByTypes: [],
	nodesByType: [],
	expiringWarranties: [],
	avgHouseConnectionLength: 0,
	lengthWithFunding: 0,
	lengthWithInternalExecution: 0,
	lengthByStatus: [],
	lengthByNetworkLevel: [],
	longestRoutes: [],
	addressCount: 0,
	addressesByStatus: [],
	conduitCount: 0,
	conduitsByStatus: []
};

describe('/+page.svelte', () => {
	test('should render dashboard with overview tab', () => {
		render(Page, { props: { data: mockDashboardData } });
		expect(screen.getByText('Trench Statistics')).toBeInTheDocument();
	});
});
