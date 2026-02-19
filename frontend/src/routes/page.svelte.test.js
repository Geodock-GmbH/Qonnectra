import { describe, expect, test } from 'vitest';

import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/svelte';

import Page from './dashboard/[[projectId]]/[[flagId]]/+page.svelte';

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
	longestRoutes: []
};

describe('/+page.svelte', () => {
	test('should render dashboard with overview tab', () => {
		render(Page, { props: { data: mockDashboardData } });
		expect(screen.getByRole('heading', { name: 'Trassenstatistik' })).toBeInTheDocument();
	});
});
