import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { load } from './+page.server.js';

vi.mock('$env/static/private', () => ({
	API_URL: 'http://localhost:8000/'
}));

describe('dashboard +page.server.js', () => {
	/** @type {any} */
	let mockFetch;
	/** @type {any} */
	let mockCookies;

	beforeEach(() => {
		vi.clearAllMocks();

		mockCookies = {
			get: vi.fn((name) => {
				if (name === 'api-access-token') return 'mock-token';
				return null;
			})
		};

		mockFetch = vi.fn();
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	const mockStatsData = {
		trench: {
			total_length: 5000,
			count: 10,
			length_by_types: [{ bauweise: 'Open', oberfläche: 'Asphalt', gesamt_länge: 3000 }],
			average_house_connection_length: 25.5,
			length_with_funding: 2000,
			length_with_internal_execution: 1500,
			length_by_status: [{ status: 'Active', length: 3000 }],
			length_by_phase: [{ phase: 'Level 1', length: 2500 }],
			longest_routes: [{ name: 'Route A', length: 500 }]
		},
		node: {
			count_by_type: [{ node_type: 'MFG', count: 5 }],
			expiring_warranties: [{ id: 1, name: 'Node A', days_until_expiry: 30 }],
			count_by_city: [{ city: 'Berlin', count: 3 }],
			count_by_status: [{ status: 'Active', count: 8 }],
			count_by_network_level: [{ level: '1', count: 4 }],
			count_by_owner: [{ owner: 'Company A', count: 6 }],
			newest_nodes: [{ name: 'Node B', created: '2026-01-01' }]
		},
		address: {
			count_by_city: [{ city: 'Berlin', count: 10 }],
			count_by_status: [{ status: 'Active', count: 8 }],
			units_by_city: [{ city: 'Berlin', count: 20 }],
			units_by_type: [{ type: 'Residential', count: 15 }],
			total_addresses: 50,
			total_units: 100
		},
		conduit: {
			length_by_type: [{ type_name: 'HDPE', total: 4000 }],
			length_by_status_type: [],
			length_by_network_level: [],
			avg_length_by_type: [],
			count_by_status: [],
			length_by_owner: [],
			length_by_manufacturer: [],
			conduits_by_month: [],
			longest_conduits: []
		},
		area: {
			area_count: 3,
			total_coverage_km2: 12.5,
			areas_by_type: [{ type_name: 'Urban', count: 2 }],
			total_addresses: 100,
			addresses_in_areas: 80,
			total_nodes: 50,
			nodes_in_areas: 40,
			total_residential_units: 200,
			residential_units_in_areas: 150,
			addresses_per_area: [],
			addresses_by_area_type: [],
			nodes_per_area: [],
			nodes_by_area_type: [],
			trench_length_per_area: [],
			residential_by_area_type: []
		}
	};

	const mockProjectsData = [
		{ project: 'Project A', description: 'Test project', active: true }
	];

	/**
	 * @param {object} [options]
	 * @param {boolean} [options.statsOk]
	 * @param {boolean} [options.projectsOk]
	 * @param {any} [options.statsData]
	 * @param {any[]} [options.projectsData]
	 */
	function setupMocks({
		statsOk = true,
		projectsOk = true,
		statsData = mockStatsData,
		projectsData = mockProjectsData
	} = {}) {
		mockFetch.mockImplementation((/** @type {string} */ url) => {
			if (url.includes('dashboard/statistics')) {
				return Promise.resolve({
					ok: statsOk,
					status: statsOk ? 200 : 500,
					json: () => Promise.resolve(statsData)
				});
			}
			if (url.includes('projects')) {
				return Promise.resolve({
					ok: projectsOk,
					status: projectsOk ? 200 : 500,
					json: () => Promise.resolve(projectsData)
				});
			}
			return Promise.resolve({ ok: false, status: 404 });
		});
	}

	/** @param {string} [projectId] */
	function createLoadArgs(projectId) {
		return /** @type {any} */ ({
			fetch: mockFetch,
			cookies: mockCookies,
			params: projectId ? { projectId } : {}
		});
	}

	describe('no project selected', () => {
		test('should return empty defaults when no projectId', async () => {
			const result = await load(createLoadArgs());

			expect(result.totalLength).toBe(0);
			expect(result.count).toBe(0);
			expect(result.lengthByTypes).toEqual([]);
			expect(result.nodesByType).toEqual([]);
			expect(result.projects).toEqual([]);
			expect(result.totalAddresses).toBe(0);
			expect(result.totalUnits).toBe(0);
			expect(result.areaCount).toBe(0);
			expect(mockFetch).not.toHaveBeenCalled();
		});
	});

	describe('successful data loading', () => {
		test('should return mapped statistics on success', async () => {
			setupMocks();

			const result = await load(createLoadArgs('1'));

			expect(result.totalLength).toBe(5000);
			expect(result.count).toBe(10);
			expect(result.lengthByTypes).toEqual([
				{ bauweise: 'Open', oberfläche: 'Asphalt', gesamt_länge: 3000 }
			]);
			expect(result.nodesByType).toEqual([{ node_type: 'MFG', count: 5 }]);
			expect(result.avgHouseConnectionLength).toBe(25.5);
			expect(result.lengthWithFunding).toBe(2000);
			expect(result.lengthWithInternalExecution).toBe(1500);
		});

		test('should return mapped projects', async () => {
			setupMocks();

			const result = await load(createLoadArgs('1'));

			expect(result.projects).toEqual([
				{ project: 'Project A', description: 'Test project', active: true }
			]);
		});

		test('should return address statistics', async () => {
			setupMocks();

			const result = await load(createLoadArgs('1'));

			expect(result.totalAddresses).toBe(50);
			expect(result.totalUnits).toBe(100);
			expect(result.addressesByCity).toEqual([{ city: 'Berlin', count: 10 }]);
		});

		test('should return conduit statistics', async () => {
			setupMocks();

			const result = await load(createLoadArgs('1'));

			expect(result.conduitLengthByType).toEqual([{ type_name: 'HDPE', total: 4000 }]);
		});

		test('should return area statistics', async () => {
			setupMocks();

			const result = await load(createLoadArgs('1'));

			expect(result.areaCount).toBe(3);
			expect(result.totalCoverageKm2).toBe(12.5);
			expect(result.areasByType).toEqual([{ type_name: 'Urban', count: 2 }]);
			expect(result.addressesInAreas).toBe(80);
			expect(result.nodesInAreas).toBe(40);
			expect(result.residentialUnitsInAreas).toBe(150);
		});

		test('should return node-related data', async () => {
			setupMocks();

			const result = await load(createLoadArgs('1'));

			expect(result.expiringWarranties).toHaveLength(1);
			expect(result.nodesByCity).toEqual([{ city: 'Berlin', count: 3 }]);
			expect(result.nodesByStatus).toEqual([{ status: 'Active', count: 8 }]);
			expect(result.newestNodes).toHaveLength(1);
		});
	});

	describe('API call parameters', () => {
		test('should fetch with correct project ID', async () => {
			setupMocks();

			await load(createLoadArgs('42'));

			const statsCall = mockFetch.mock.calls.find((/** @type {any} */ c) =>
				c[0].includes('dashboard/statistics')
			);
			expect(statsCall[0]).toContain('project=42');
		});

		test('should pass auth headers and credentials', async () => {
			setupMocks();

			await load(createLoadArgs('1'));

			mockFetch.mock.calls.forEach((/** @type {any} */ call) => {
				expect(call[1].headers.Cookie).toBe('api-access-token=mock-token');
				expect(call[1].credentials).toBe('include');
			});
		});
	});

	describe('error handling', () => {
		test('should return empty data when stats fetch fails', async () => {
			setupMocks({ statsOk: false });

			const result = await load(createLoadArgs('1'));

			expect(result.totalLength).toBe(0);
			expect(result.count).toBe(0);
			expect(result.lengthByTypes).toEqual([]);
			expect(result.projects).toEqual([]);
		});

		test('should return empty data when projects fetch fails', async () => {
			setupMocks({ projectsOk: false });

			const result = await load(createLoadArgs('1'));

			expect(result.totalLength).toBe(0);
			expect(result.count).toBe(0);
			expect(result.projects).toEqual([]);
		});

		test('should return empty data on network error', async () => {
			mockFetch.mockRejectedValue(new Error('Network error'));

			const result = await load(createLoadArgs('1'));

			expect(result.totalLength).toBe(0);
			expect(result.count).toBe(0);
			expect(result.lengthByTypes).toEqual([]);
			expect(result.nodesByType).toEqual([]);
			expect(result.projects).toEqual([]);
			expect(result.areaCount).toBe(0);
		});
	});
});
