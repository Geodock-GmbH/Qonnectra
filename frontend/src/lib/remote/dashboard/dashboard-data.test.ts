import { describe, expect, test } from 'vitest';

import { getDefaultDashboardData, mapStatsToDashboardData } from './dashboard-data';

const minimalTrench = { total_length: 100, count: 1, length_by_types: [] };
const minimalNode = { count_by_type: [{ node_type: 'MFG', count: 1 }] };

describe('dashboard-data', () => {
	const mockStatsData = {
		trench: {
			total_length: 5000,
			count: 10,
			length_by_types: [{ bauweise: 'Open', oberfläche: 'Asphalt', gesamt_länge: 3000 }],
			average_house_connection_length: 25.5,
			length_with_funding: 2000,
			length_with_internal_execution: 1500,
			length_by_status: [{ status_name: 'Active', gesamt_länge: 3000 }],
			length_by_phase: [{ network_level: 'Level 1', gesamt_länge: 2500 }],
			longest_routes: [
				{
					id_trench: 'T-1',
					length: 500,
					construction_type_name: 'Open',
					surface_name: 'Asphalt'
				}
			]
		},
		node: {
			count_by_type: [{ node_type: 'MFG', count: 5 }],
			expiring_warranties: [
				{ id: 1, name: 'Node A', warranty: '2026-10-18', days_until_expiry: 30 }
			],
			count_by_city: [{ city: 'Berlin', count: 3 }],
			count_by_status: [{ status: 'Active', count: 8 }],
			count_by_network_level: [{ network_level: '1', count: 4 }],
			count_by_owner: [{ owner: 'Company A', count: 6 }],
			newest_nodes: [{ name: 'Node B', node_type: 'MFG' }]
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
			length_by_status_type: [{ status_name: 'Active', type_name: 'HDPE', total: 4000 }],
			length_by_network_level: [{ network_level: '1', total: 2000 }],
			avg_length_by_type: [{ type_name: 'HDPE', avg_length: 50 }],
			count_by_status: [{ status_name: 'Active', count: 10 }],
			length_by_owner: [{ owner_name: 'Co A', total: 3000 }],
			length_by_manufacturer: [{ manufacturer_name: 'Mfr A', total: 2500 }],
			conduits_by_month: [{ month: '2026-01', count: 5 }],
			longest_conduits: [{ name: 'C1', type_name: 'HDPE', total_length: 200 }]
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
			addresses_per_area: [{ name: 'A1', count: 40 }],
			addresses_by_area_type: [{ type: 'Urban', count: 60 }],
			nodes_per_area: [{ name: 'A1', count: 20 }],
			nodes_by_area_type: [{ type: 'Urban', count: 30 }],
			trench_length_per_area: [{ name: 'A1', length_m: 1000 }],
			residential_by_area_type: [{ type: 'Urban', count: 100 }]
		}
	};

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
			expect(defaults.areaTotalAddresses).toBe(0);
			expect(defaults.totalNodes).toBe(0);
			expect(defaults.totalResidentialUnits).toBe(0);
		});

		test('should return all array fields as empty arrays', () => {
			const defaults = getDefaultDashboardData();

			expect(defaults.lengthByTypes).toEqual([]);
			expect(defaults.nodesByType).toEqual([]);
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
			const result = mapStatsToDashboardData(mockStatsData);

			expect(result.totalLength).toBe(5000);
			expect(result.count).toBe(10);
			expect(result.avgHouseConnectionLength).toBe(25.5);
			expect(result.lengthWithFunding).toBe(2000);
			expect(result.lengthWithInternalExecution).toBe(1500);
			expect(result.lengthByStatus).toEqual([{ status_name: 'Active', gesamt_länge: 3000 }]);
			expect(result.lengthByNetworkLevel).toEqual([
				{ network_level: 'Level 1', gesamt_länge: 2500 }
			]);
			expect(result.longestRoutes).toEqual([
				{
					id_trench: 'T-1',
					length: 500,
					construction_type_name: 'Open',
					surface_name: 'Asphalt'
				}
			]);
		});

		test('should map length_by_types picking only bauweise, oberfläche, gesamt_länge', () => {
			const result = mapStatsToDashboardData(mockStatsData);

			expect(result.lengthByTypes).toEqual([
				{ bauweise: 'Open', oberfläche: 'Asphalt', gesamt_länge: 3000 }
			]);
		});

		test('should map node statistics', () => {
			const result = mapStatsToDashboardData(mockStatsData);

			expect(result.nodesByType).toEqual([{ node_type: 'MFG', count: 5 }]);
			expect(result.expiringWarranties).toHaveLength(1);
			expect(result.nodesByCity).toEqual([{ city: 'Berlin', count: 3 }]);
			expect(result.nodesByStatus).toEqual([{ status: 'Active', count: 8 }]);
			expect(result.nodesByNetworkLevel).toEqual([{ network_level: '1', count: 4 }]);
			expect(result.nodesByOwner).toEqual([{ owner: 'Company A', count: 6 }]);
			expect(result.newestNodes).toHaveLength(1);
		});

		test('should map address statistics with optional chaining fallbacks', () => {
			const result = mapStatsToDashboardData(mockStatsData);

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

			const result = mapStatsToDashboardData(statsWithoutAddress);

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

			const result = mapStatsToDashboardData(statsWithoutConduit);

			expect(result.conduitLengthByType).toEqual([]);
			expect(result.conduitCountByStatus).toEqual([]);
			expect(result.longestConduits).toEqual([]);
		});

		test('should handle missing area section gracefully', () => {
			const statsWithoutArea = {
				...mockStatsData,
				area: undefined
			};

			const result = mapStatsToDashboardData(statsWithoutArea);

			expect(result.areaCount).toBe(0);
			expect(result.totalCoverageKm2).toBe(0);
			expect(result.areasByType).toEqual([]);
			expect(result.addressesInAreas).toBe(0);
			expect(result.nodesInAreas).toBe(0);
			expect(result.residentialUnitsInAreas).toBe(0);
		});

		test('should map area statistics', () => {
			const result = mapStatsToDashboardData(mockStatsData);

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
			const result = mapStatsToDashboardData(mockStatsData);

			expect(result.conduitLengthByType).toEqual([{ type_name: 'HDPE', total: 4000 }]);
			expect(result.conduitLengthByStatusType).toEqual([
				{ status_name: 'Active', type_name: 'HDPE', total: 4000 }
			]);
			expect(result.conduitLengthByNetworkLevel).toEqual([{ network_level: '1', total: 2000 }]);
			expect(result.conduitAvgLengthByType).toEqual([{ type_name: 'HDPE', avg_length: 50 }]);
			expect(result.conduitCountByStatus).toEqual([{ status_name: 'Active', count: 10 }]);
			expect(result.conduitLengthByOwner).toEqual([{ owner_name: 'Co A', total: 3000 }]);
			expect(result.conduitLengthByManufacturer).toEqual([
				{ manufacturer_name: 'Mfr A', total: 2500 }
			]);
			expect(result.conduitsByMonth).toEqual([{ month: '2026-01', count: 5 }]);
			expect(result.longestConduits).toEqual([
				{ name: 'C1', type_name: 'HDPE', total_length: 200 }
			]);
		});

		test('should default missing trench sub-fields to fallbacks', () => {
			const statsWithMinimalTrench = { ...mockStatsData, trench: minimalTrench };

			const result = mapStatsToDashboardData(statsWithMinimalTrench);

			expect(result.avgHouseConnectionLength).toBe(0);
			expect(result.lengthWithFunding).toBe(0);
			expect(result.lengthWithInternalExecution).toBe(0);
			expect(result.lengthByStatus).toEqual([]);
			expect(result.lengthByNetworkLevel).toEqual([]);
			expect(result.longestRoutes).toEqual([]);
		});

		test('should default missing node sub-fields to fallbacks', () => {
			const statsWithMinimalNode = { ...mockStatsData, node: minimalNode };

			const result = mapStatsToDashboardData(statsWithMinimalNode);

			expect(result.expiringWarranties).toEqual([]);
			expect(result.nodesByCity).toEqual([]);
			expect(result.nodesByStatus).toEqual([]);
			expect(result.nodesByNetworkLevel).toEqual([]);
			expect(result.nodesByOwner).toEqual([]);
			expect(result.newestNodes).toEqual([]);
		});
	});
});
