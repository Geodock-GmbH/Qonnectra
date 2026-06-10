/**
 * Returns the default empty dashboard data shape.
 * Used as fallback when no project is selected or API calls fail.
 * @returns {Record<string, any>}
 */
export function getDefaultDashboardData() {
	return {
		totalLength: 0,
		count: 0,
		lengthByTypes: [],
		avgHouseConnectionLength: 0,
		lengthWithFunding: 0,
		lengthWithInternalExecution: 0,
		lengthByStatus: [],
		lengthByNetworkLevel: [],
		longestRoutes: [],
		expiringWarranties: [],
		nodesByCity: [],
		nodesByStatus: [],
		nodesByNetworkLevel: [],
		nodesByType: [],
		nodesByOwner: [],
		newestNodes: [],
		projects: [],
		addressesByCity: [],
		addressesByStatus: [],
		unitsByCity: [],
		unitsByType: [],
		totalAddresses: 0,
		totalUnits: 0,
		conduitLengthByType: [],
		conduitLengthByStatusType: [],
		conduitLengthByNetworkLevel: [],
		conduitAvgLengthByType: [],
		conduitCountByStatus: [],
		conduitLengthByOwner: [],
		conduitLengthByManufacturer: [],
		conduitsByMonth: [],
		longestConduits: [],
		areaCount: 0,
		totalCoverageKm2: 0,
		areasByType: [],
		addressesInAreas: 0,
		nodesInAreas: 0,
		residentialUnitsInAreas: 0,
		addressesPerArea: [],
		addressesByAreaType: [],
		nodesPerArea: [],
		nodesByAreaType: [],
		trenchLengthPerArea: [],
		residentialByAreaType: []
	};
}

/**
 * Maps raw API statistics and projects data to the dashboard view shape.
 * @param {any} statsData - Raw statistics response from the API.
 * @param {any[]} projectsData - Raw projects list from the API.
 * @returns {Record<string, any>}
 */
export function mapStatsToDashboardData(statsData, projectsData) {
	const { trench, node, address, conduit, area } = statsData;

	return {
		totalLength: trench.total_length,
		count: trench.count,
		lengthByTypes: trench.length_by_types.map((/** @type {any} */ item) => ({
			bauweise: item.bauweise,
			oberfläche: item.oberfläche,
			gesamt_länge: item.gesamt_länge
		})),
		nodesByType: node.count_by_type.map((/** @type {any} */ item) => ({
			node_type: item.node_type,
			count: item.count
		})),
		projects: projectsData.map((/** @type {any} */ item) => ({
			project: item.project,
			description: item.description,
			active: item.active
		})),
		avgHouseConnectionLength: trench.average_house_connection_length || 0,
		lengthWithFunding: trench.length_with_funding || 0,
		lengthWithInternalExecution: trench.length_with_internal_execution || 0,
		lengthByStatus: trench.length_by_status || [],
		lengthByNetworkLevel: trench.length_by_phase || [],
		longestRoutes: trench.longest_routes || [],
		expiringWarranties: node.expiring_warranties || [],
		nodesByCity: node.count_by_city || [],
		nodesByStatus: node.count_by_status || [],
		nodesByNetworkLevel: node.count_by_network_level || [],
		nodesByOwner: node.count_by_owner || [],
		newestNodes: node.newest_nodes || [],
		addressesByCity: address?.count_by_city || [],
		addressesByStatus: address?.count_by_status || [],
		unitsByCity: address?.units_by_city || [],
		unitsByType: address?.units_by_type || [],
		totalAddresses: address?.total_addresses || 0,
		totalUnits: address?.total_units || 0,
		conduitLengthByType: conduit?.length_by_type || [],
		conduitLengthByStatusType: conduit?.length_by_status_type || [],
		conduitLengthByNetworkLevel: conduit?.length_by_network_level || [],
		conduitAvgLengthByType: conduit?.avg_length_by_type || [],
		conduitCountByStatus: conduit?.count_by_status || [],
		conduitLengthByOwner: conduit?.length_by_owner || [],
		conduitLengthByManufacturer: conduit?.length_by_manufacturer || [],
		conduitsByMonth: conduit?.conduits_by_month || [],
		longestConduits: conduit?.longest_conduits || [],
		areaCount: area?.area_count || 0,
		totalCoverageKm2: area?.total_coverage_km2 || 0,
		areasByType: area?.areas_by_type || [],
		areaTotalAddresses: area?.total_addresses || 0,
		addressesInAreas: area?.addresses_in_areas || 0,
		totalNodes: area?.total_nodes || 0,
		nodesInAreas: area?.nodes_in_areas || 0,
		totalResidentialUnits: area?.total_residential_units || 0,
		residentialUnitsInAreas: area?.residential_units_in_areas || 0,
		addressesPerArea: area?.addresses_per_area || [],
		addressesByAreaType: area?.addresses_by_area_type || [],
		nodesPerArea: area?.nodes_per_area || [],
		nodesByAreaType: area?.nodes_by_area_type || [],
		trenchLengthPerArea: area?.trench_length_per_area || [],
		residentialByAreaType: area?.residential_by_area_type || []
	};
}
