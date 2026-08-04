interface LengthByType {
	bauweise: string;
	oberfläche: string;
	gesamt_länge: number;
}

interface NodeByType {
	node_type: string;
	count: number;
}

interface ProjectItem {
	project: string;
	description: string;
	active: boolean;
}

interface NamedCount {
	name: string;
	count: number;
}

interface LabeledValue {
	label: string;
	value: number;
}

export interface DashboardData {
	totalLength: number;
	count: number;
	lengthByTypes: LengthByType[];
	avgHouseConnectionLength: number;
	lengthWithFunding: number;
	lengthWithInternalExecution: number;
	lengthByStatus: LabeledValue[];
	lengthByNetworkLevel: LabeledValue[];
	longestRoutes: unknown[];
	expiringWarranties: unknown[];
	nodesByCity: NamedCount[];
	nodesByStatus: NamedCount[];
	nodesByNetworkLevel: NamedCount[];
	nodesByType: NodeByType[];
	nodesByOwner: NamedCount[];
	newestNodes: unknown[];
	projects: ProjectItem[];
	addressesByCity: NamedCount[];
	addressesByStatus: NamedCount[];
	unitsByCity: NamedCount[];
	unitsByType: NamedCount[];
	totalAddresses: number;
	totalUnits: number;
	conduitLengthByType: LabeledValue[];
	conduitLengthByStatusType: LabeledValue[];
	conduitLengthByNetworkLevel: LabeledValue[];
	conduitAvgLengthByType: LabeledValue[];
	conduitCountByStatus: NamedCount[];
	conduitLengthByOwner: LabeledValue[];
	conduitLengthByManufacturer: LabeledValue[];
	conduitsByMonth: unknown[];
	longestConduits: unknown[];
	areaCount: number;
	totalCoverageKm2: number;
	areasByType: unknown[];
	areaTotalAddresses?: number;
	addressesInAreas: number;
	totalNodes?: number;
	nodesInAreas: number;
	totalResidentialUnits?: number;
	residentialUnitsInAreas: number;
	addressesPerArea: unknown[];
	addressesByAreaType: unknown[];
	nodesPerArea: unknown[];
	nodesByAreaType: unknown[];
	trenchLengthPerArea: unknown[];
	residentialByAreaType: unknown[];
}

interface TrenchStats {
	total_length: number;
	count: number;
	length_by_types: Array<{ bauweise: string; oberfläche: string; gesamt_länge: number }>;
	average_house_connection_length?: number;
	length_with_funding?: number;
	length_with_internal_execution?: number;
	length_by_status?: LabeledValue[];
	length_by_phase?: LabeledValue[];
	longest_routes?: unknown[];
}

interface NodeStats {
	count_by_type: Array<{ node_type: string; count: number }>;
	expiring_warranties?: unknown[];
	count_by_city?: NamedCount[];
	count_by_status?: NamedCount[];
	count_by_network_level?: NamedCount[];
	count_by_owner?: NamedCount[];
	newest_nodes?: unknown[];
}

interface AddressStats {
	count_by_city?: NamedCount[];
	count_by_status?: NamedCount[];
	units_by_city?: NamedCount[];
	units_by_type?: NamedCount[];
	total_addresses?: number;
	total_units?: number;
}

interface ConduitStats {
	length_by_type?: LabeledValue[];
	length_by_status_type?: LabeledValue[];
	length_by_network_level?: LabeledValue[];
	avg_length_by_type?: LabeledValue[];
	count_by_status?: NamedCount[];
	length_by_owner?: LabeledValue[];
	length_by_manufacturer?: LabeledValue[];
	conduits_by_month?: unknown[];
	longest_conduits?: unknown[];
}

interface AreaStats {
	area_count?: number;
	total_coverage_km2?: number;
	areas_by_type?: unknown[];
	total_addresses?: number;
	addresses_in_areas?: number;
	total_nodes?: number;
	nodes_in_areas?: number;
	total_residential_units?: number;
	residential_units_in_areas?: number;
	addresses_per_area?: unknown[];
	addresses_by_area_type?: unknown[];
	nodes_per_area?: unknown[];
	nodes_by_area_type?: unknown[];
	trench_length_per_area?: unknown[];
	residential_by_area_type?: unknown[];
}

interface StatsData {
	trench: TrenchStats;
	node: NodeStats;
	address?: AddressStats;
	conduit?: ConduitStats;
	area?: AreaStats;
}

interface RawProject {
	project: string;
	description: string;
	active: boolean;
}

/**
 * Returns the default empty dashboard data shape.
 * Used as fallback when no project is selected or API calls fail.
 */
export function getDefaultDashboardData(): DashboardData {
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
 */
export function mapStatsToDashboardData(
	statsData: StatsData,
	projectsData: RawProject[]
): DashboardData {
	const { trench, node, address, conduit, area } = statsData;

	return {
		totalLength: trench.total_length,
		count: trench.count,
		lengthByTypes: trench.length_by_types.map((item) => ({
			bauweise: item.bauweise,
			oberfläche: item.oberfläche,
			gesamt_länge: item.gesamt_länge
		})),
		nodesByType: node.count_by_type.map((item) => ({
			node_type: item.node_type,
			count: item.count
		})),
		projects: projectsData.map((item) => ({
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
