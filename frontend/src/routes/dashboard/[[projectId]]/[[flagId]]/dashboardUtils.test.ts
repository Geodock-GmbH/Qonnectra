import { describe, expect, test } from 'vitest';

import { getDefaultDashboardData, mapStatsToDashboardData } from './dashboardUtils.js';

describe('dashboardUtils', () => {
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
			length_by_status_type: [{ status: 'Active', type: 'HDPE' }],
			length_by_network_level: [{ level: '1', length: 2000 }],
			avg_length_by_type: [{ type: 'HDPE', avg: 50 }],
			count_by_status: [{ status: 'Active', count: 10 }],
			length_by_owner: [{ owner: 'Co A', length: 3000 }],
			length_by_manufacturer: [{ manufacturer: 'Mfr A', length: 2500 }],
			conduits_by_month: [{ month: '2026-01', count: 5 }],
			longest_conduits: [{ name: 'C1', length: 200 }]
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
			addresses_per_area: [{ area: 'A1', count: 40 }],
			addresses_by_area_type: [{ type: 'Urban', count: 60 }],
			nodes_per_area: [{ area: 'A1', count: 20 }],
			nodes_by_area_type: [{ type: 'Urban', count: 30 }],
			trench_length_per_area: [{ area: 'A1', length: 1000 }],
			residential_by_area_type: [{ type: 'Urban', count: 100 }]
		}
	};

	const mockProjectsData = [{ project: 'Project A', description: 'Test project', active: true }];

	describe('getDefaultDashboardData', () => {
		test('should return all numeric fields as 0', () => {
			const defaults = getDefaultDashboardData();

			expect(defaults.totalLength).toBe(0);
			expect(defaults.count).toBe(0);
			expect(defaults.avgHouseConnectionLength).toBe(0);
			expect(defaults.lengthWithFunding).toBe(0);
			expect(defaults.lengthWithInternalExecution).toBe(0);
			expect(defaults.totalAddresses).toBe(0);
			expect(defaults.totalUnits).toBe(0);
			expect(defaults.areaCount).toBe(0);
			expect(defaults.totalCoverageKm2).toBe(0);
			expect(defaults.addressesInAreas).toBe(0);
			expect(defaults.nodesInAreas).toBe(0);
			expect(defaults.residentialUnitsInAreas).toBe(0);
		});

		test('should return all array fields as empty arrays', () => {
			const defaults = getDefaultDashboardData();

			expect(defaults.lengthByTypes).toEqual([]);
			expect(defaults.nodesByType).toEqual([]);
			expect(defaults.projects).toEqual([]);
			expect(defaults.lengthByStatus).toEqual([]);
			expect(defaults.lengthByNetworkLevel).toEqual([]);
			expect(defaults.longestRoutes).toEqual([]);
			expect(defaults.expiringWarranties).toEqual([]);
			expect(defaults.nodesByCity).toEqual([]);
			expect(defaults.nodesByStatus).toEqual([]);
			expect(defaults.nodesByNetworkLevel).toEqual([]);
			expect(defaults.nodesByOwner).toEqual([]);
			expect(defaults.newestNodes).toEqual([]);
			expect(defaults.addressesByCity).toEqual([]);
			expect(defaults.addressesByStatus).toEqual([]);
			expect(defaults.unitsByCity).toEqual([]);
			expect(defaults.unitsByType).toEqual([]);
			expect(defaults.conduitLengthByType).toEqual([]);
			expect(defaults.conduitLengthByStatusType).toEqual([]);
			expect(defaults.conduitLengthByNetworkLevel).toEqual([]);
			expect(defaults.conduitAvgLengthByType).toEqual([]);
			expect(defaults.conduitCountByStatus).toEqual([]);
			expect(defaults.conduitLengthByOwner).toEqual([]);
			expect(defaults.conduitLengthByManufacturer).toEqual([]);
			expect(defaults.conduitsByMonth).toEqual([]);
			expect(defaults.longestConduits).toEqual([]);
			expect(defaults.areasByType).toEqual([]);
			expect(defaults.addressesPerArea).toEqual([]);
			expect(defaults.addressesByAreaType).toEqual([]);
			expect(defaults.nodesPerArea).toEqual([]);
			expect(defaults.nodesByAreaType).toEqual([]);
			expect(defaults.trenchLengthPerArea).toEqual([]);
			expect(defaults.residentialByAreaType).toEqual([]);
		});

		test('should return a fresh object on each call', () => {
			const a = getDefaultDashboardData();
			const b = getDefaultDashboardData();

			expect(a).not.toBe(b);
			expect(a).toEqual(b);
		});
	});

	describe('mapStatsToDashboardData', () => {
		test('should map trench statistics', () => {
			const result = mapStatsToDashboardData(mockStatsData, mockProjectsData);

			expect(result.totalLength).toBe(5000);
			expect(result.count).toBe(10);
			expect(result.avgHouseConnectionLength).toBe(25.5);
			expect(result.lengthWithFunding).toBe(2000);
			expect(result.lengthWithInternalExecution).toBe(1500);
			expect(result.lengthByStatus).toEqual([{ status: 'Active', length: 3000 }]);
			expect(result.lengthByNetworkLevel).toEqual([{ phase: 'Level 1', length: 2500 }]);
			expect(result.longestRoutes).toEqual([{ name: 'Route A', length: 500 }]);
		});

		test('should map length_by_types picking only bauweise, oberfläche, gesamt_länge', () => {
			const result = mapStatsToDashboardData(mockStatsData, mockProjectsData);

			expect(result.lengthByTypes).toEqual([
				{ bauweise: 'Open', oberfläche: 'Asphalt', gesamt_länge: 3000 }
			]);
		});

		test('should map node statistics', () => {
			const result = mapStatsToDashboardData(mockStatsData, mockProjectsData);

			expect(result.nodesByType).toEqual([{ node_type: 'MFG', count: 5 }]);
			expect(result.expiringWarranties).toHaveLength(1);
			expect(result.nodesByCity).toEqual([{ city: 'Berlin', count: 3 }]);
			expect(result.nodesByStatus).toEqual([{ status: 'Active', count: 8 }]);
			expect(result.nodesByNetworkLevel).toEqual([{ level: '1', count: 4 }]);
			expect(result.nodesByOwner).toEqual([{ owner: 'Company A', count: 6 }]);
			expect(result.newestNodes).toHaveLength(1);
		});

		test('should map projects picking only project, description, active', () => {
			const result = mapStatsToDashboardData(mockStatsData, mockProjectsData);

			expect(result.projects).toEqual([
				{ project: 'Project A', description: 'Test project', active: true }
			]);
		});

		test('should map address statistics with optional chaining fallbacks', () => {
			const result = mapStatsToDashboardData(mockStatsData, mockProjectsData);

			expect(result.totalAddresses).toBe(50);
			expect(result.totalUnits).toBe(100);
			expect(result.addressesByCity).toEqual([{ city: 'Berlin', count: 10 }]);
			expect(result.addressesByStatus).toEqual([{ status: 'Active', count: 8 }]);
			expect(result.unitsByCity).toEqual([{ city: 'Berlin', count: 20 }]);
			expect(result.unitsByType).toEqual([{ type: 'Residential', count: 15 }]);
		});

		test('should handle missing address section gracefully', () => {
			const statsWithoutAddress = {
				...mockStatsData,
				address: undefined
			};

			const result = mapStatsToDashboardData(statsWithoutAddress, mockProjectsData);

			expect(result.totalAddresses).toBe(0);
			expect(result.totalUnits).toBe(0);
			expect(result.addressesByCity).toEqual([]);
			expect(result.addressesByStatus).toEqual([]);
		});

		test('should handle missing conduit section gracefully', () => {
			const statsWithoutConduit = {
				...mockStatsData,
				conduit: undefined
			};

			const result = mapStatsToDashboardData(statsWithoutConduit, mockProjectsData);

			expect(result.conduitLengthByType).toEqual([]);
			expect(result.conduitCountByStatus).toEqual([]);
			expect(result.longestConduits).toEqual([]);
		});

		test('should handle missing area section gracefully', () => {
			const statsWithoutArea = {
				...mockStatsData,
				area: undefined
			};

			const result = mapStatsToDashboardData(statsWithoutArea, mockProjectsData);

			expect(result.areaCount).toBe(0);
			expect(result.totalCoverageKm2).toBe(0);
			expect(result.areasByType).toEqual([]);
			expect(result.addressesInAreas).toBe(0);
			expect(result.nodesInAreas).toBe(0);
			expect(result.residentialUnitsInAreas).toBe(0);
		});

		test('should map area statistics', () => {
			const result = mapStatsToDashboardData(mockStatsData, mockProjectsData);

			expect(result.areaCount).toBe(3);
			expect(result.totalCoverageKm2).toBe(12.5);
			expect(result.areaTotalAddresses).toBe(100);
			expect(result.addressesInAreas).toBe(80);
			expect(result.totalNodes).toBe(50);
			expect(result.nodesInAreas).toBe(40);
			expect(result.totalResidentialUnits).toBe(200);
			expect(result.residentialUnitsInAreas).toBe(150);
		});

		test('should map conduit statistics', () => {
			const result = mapStatsToDashboardData(mockStatsData, mockProjectsData);

			expect(result.conduitLengthByType).toEqual([{ type_name: 'HDPE', total: 4000 }]);
			expect(result.conduitLengthByStatusType).toEqual([{ status: 'Active', type: 'HDPE' }]);
			expect(result.conduitLengthByNetworkLevel).toEqual([{ level: '1', length: 2000 }]);
			expect(result.conduitAvgLengthByType).toEqual([{ type: 'HDPE', avg: 50 }]);
			expect(result.conduitCountByStatus).toEqual([{ status: 'Active', count: 10 }]);
			expect(result.conduitLengthByOwner).toEqual([{ owner: 'Co A', length: 3000 }]);
			expect(result.conduitLengthByManufacturer).toEqual([{ manufacturer: 'Mfr A', length: 2500 }]);
			expect(result.conduitsByMonth).toEqual([{ month: '2026-01', count: 5 }]);
			expect(result.longestConduits).toEqual([{ name: 'C1', length: 200 }]);
		});

		test('should default missing trench sub-fields to fallbacks', () => {
			const statsWithMinimalTrench = {
				...mockStatsData,
				trench: {
					total_length: 100,
					count: 1,
					length_by_types: []
				}
			};

			const result = mapStatsToDashboardData(statsWithMinimalTrench, mockProjectsData);

			expect(result.avgHouseConnectionLength).toBe(0);
			expect(result.lengthWithFunding).toBe(0);
			expect(result.lengthWithInternalExecution).toBe(0);
			expect(result.lengthByStatus).toEqual([]);
			expect(result.lengthByNetworkLevel).toEqual([]);
			expect(result.longestRoutes).toEqual([]);
		});

		test('should default missing node sub-fields to fallbacks', () => {
			const statsWithMinimalNode = {
				...mockStatsData,
				node: {
					count_by_type: [{ node_type: 'MFG', count: 1 }]
				}
			};

			const result = mapStatsToDashboardData(statsWithMinimalNode, mockProjectsData);

			expect(result.expiringWarranties).toEqual([]);
			expect(result.nodesByCity).toEqual([]);
			expect(result.nodesByStatus).toEqual([]);
			expect(result.nodesByNetworkLevel).toEqual([]);
			expect(result.nodesByOwner).toEqual([]);
			expect(result.newestNodes).toEqual([]);
		});
	});
});
