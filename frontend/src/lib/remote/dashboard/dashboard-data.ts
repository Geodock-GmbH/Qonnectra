/** Trench length for one construction type / surface combination. */
interface TrenchLengthByType {
	bauweise: string;
	oberfläche: string;
	gesamt_länge: number;
}

/** A node warranty nearing expiry, shown on the dashboard. */
export interface Warranty {
	id: string | number;
	name?: string;
	node_type?: string;
	warranty: string;
	days_until_expiry: number;
}

/** A node as listed in the newest-nodes statistic. */
interface RecentNode {
	name?: string;
	node_type?: string | null;
}

interface NodeTypeCount {
	node_type: string;
	count: number;
}

interface CityCount {
	city: string | null;
	count: number;
}

interface StatusCount {
	status: string | null;
	count: number;
}

interface TypeCount {
	type: string | null;
	count: number;
}

interface NetworkLevelCount {
	network_level: string | null;
	count: number;
}

interface NetworkLevelLength {
	network_level: string | null;
	total: number;
}

interface OwnerCount {
	owner: string | null;
	count: number;
}

interface TrenchStatusLength {
	status_name: string | null;
	gesamt_länge: number;
}

interface TrenchNetworkLevelLength {
	network_level: string | null;
	gesamt_länge: number;
}

interface LongestRoute {
	id_trench: string;
	length: number;
	construction_type_name: string | null;
	surface_name: string | null;
}

interface ConduitTypeLength {
	type_name: string | null;
	total: number;
}

interface ConduitStatusTypeLength {
	status_name: string | null;
	type_name: string | null;
	total: number;
}

interface ConduitTypeAvgLength {
	type_name: string | null;
	avg_length: number;
}

interface ConduitStatusCount {
	status_name: string | null;
	count: number;
}

interface ConduitOwnerLength {
	owner_name: string | null;
	total: number;
}

interface ConduitManufacturerLength {
	manufacturer_name: string | null;
	total: number;
}

interface MonthCount {
	month: string | null;
	count: number;
}

interface LongestConduit {
	name: string;
	type_name: string | null;
	total_length: number;
}

interface AreaTypeSummary {
	type_name: string | null;
	count: number;
	total_area_km2?: number;
}

/** A per-area count (addresses or nodes inside one area). */
interface AreaCount {
	name: string | null;
	count: number;
}

interface AreaTrenchLength {
	name: string | null;
	length_m: number;
}

/** Flat dashboard statistics as rendered by the dashboard tabs. */
export interface DashboardData {
	totalLength: number;
	count: number;
	lengthByTypes: TrenchLengthByType[];
	avgHouseConnectionLength: number;
	lengthWithFunding: number;
	lengthWithInternalExecution: number;
	lengthByStatus: TrenchStatusLength[];
	lengthByNetworkLevel: TrenchNetworkLevelLength[];
	longestRoutes: LongestRoute[];
	expiringWarranties: Warranty[];
	nodesByCity: CityCount[];
	nodesByStatus: StatusCount[];
	nodesByNetworkLevel: NetworkLevelCount[];
	nodesByType: NodeTypeCount[];
	nodesByOwner: OwnerCount[];
	newestNodes: RecentNode[];
	addressesByCity: CityCount[];
	addressesByStatus: StatusCount[];
	unitsByCity: CityCount[];
	unitsByType: TypeCount[];
	totalAddresses: number;
	totalUnits: number;
	conduitLengthByType: ConduitTypeLength[];
	conduitLengthByStatusType: ConduitStatusTypeLength[];
	conduitLengthByNetworkLevel: NetworkLevelLength[];
	conduitAvgLengthByType: ConduitTypeAvgLength[];
	conduitCountByStatus: ConduitStatusCount[];
	conduitLengthByOwner: ConduitOwnerLength[];
	conduitLengthByManufacturer: ConduitManufacturerLength[];
	conduitsByMonth: MonthCount[];
	longestConduits: LongestConduit[];
	areaCount: number;
	totalCoverageKm2: number;
	areasByType: AreaTypeSummary[];
	areaTotalAddresses: number;
	addressesInAreas: number;
	totalNodes: number;
	nodesInAreas: number;
	totalResidentialUnits: number;
	residentialUnitsInAreas: number;
	addressesPerArea: AreaCount[];
	addressesByAreaType: TypeCount[];
	nodesPerArea: AreaCount[];
	nodesByAreaType: TypeCount[];
	trenchLengthPerArea: AreaTrenchLength[];
	residentialByAreaType: TypeCount[];
}

interface TrenchStats {
	total_length: number;
	count: number;
	length_by_types: TrenchLengthByType[];
	average_house_connection_length?: number;
	length_with_funding?: number;
	length_with_internal_execution?: number;
	length_by_status?: TrenchStatusLength[];
	length_by_phase?: TrenchNetworkLevelLength[];
	longest_routes?: LongestRoute[];
}

interface NodeStats {
	count_by_type: NodeTypeCount[];
	expiring_warranties?: Warranty[];
	count_by_city?: CityCount[];
	count_by_status?: StatusCount[];
	count_by_network_level?: NetworkLevelCount[];
	count_by_owner?: OwnerCount[];
	newest_nodes?: RecentNode[];
}

interface AddressStats {
	count_by_city?: CityCount[];
	count_by_status?: StatusCount[];
	units_by_city?: CityCount[];
	units_by_type?: TypeCount[];
	total_addresses?: number;
	total_units?: number;
}

interface ConduitStats {
	length_by_type?: ConduitTypeLength[];
	length_by_status_type?: ConduitStatusTypeLength[];
	length_by_network_level?: NetworkLevelLength[];
	avg_length_by_type?: ConduitTypeAvgLength[];
	count_by_status?: ConduitStatusCount[];
	length_by_owner?: ConduitOwnerLength[];
	length_by_manufacturer?: ConduitManufacturerLength[];
	conduits_by_month?: MonthCount[];
	longest_conduits?: LongestConduit[];
}

interface AreaStats {
	area_count?: number;
	total_coverage_km2?: number;
	areas_by_type?: AreaTypeSummary[];
	total_addresses?: number;
	addresses_in_areas?: number;
	total_nodes?: number;
	nodes_in_areas?: number;
	total_residential_units?: number;
	residential_units_in_areas?: number;
	addresses_per_area?: AreaCount[];
	addresses_by_area_type?: TypeCount[];
	nodes_per_area?: AreaCount[];
	nodes_by_area_type?: TypeCount[];
	trench_length_per_area?: AreaTrenchLength[];
	residential_by_area_type?: TypeCount[];
}

/** Raw body of the backend `dashboard/statistics/` endpoint. */
export interface DashboardStatisticsResponse {
	trench: TrenchStats;
	node: NodeStats;
	address?: AddressStats;
	conduit?: ConduitStats;
	area?: AreaStats;
}

/**
 * Returns the default empty dashboard data shape.
 * Used when no project is selected.
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
		areaTotalAddresses: 0,
		addressesInAreas: 0,
		totalNodes: 0,
		nodesInAreas: 0,
		totalResidentialUnits: 0,
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
 * Maps the raw statistics response to the dashboard view shape.
 * @param statsData - Body of the backend `dashboard/statistics/` endpoint.
 * @returns Flat, fully defaulted dashboard data.
 */
export function mapStatsToDashboardData(statsData: DashboardStatisticsResponse): DashboardData {
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
