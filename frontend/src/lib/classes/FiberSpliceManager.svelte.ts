import type { FiberColor } from '$lib/server/nodeData';
import { deserialize } from '$app/forms';

import { m } from '$lib/paraglide/messages';

import { globalToaster } from '$lib/stores/toaster';
import { logToBackendClient } from '$lib/utils/logToBackendClient';

export interface FiberDetails {
	uuid: string;
	fiber_number: number;
	fiber_color: string;
	bundle_number: number;
	cable_name: string;
	cable_uuid?: string;
	[key: string]: unknown;
}

export interface ResidentialUnitDetails {
	uuid: string;
	id_residential_unit: number | string;
	display_name: string;
	resident_name?: string | null;
	external_id_1?: string | null;
	external_id_2?: string | null;
	floor?: number | string | null;
	side?: string | null;
	[key: string]: unknown;
}

interface MergeGroupInfo {
	port_numbers: number[];
	port_count: number;
}

interface FiberSplice {
	uuid: string;
	port_number: number;
	fiber_a_details: FiberDetails | null;
	fiber_b_details: FiberDetails | null;
	residential_unit_a_details: ResidentialUnitDetails | null;
	residential_unit_b_details: ResidentialUnitDetails | null;
	merge_group_a: string | null;
	merge_group_b: string | null;
	merge_group_a_info: MergeGroupInfo | null;
	merge_group_b_info: MergeGroupInfo | null;
	[key: string]: unknown;
}

interface ComponentPort {
	id: number;
	port: number;
	in_or_out: 'in' | 'out';
}

interface NodeStructure {
	uuid: string;
	component_type: { id: number; component_type?: string } | null;
	slot_start: number;
	label?: string;
	[key: string]: unknown;
}

interface PortRow {
	portNumber: number;
	hasInPort: boolean;
	hasOutPort: boolean;
	splice: FiberSplice | undefined;
	fiberA: FiberDetails | null;
	fiberB: FiberDetails | null;
	residentialUnitA: ResidentialUnitDetails | null;
	residentialUnitB: ResidentialUnitDetails | null;
	mergeGroupA: string | null;
	mergeGroupB: string | null;
	mergeGroupAInfo: MergeGroupInfo | null;
	mergeGroupBInfo: MergeGroupInfo | null;
}

interface MergeInfo {
	groupId: string;
	isFirstInGroup: boolean;
	groupSize: number;
	portRange: string;
	fibers: FiberDetails[];
	fiberCount: number;
}

export type PortRowWithMerge = PortRow & {
	mergeInfoA: MergeInfo | null;
	mergeInfoB: MergeInfo | null;
};

interface FiberDropData {
	type: 'fiber';
	uuid: string;
	fiber_number: number;
	fiber_color: string;
	bundle_number: number;
	cable_name: string;
	cable_uuid: string;
	isMove?: boolean;
	sourcePortNumber?: number;
	sourceSide?: 'a' | 'b';
}

interface BundleFiber {
	uuid: string;
	fiber_number_absolute: number;
	fiber_color: string;
	bundle_number: number;
}

interface BundleDropData {
	type: 'bundle';
	fibers: BundleFiber[];
	cable_uuid: string;
	cable_name: string;
}

interface CableDropData {
	type: 'cable';
	uuid: string;
	fibers: BundleFiber[];
	cable_uuid?: string;
}

interface ResidentialUnitDropData {
	type: 'residential_unit';
	uuid: string;
	id_residential_unit: number;
	display_name: string;
}

interface AddressResidentialUnit {
	uuid: string;
	id_residential_unit: number;
	display_name: string;
}

interface AddressDropData {
	type: 'address';
	residential_units: AddressResidentialUnit[];
}

type DropData =
	| FiberDropData
	| BundleDropData
	| CableDropData
	| ResidentialUnitDropData
	| AddressDropData;

interface ActionSuccessData {
	error?: string;
	ports?: ComponentPort[];
	splices?: FiberSplice[];
	splice?: FiberSplice;
	fiberColors?: FiberColor[];
	fibers?: BundleFiber[];
	created?: FiberSplice[];
	failed?: unknown[];
}

type Side = 'a' | 'b';

/**
 * Manager for fiber splice operations and component port management.
 * Handles fiber-to-port connections and disconnections.
 */
export class FiberSpliceManager {
	selectedStructure: NodeStructure | null = $state(null);

	componentPorts: ComponentPort[] = $state([]);

	fiberSplices: FiberSplice[] = $state([]);

	fiberColors: FiberColor[] = $state([]);

	loadingPorts: boolean = $state(false);

	/** Whether a bulk operation (cable/bundle drop) is in progress */
	bulkOperationInProgress: boolean = $state(false);

	/** Currently selected port keys for merging (format: "portNumber-side") */
	selectedForMerge: Set<string> = $state(new Set());

	/** Whether merge selection mode is active */
	mergeSelectionMode: boolean = $state(false);

	/** Currently selected side for merging */
	mergeSide: Side = $state('a');

	/**
	 * Builds port rows by combining component port definitions with splice data
	 * for rendering the port table.
	 */
	get portRows(): PortRow[] {
		if (!this.componentPorts.length) return [];

		const inPorts = this.componentPorts.filter((p) => p.in_or_out === 'in');
		const outPorts = this.componentPorts.filter((p) => p.in_or_out === 'out');

		const maxInPort = inPorts.length > 0 ? Math.max(...inPorts.map((p) => p.port)) : 0;
		const maxOutPort = outPorts.length > 0 ? Math.max(...outPorts.map((p) => p.port)) : 0;
		const maxPort = Math.max(maxInPort, maxOutPort);

		const rows: PortRow[] = [];
		for (let port = 1; port <= maxPort; port++) {
			const hasInPort = inPorts.some((p) => p.port === port);
			const hasOutPort = outPorts.some((p) => p.port === port);
			const splice = this.fiberSplices.find((s) => s.port_number === port);

			rows.push({
				portNumber: port,
				hasInPort,
				hasOutPort,
				splice,
				fiberA: (splice?.fiber_a_details as FiberDetails | null) || null,
				fiberB: (splice?.fiber_b_details as FiberDetails | null) || null,
				residentialUnitA:
					(splice?.residential_unit_a_details as ResidentialUnitDetails | null) || null,
				residentialUnitB:
					(splice?.residential_unit_b_details as ResidentialUnitDetails | null) || null,
				mergeGroupA: (splice?.merge_group_a as string | null) || null,
				mergeGroupB: (splice?.merge_group_b as string | null) || null,
				mergeGroupAInfo: (splice?.merge_group_a_info as MergeGroupInfo | null) || null,
				mergeGroupBInfo: (splice?.merge_group_b_info as MergeGroupInfo | null) || null
			});
		}
		return rows;
	}

	/**
	 * Get port rows with merge group annotations per side (for spanning cell display).
	 * All rows are kept - no collapsing. Each row has mergeInfoA and mergeInfoB.
	 */
	get portRowsWithMerge(): PortRowWithMerge[] {
		const baseRows = this.portRows;
		if (baseRows.length === 0) return [];

		const mergeGroupsA = new Map<string, number[]>();
		const mergeGroupsB = new Map<string, number[]>();

		for (const splice of this.fiberSplices) {
			if (splice.merge_group_a) {
				if (!mergeGroupsA.has(splice.merge_group_a)) {
					mergeGroupsA.set(splice.merge_group_a, []);
				}
				mergeGroupsA.get(splice.merge_group_a)!.push(splice.port_number);
			}
			if (splice.merge_group_b) {
				if (!mergeGroupsB.has(splice.merge_group_b)) {
					mergeGroupsB.set(splice.merge_group_b, []);
				}
				mergeGroupsB.get(splice.merge_group_b)!.push(splice.port_number);
			}
		}

		for (const ports of mergeGroupsA.values()) ports.sort((a, b) => a - b);
		for (const ports of mergeGroupsB.values()) ports.sort((a, b) => a - b);

		/**
		 * Get fiber(s) for a merge group on a specific side
		 */
		const getFibersForGroup = (groupId: string, side: Side): FiberDetails[] => {
			const mergeGroupField = side === 'a' ? 'merge_group_a' : 'merge_group_b';
			const fiberKey = side === 'a' ? 'fiber_a_details' : 'fiber_b_details';

			const fibersWithData = this.fiberSplices
				.filter((s) => s[mergeGroupField] === groupId && s[fiberKey] != null)
				.map((s) => s[fiberKey] as FiberDetails);

			if (fibersWithData.length > 0) {
				return [fibersWithData[0]];
			}

			return fibersWithData;
		};

		const buildMergeInfo = (
			portNumber: number,
			side: Side,
			groupMap: Map<string, number[]>
		): MergeInfo | null => {
			const mergeGroupField = side === 'a' ? 'merge_group_a' : 'merge_group_b';

			const splice = this.fiberSplices.find(
				(s) => s.port_number === portNumber && s[mergeGroupField]
			);
			if (!splice?.[mergeGroupField]) return null;

			const groupId = splice[mergeGroupField] as string;
			const ports = groupMap.get(groupId);
			if (!ports) return null;

			const isFirst = ports[0] === portNumber;
			const fibers = getFibersForGroup(groupId, side);

			const firstPort = ports[0];
			const lastPort = ports[ports.length - 1];

			return {
				groupId: groupId,
				isFirstInGroup: isFirst,
				groupSize: ports.length,
				portRange: `${firstPort}-${lastPort}`,
				fibers,
				fiberCount: fibers.length
			};
		};

		return baseRows.map((row) => ({
			...row,
			mergeInfoA: buildMergeInfo(row.portNumber, 'a', mergeGroupsA),
			mergeInfoB: buildMergeInfo(row.portNumber, 'b', mergeGroupsB)
		}));
	}

	/**
	 * Selects a structure and loads its ports and splices, or deselects if already selected.
	 * Blocks switching while a bulk operation is in progress.
	 * @param structure
	 * @param isMobile - Whether mobile mode is active
	 * @returns True if structure was selected, false if deselected or blocked
	 */
	async selectStructure(
		structure: NodeStructure | null,
		isMobile: boolean = false
	): Promise<boolean> {
		if (this.bulkOperationInProgress) {
			globalToaster.warning({
				title: m.common_warning?.() || 'Warning',
				description:
					m.message_operation_in_progress?.() || 'Please wait for the current operation to complete'
			});
			return false;
		}

		if (this.selectedStructure?.uuid === structure?.uuid) {
			this.selectedStructure = null;
			this.componentPorts = [];
			this.fiberSplices = [];
			return false;
		}

		this.selectedStructure = structure;
		if (!structure?.component_type?.id) {
			this.componentPorts = [];
			this.fiberSplices = [];
			return true;
		}

		this.loadingPorts = true;
		try {
			await Promise.all([
				this.fetchComponentPorts(structure.component_type.id),
				this.fetchFiberSplices(structure.uuid),
				this.fetchFiberColorsIfNeeded()
			]);
		} finally {
			this.loadingPorts = false;
		}

		return true;
	}

	/**
	 * Fetches component port definitions for a given component type from the server.
	 */
	async fetchComponentPorts(componentTypeId: number): Promise<void> {
		try {
			const formData = new FormData();
			formData.append('componentTypeId', componentTypeId.toString());

			const response = await fetch('?/getComponentPorts', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(
					(result as { data?: ActionSuccessData }).data?.error || 'Failed to fetch component ports'
				);
			}

			this.componentPorts = (result as { data?: ActionSuccessData }).data?.ports || [];
		} catch (err: unknown) {
			console.error('Error fetching component ports:', err);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error fetching component ports',
				extraData: {
					from: 'FiberSpliceManager.fetchComponentPorts',
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
			this.componentPorts = [];
		}
	}

	/**
	 * Fetches existing fiber splice connections for a node structure from the server.
	 */
	async fetchFiberSplices(nodeStructureUuid: string): Promise<void> {
		try {
			const formData = new FormData();
			formData.append('nodeStructureUuid', nodeStructureUuid);

			const response = await fetch('?/getFiberSplices', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(
					(result as { data?: ActionSuccessData }).data?.error || 'Failed to fetch fiber splices'
				);
			}

			this.fiberSplices = (result as { data?: ActionSuccessData }).data?.splices || [];
		} catch (err: unknown) {
			console.error('Error fetching fiber splices:', err);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error fetching fiber splices',
				extraData: {
					from: 'FiberSpliceManager.fetchFiberSplices',
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
			this.fiberSplices = [];
		}
	}

	/**
	 * Fetches the fiber color palette from the server. Only fetches once per manager lifetime.
	 */
	async fetchFiberColorsIfNeeded(): Promise<void> {
		if (this.fiberColors.length > 0) return;

		try {
			const response = await fetch('?/getFiberColors', {
				method: 'POST',
				body: new FormData()
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(
					(result as { data?: ActionSuccessData }).data?.error || 'Failed to fetch fiber colors'
				);
			}

			this.fiberColors = (result as { data?: ActionSuccessData }).data?.fiberColors || [];
		} catch (err: unknown) {
			console.error('Error fetching fiber colors:', err);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error fetching fiber colors',
				extraData: {
					from: 'FiberSpliceManager.fetchFiberColorsIfNeeded',
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
		}
	}

	/**
	 * Routes a port drop event to the appropriate handler based on the drop data type.
	 * @param portNumber - Starting port number
	 * @param side
	 * @param dropData
	 * @param allStructures - All structures for multi-component cable drop
	 * @returns True if any connections were created
	 */
	async handlePortDrop(
		portNumber: number,
		side: Side,
		dropData: DropData,
		allStructures: NodeStructure[] = []
	): Promise<boolean> {
		if (dropData.type === 'fiber') {
			if (dropData.isMove && dropData.sourcePortNumber && dropData.sourceSide) {
				return this.handleFiberMove(
					dropData.sourcePortNumber,
					dropData.sourceSide,
					portNumber,
					side,
					dropData
				);
			}
			return this.handleSingleFiberDrop(portNumber, side, dropData);
		} else if (dropData.type === 'bundle') {
			return this.handleBundleDrop(portNumber, side, dropData);
		} else if (dropData.type === 'cable') {
			return this.handleCableDrop(portNumber, side, dropData, allStructures);
		} else if (dropData.type === 'residential_unit') {
			return this.handleResidentialUnitDrop(portNumber, side, dropData);
		} else if (dropData.type === 'address') {
			return this.handleAddressDrop(portNumber, side, dropData);
		}

		globalToaster.warning({
			title: m.common_warning?.() || 'Warning',
			description:
				(
					m as unknown as Record<string, (() => string) | undefined>
				).message_unsupported_drop_type?.() || 'Unsupported drop type'
		});
		return false;
	}

	/**
	 * Moves a fiber from one port/side to another by placing it at the target and clearing the source.
	 * No-op if source and target are the same cell.
	 * @param sourcePort - Source port number
	 * @param sourceSide - Source side
	 * @param targetPort - Target port number
	 * @param targetSide - Target side
	 * @param fiberData - Fiber data
	 * @returns True if successful
	 */
	async handleFiberMove(
		sourcePort: number,
		sourceSide: Side,
		targetPort: number,
		targetSide: Side,
		fiberData: FiberDropData
	): Promise<boolean> {
		if (sourcePort === targetPort && sourceSide === targetSide) {
			return false;
		}

		const success = await this.handleSingleFiberDrop(targetPort, targetSide, fiberData);

		if (success) {
			await this.handleClearPort(sourcePort, sourceSide);
		}

		return success;
	}

	/**
	 * Returns consecutive unoccupied port numbers on a given side, starting from startPort.
	 * Stops at the first occupied port.
	 */
	getAvailablePorts(side: Side, startPort: number): number[] {
		const portType = side === 'a' ? 'in' : 'out';
		const portsOnSide = this.componentPorts
			.filter((p) => p.in_or_out === portType)
			.map((p) => p.port)
			.sort((a, b) => a - b);

		const maxPort = portsOnSide.length > 0 ? Math.max(...portsOnSide) : 0;
		const available: number[] = [];

		for (let port = startPort; port <= maxPort; port++) {
			if (!portsOnSide.includes(port)) continue;

			const existingSplice = this.fiberSplices.find((s) => s.port_number === port);
			if (existingSplice?.[`fiber_${side}_details`]) {
				break;
			}

			available.push(port);
		}

		return available;
	}

	/**
	 * Connects a single fiber to a port with optimistic UI update and server persistence.
	 * Handles both merged and non-merged ports.
	 * @param portNumber
	 * @param side
	 * @param fiberData
	 * @returns True if successful
	 */
	async handleSingleFiberDrop(
		portNumber: number,
		side: Side,
		fiberData: FiberDropData
	): Promise<boolean> {
		const previousSplices = [...this.fiberSplices];
		const existingSplice = this.fiberSplices.find((s) => s.port_number === portNumber);

		const mergeGroupField = `merge_group_${side}`;
		const mergeGroupValue = existingSplice?.[mergeGroupField];
		const isMergedOnThisSide = mergeGroupValue != null;

		const fiberDetails: FiberDetails = {
			uuid: fiberData.uuid,
			fiber_number: fiberData.fiber_number,
			fiber_color: fiberData.fiber_color,
			bundle_number: fiberData.bundle_number,
			cable_name: fiberData.cable_name
		};

		if (isMergedOnThisSide) {
			this.fiberSplices = this.fiberSplices.map((s) => {
				if (s[mergeGroupField] === mergeGroupValue) {
					return {
						...s,
						[`fiber_${side}_details`]: fiberDetails
					};
				}
				return s;
			});
		} else if (existingSplice) {
			this.fiberSplices = this.fiberSplices.map((s) => {
				if (s.port_number === portNumber) {
					return {
						...s,
						[`fiber_${side}_details`]: fiberDetails
					};
				}
				return s;
			});
		} else {
			const newSplice: FiberSplice = {
				uuid: `temp-${Date.now()}`,
				port_number: portNumber,
				fiber_a_details: side === 'a' ? fiberDetails : null,
				fiber_b_details: side === 'b' ? fiberDetails : null,
				residential_unit_a_details: null,
				residential_unit_b_details: null,
				merge_group_a: null,
				merge_group_b: null,
				merge_group_a_info: null,
				merge_group_b_info: null
			};
			this.fiberSplices = [...this.fiberSplices, newSplice];
		}

		try {
			const formData = new FormData();
			formData.append('nodeStructureUuid', this.selectedStructure!.uuid);
			formData.append('portNumber', portNumber.toString());
			formData.append('side', side);
			formData.append('fiberUuid', fiberData.uuid);
			formData.append('cableUuid', fiberData.cable_uuid);

			const response = await fetch('?/upsertFiberSplice', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(
					(result as { data?: ActionSuccessData }).data?.error || 'Failed to save fiber splice'
				);
			}

			if (isMergedOnThisSide) {
				await this.fetchFiberSplices(this.selectedStructure!.uuid);
			} else {
				const serverSplice = (result as { data?: ActionSuccessData }).data!.splice!;
				this.fiberSplices = this.fiberSplices.map((s) =>
					s.port_number === portNumber ? serverSplice : s
				);
			}

			globalToaster.success({
				title: m.title_success(),
				description: isMergedOnThisSide
					? m.message_shared_fiber_connected?.() || 'Shared fiber connected to merge group'
					: m.message_fiber_connected?.() || 'Fiber connected successfully'
			});

			this.#dispatchFiberSpliceChanged();

			return true;
		} catch (err: unknown) {
			console.error('Error saving fiber splice:', err);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error saving fiber splice',
				extraData: {
					from: 'FiberSpliceManager.handleSingleFiberDrop',
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
			this.fiberSplices = previousSplices;
			globalToaster.error({
				title: m.common_error(),
				description:
					(err as Error).message ||
					m.message_error_connecting_fiber?.() ||
					'Failed to connect fiber'
			});
			return false;
		}
	}

	/**
	 * Connects a bundle of fibers to sequential ports using the bulk API.
	 * @param startPort - Starting port number
	 * @param side
	 * @param bundleData - Bundle data including fibers array
	 * @returns True if any fibers were connected
	 */
	async handleBundleDrop(
		startPort: number,
		side: Side,
		bundleData: BundleDropData
	): Promise<boolean> {
		const fibers = bundleData.fibers || [];
		if (fibers.length === 0) {
			globalToaster.warning({
				title: m.common_warning?.() || 'Warning',
				description:
					(m as unknown as Record<string, (() => string) | undefined>).message_bundle_empty?.() ||
					'Bundle contains no fibers'
			});
			return false;
		}

		const sortedFibers = [...fibers].sort(
			(a, b) => a.fiber_number_absolute - b.fiber_number_absolute
		);

		const availablePorts = this.getAvailablePorts(side, startPort);

		if (availablePorts.length === 0) {
			globalToaster.warning({
				title: m.common_warning?.() || 'Warning',
				description:
					(
						m as unknown as Record<string, (() => string) | undefined>
					).message_no_available_ports?.() || 'No available ports'
			});
			return false;
		}

		this.bulkOperationInProgress = true;
		const previousSplices = [...this.fiberSplices];

		const spliceData: {
			node_structure_uuid: string;
			port_number: number;
			side: string;
			fiber_uuid: string;
			cable_uuid: string;
		}[] = [];
		const optimisticUpdates: { portNumber: number; fiberDetails: FiberDetails }[] = [];

		for (let i = 0; i < Math.min(sortedFibers.length, availablePorts.length); i++) {
			const fiber = sortedFibers[i];
			const portNumber = availablePorts[i];

			spliceData.push({
				node_structure_uuid: this.selectedStructure!.uuid,
				port_number: portNumber,
				side: side,
				fiber_uuid: fiber.uuid,
				cable_uuid: bundleData.cable_uuid
			});

			const fiberDetails: FiberDetails = {
				uuid: fiber.uuid,
				fiber_number: fiber.fiber_number_absolute,
				fiber_color: fiber.fiber_color,
				bundle_number: fiber.bundle_number,
				cable_name: bundleData.cable_name
			};
			optimisticUpdates.push({ portNumber, fiberDetails });
		}

		for (const { portNumber, fiberDetails } of optimisticUpdates) {
			const existingSplice = this.fiberSplices.find((s) => s.port_number === portNumber);
			if (existingSplice) {
				this.fiberSplices = this.fiberSplices.map((s) => {
					if (s.port_number === portNumber) {
						return { ...s, [`fiber_${side}_details`]: fiberDetails };
					}
					return s;
				});
			} else {
				this.fiberSplices = [
					...this.fiberSplices,
					{
						uuid: `temp-${Date.now()}-${portNumber}`,
						port_number: portNumber,
						fiber_a_details: side === 'a' ? fiberDetails : null,
						fiber_b_details: side === 'b' ? fiberDetails : null,
						residential_unit_a_details: null,
						residential_unit_b_details: null,
						merge_group_a: null,
						merge_group_b: null,
						merge_group_a_info: null,
						merge_group_b_info: null
					}
				];
			}
		}

		try {
			const formData = new FormData();
			formData.append('splices', JSON.stringify(spliceData));

			const response = await fetch('?/bulkUpsertFiberSplices', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(
					(result as { data?: ActionSuccessData }).data?.error || 'Failed to save fiber splices'
				);
			}

			const resultData = (result as { data?: ActionSuccessData }).data;
			const created: FiberSplice[] = resultData?.created || [];
			const failed: unknown[] = resultData?.failed || [];

			this.fiberSplices = this.fiberSplices
				.filter((s) => !s.uuid?.toString().startsWith('temp-'))
				.concat(created);

			this.bulkOperationInProgress = false;

			if (failed.length === 0) {
				globalToaster.success({
					title: m.title_success(),
					description: m.message_bundle_connected({ count: created.length })
				});
			} else if (created.length > 0) {
				globalToaster.warning({
					title: m.common_warning(),
					description: m.message_partial_bundle_connected({
						connected: created.length,
						total: spliceData.length
					})
				});
			} else {
				throw new Error('All placements failed');
			}

			if (created.length > 0) {
				this.#dispatchFiberSpliceChanged();
			}

			return created.length > 0;
		} catch (err: unknown) {
			console.error('Error saving fiber splices:', err);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error saving fiber splices',
				extraData: {
					from: 'FiberSpliceManager.handleBundleDrop',
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
			this.fiberSplices = previousSplices;
			this.bulkOperationInProgress = false;
			globalToaster.error({
				title: m.common_error(),
				description:
					(err as Error).message ||
					m.message_error_connecting_fiber?.() ||
					'Failed to connect fibers'
			});
			return false;
		}
	}

	/**
	 * Fetches fiber data for a cable from the server.
	 */
	async #fetchFibersForCable(cableUuid: string): Promise<BundleFiber[]> {
		try {
			const formData = new FormData();
			formData.append('cableUuid', cableUuid);

			const response = await fetch('?/getFibersForCable', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(
					(result as { data?: ActionSuccessData }).data?.error || 'Failed to fetch fibers'
				);
			}

			return (result as { data?: ActionSuccessData }).data?.fibers || [];
		} catch (err: unknown) {
			console.error('Error fetching fibers for cable:', err);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error fetching fibers for cable',
				extraData: {
					from: 'FiberSpliceManager.#fetchFibersForCable',
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
			return [];
		}
	}

	/**
	 * Connects all fibers from a cable to sequential ports, continuing across
	 * subsequent components in slot order if fibers remain. Uses bulk API per structure.
	 * @param startPort - Starting port number
	 * @param side
	 * @param cableData - Cable data including fibers array
	 * @param allStructures - All structures in slot grid for multi-component mode
	 * @returns True if any fibers were connected
	 */
	async handleCableDrop(
		startPort: number,
		side: Side,
		cableData: CableDropData,
		allStructures: NodeStructure[] = []
	): Promise<boolean> {
		let fibers = cableData.fibers || [];

		if (fibers.length === 0 && cableData.uuid) {
			globalToaster.info({
				title: m.common_loading?.() || 'Loading',
				description: m.message_loading_fibers?.() || 'Loading fibers...'
			});

			fibers = await this.#fetchFibersForCable(cableData.uuid);
		}

		if (fibers.length === 0) {
			globalToaster.warning({
				title: m.common_warning?.() || 'Warning',
				description: m.message_cable_no_fibers?.() || 'Cable has no fibers'
			});
			return false;
		}

		this.bulkOperationInProgress = true;

		const sortedFibers = [...fibers].sort((a, b) => {
			if (a.bundle_number !== b.bundle_number) {
				return a.bundle_number - b.bundle_number;
			}
			return a.fiber_number_absolute - b.fiber_number_absolute;
		});

		const sortedStructures = [...allStructures]
			.filter((s) => s.component_type?.id)
			.sort((a, b) => a.slot_start - b.slot_start);

		const currentStructureIndex = sortedStructures.findIndex(
			(s) => s.uuid === this.selectedStructure?.uuid
		);

		const structuresToFill: NodeStructure[] =
			currentStructureIndex >= 0 ? sortedStructures.slice(currentStructureIndex) : [];

		if (structuresToFill.length === 0 && this.selectedStructure) {
			structuresToFill.push(this.selectedStructure);
		}

		let totalSuccessCount = 0;
		let fiberIndex = 0;
		let errorOccurred = false;
		const componentsUsed: string[] = [];

		for (const structure of structuresToFill) {
			if (fiberIndex >= sortedFibers.length) break;
			let ports: ComponentPort[] = [];
			let splices: FiberSplice[] = [];

			if (structure.uuid === this.selectedStructure?.uuid) {
				ports = this.componentPorts;
				splices = this.fiberSplices;
			} else {
				try {
					const portsResult = await this.#fetchPortsForStructure(structure.component_type!.id);
					const splicesResult = await this.#fetchSplicessForStructure(structure.uuid);
					ports = portsResult;
					splices = splicesResult;
				} catch (err: unknown) {
					console.error('Error fetching ports for structure:', err);
					void logToBackendClient({
						level: 'ERROR',
						message: 'Error fetching ports for structure',
						extraData: {
							from: 'FiberSpliceManager.handleCableDrop',
							error: err instanceof Error ? err.message : String(err),
							stack: err instanceof Error ? err.stack : undefined
						}
					});
					continue;
				}
			}

			const availablePorts = this.#getAvailablePortsForStructure(
				ports,
				splices,
				side,
				structure.uuid === this.selectedStructure?.uuid ? startPort : 1
			);

			if (availablePorts.length === 0) continue;

			const spliceData: {
				node_structure_uuid: string;
				port_number: number;
				side: string;
				fiber_uuid: string;
				cable_uuid: string;
			}[] = [];
			const processedMergeGroups = new Set<string>();

			for (const portNumber of availablePorts) {
				if (fiberIndex >= sortedFibers.length) break;

				const mergeGroupField = `merge_group_${side}`;
				const existingSplice = splices.find((s) => s.port_number === portNumber);
				const mergeGroupId = existingSplice?.[mergeGroupField] as string | undefined;

				if (mergeGroupId && processedMergeGroups.has(mergeGroupId)) {
					continue;
				}

				const fiber = sortedFibers[fiberIndex];

				spliceData.push({
					node_structure_uuid: structure.uuid,
					port_number: portNumber,
					side: side,
					fiber_uuid: fiber.uuid,
					cable_uuid: cableData.uuid
				});

				if (mergeGroupId) {
					processedMergeGroups.add(mergeGroupId);
				}

				fiberIndex++;
			}

			if (spliceData.length === 0) continue;

			try {
				const formData = new FormData();
				formData.append('splices', JSON.stringify(spliceData));

				const response = await fetch('?/bulkUpsertFiberSplices', {
					method: 'POST',
					body: formData
				});

				const result = deserialize(await response.text());

				if (result.type === 'failure' || result.type === 'error') {
					throw new Error(
						(result as { data?: ActionSuccessData }).data?.error || 'Failed to save fiber splices'
					);
				}

				const resultData = (result as { data?: ActionSuccessData }).data;
				const created: FiberSplice[] = resultData?.created || [];

				if (structure.uuid === this.selectedStructure?.uuid) {
					for (const serverSplice of created) {
						const existingIndex = this.fiberSplices.findIndex(
							(s) => s.port_number === serverSplice.port_number
						);
						if (existingIndex >= 0) {
							this.fiberSplices = this.fiberSplices.map((s) =>
								s.port_number === serverSplice.port_number ? serverSplice : s
							);
						} else {
							this.fiberSplices = [...this.fiberSplices, serverSplice];
						}
					}
				}

				totalSuccessCount += created.length;

				if (created.length > 0) {
					componentsUsed.push(structure.component_type?.component_type || structure.label || '-');
				}
			} catch (err: unknown) {
				console.error('Error saving fiber splices for structure:', err);
				void logToBackendClient({
					level: 'ERROR',
					message: 'Error saving fiber splices for structure',
					extraData: {
						from: 'FiberSpliceManager.handleCableDrop',
						error: err instanceof Error ? err.message : String(err),
						stack: err instanceof Error ? err.stack : undefined
					}
				});
				errorOccurred = true;
				break;
			}
		}

		if (errorOccurred && totalSuccessCount === 0) {
			this.bulkOperationInProgress = false;
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_connecting_fiber?.() || 'Failed to connect fibers'
			});
			return false;
		}

		const totalFibers = sortedFibers.length;
		const componentInfo =
			componentsUsed.length > 1
				? ` ${m.message_component_count({ count: componentsUsed.length })}`
				: '';

		if (totalSuccessCount === totalFibers) {
			globalToaster.success({
				title: m.title_success(),
				description: `${m.message_cable_connected({ count: totalSuccessCount })}${componentInfo}`
			});
		} else {
			globalToaster.info({
				title: m.common_info(),
				description: `${m.message_partial_cable_connected({
					connected: totalSuccessCount,
					total: totalFibers
				})}${componentInfo}`
			});
		}

		if (totalSuccessCount > 0) {
			this.#dispatchFiberSpliceChanged();
		}

		this.bulkOperationInProgress = false;
		return totalSuccessCount > 0;
	}

	/**
	 * Connects a single residential unit to a port with optimistic UI update.
	 */
	async handleResidentialUnitDrop(
		portNumber: number,
		side: Side,
		unitData: ResidentialUnitDropData
	): Promise<boolean> {
		const previousSplices = [...this.fiberSplices];
		const existingSplice = this.fiberSplices.find((s) => s.port_number === portNumber);

		const unitDetails: ResidentialUnitDetails = {
			uuid: unitData.uuid,
			id_residential_unit: unitData.id_residential_unit,
			display_name: unitData.display_name
		};

		if (existingSplice) {
			this.fiberSplices = this.fiberSplices.map((s) => {
				if (s.port_number === portNumber) {
					return {
						...s,
						[`residential_unit_${side}_details`]: unitDetails
					};
				}
				return s;
			});
		} else {
			const newSplice: FiberSplice = {
				uuid: `temp-${Date.now()}`,
				port_number: portNumber,
				residential_unit_a_details: side === 'a' ? unitDetails : null,
				residential_unit_b_details: side === 'b' ? unitDetails : null,
				fiber_a_details: null,
				fiber_b_details: null,
				merge_group_a: null,
				merge_group_b: null,
				merge_group_a_info: null,
				merge_group_b_info: null
			};
			this.fiberSplices = [...this.fiberSplices, newSplice];
		}

		try {
			const formData = new FormData();
			formData.append('nodeStructureUuid', this.selectedStructure!.uuid);
			formData.append('portNumber', portNumber.toString());
			formData.append('side', side);
			formData.append('residentialUnitUuid', unitData.uuid);

			const response = await fetch('?/upsertFiberSplice', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(
					(result as { data?: ActionSuccessData }).data?.error || 'Failed to save connection'
				);
			}

			const serverSplice = (result as { data?: ActionSuccessData }).data!.splice!;
			this.fiberSplices = this.fiberSplices.map((s) =>
				s.port_number === portNumber ? serverSplice : s
			);

			globalToaster.success({
				title: m.title_success(),
				description: m.message_residential_unit_connected?.() || 'Residential unit connected'
			});

			this.#dispatchResidentialUnitSpliceChanged();
			return true;
		} catch (err: unknown) {
			console.error('Error saving residential unit connection:', err);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error saving residential unit connection',
				extraData: {
					from: 'FiberSpliceManager.handleResidentialUnitDrop',
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
			this.fiberSplices = previousSplices;
			globalToaster.error({
				title: m.common_error(),
				description: (err as Error).message || 'Failed to connect residential unit'
			});
			return false;
		}
	}

	/**
	 * Connects all residential units from an address to sequential ports using bulk API.
	 * @param startPort - Starting port number
	 * @param side
	 * @param addressData - Address data including residential_units array
	 * @returns True if any units were connected
	 */
	async handleAddressDrop(
		startPort: number,
		side: Side,
		addressData: AddressDropData
	): Promise<boolean> {
		const units = addressData.residential_units || [];
		if (units.length === 0) {
			globalToaster.warning({
				title: m.common_warning?.() || 'Warning',
				description: m.message_address_no_units?.() || 'Address has no residential units'
			});
			return false;
		}

		const sortedUnits = [...units].sort(
			(a, b) => (a.id_residential_unit || 0) - (b.id_residential_unit || 0)
		);

		const availablePorts = this.getAvailablePorts(side, startPort);

		if (availablePorts.length === 0) {
			globalToaster.warning({
				title: m.common_warning?.() || 'Warning',
				description:
					(
						m as unknown as Record<string, (() => string) | undefined>
					).message_no_available_ports?.() || 'No available ports'
			});
			return false;
		}

		this.bulkOperationInProgress = true;
		const previousSplices = [...this.fiberSplices];

		const spliceData: {
			node_structure_uuid: string;
			port_number: number;
			side: string;
			residential_unit_uuid: string;
		}[] = [];

		for (let i = 0; i < Math.min(sortedUnits.length, availablePorts.length); i++) {
			const unit = sortedUnits[i];
			const portNumber = availablePorts[i];

			spliceData.push({
				node_structure_uuid: this.selectedStructure!.uuid,
				port_number: portNumber,
				side: side,
				residential_unit_uuid: unit.uuid
			});
		}

		try {
			const formData = new FormData();
			formData.append('splices', JSON.stringify(spliceData));

			const response = await fetch('?/bulkUpsertFiberSplices', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(
					(result as { data?: ActionSuccessData }).data?.error || 'Failed to save connections'
				);
			}

			const resultData = (result as { data?: ActionSuccessData }).data;
			const created: FiberSplice[] = resultData?.created || [];
			const failed: unknown[] = resultData?.failed || [];

			this.fiberSplices = this.fiberSplices
				.filter((s) => !s.uuid?.toString().startsWith('temp-'))
				.concat(created);

			this.bulkOperationInProgress = false;

			if (failed.length === 0) {
				globalToaster.success({
					title: m.title_success(),
					description:
						m.message_address_connected?.({ count: created.length }) ||
						`Connected ${created.length} residential units`
				});
			} else if (created.length > 0) {
				globalToaster.warning({
					title: m.common_warning(),
					description:
						m.message_partial_address_connected?.({
							connected: created.length,
							total: spliceData.length
						}) || `Connected ${created.length} of ${spliceData.length} residential units`
				});
			} else {
				throw new Error('All placements failed');
			}

			if (created.length > 0) {
				this.#dispatchResidentialUnitSpliceChanged();
			}

			return created.length > 0;
		} catch (err: unknown) {
			console.error('Error saving residential unit connections:', err);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error saving residential unit connections',
				extraData: {
					from: 'FiberSpliceManager.handleAddressDrop',
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
			this.fiberSplices = previousSplices;
			this.bulkOperationInProgress = false;
			globalToaster.error({
				title: m.common_error(),
				description: (err as Error).message || 'Failed to connect residential units'
			});
			return false;
		}
	}

	/**
	 * Dispatches a custom event to notify other components that residential unit splices changed.
	 */
	#dispatchResidentialUnitSpliceChanged(): void {
		if (typeof window !== 'undefined') {
			window.dispatchEvent(new CustomEvent('residentialUnitSpliceChanged'));
		}
	}

	/**
	 * Fetches component port definitions for a given component type.
	 */
	async #fetchPortsForStructure(componentTypeId: number): Promise<ComponentPort[]> {
		const formData = new FormData();
		formData.append('componentTypeId', componentTypeId.toString());

		const response = await fetch('?/getComponentPorts', {
			method: 'POST',
			body: formData
		});

		const result = deserialize(await response.text());

		if (result.type === 'failure' || result.type === 'error') {
			throw new Error(
				(result as { data?: ActionSuccessData }).data?.error || 'Failed to fetch component ports'
			);
		}

		return (result as { data?: ActionSuccessData }).data?.ports || [];
	}

	/**
	 * Fetches fiber splice data for a given node structure.
	 */
	async #fetchSplicessForStructure(nodeStructureUuid: string): Promise<FiberSplice[]> {
		const formData = new FormData();
		formData.append('nodeStructureUuid', nodeStructureUuid);

		const response = await fetch('?/getFiberSplices', {
			method: 'POST',
			body: formData
		});

		const result = deserialize(await response.text());

		if (result.type === 'failure' || result.type === 'error') {
			throw new Error(
				(result as { data?: ActionSuccessData }).data?.error || 'Failed to fetch fiber splices'
			);
		}

		return (result as { data?: ActionSuccessData }).data?.splices || [];
	}

	/**
	 * Returns consecutive unoccupied port numbers for a given structure and side.
	 * Stops at the first occupied port.
	 */
	#getAvailablePortsForStructure(
		ports: ComponentPort[],
		splices: FiberSplice[],
		side: Side,
		startPort: number
	): number[] {
		const portType = side === 'a' ? 'in' : 'out';
		const portsOnSide = ports
			.filter((p) => p.in_or_out === portType)
			.map((p) => p.port)
			.sort((a, b) => a - b);

		const maxPort = portsOnSide.length > 0 ? Math.max(...portsOnSide) : 0;
		const available: number[] = [];

		for (let port = startPort; port <= maxPort; port++) {
			if (!portsOnSide.includes(port)) continue;

			const existingSplice = splices.find((s) => s.port_number === port);
			if (existingSplice?.[`fiber_${side}_details`]) {
				break;
			}

			available.push(port);
		}

		return available;
	}

	/**
	 * Clears the fiber or residential unit connection from a port on the given side.
	 * Handles merged ports by clearing all ports in the merge group.
	 */
	async handleClearPort(portNumber: number, side: Side): Promise<void> {
		const previousSplices = [...this.fiberSplices];
		const existingSplice = this.fiberSplices.find((s) => s.port_number === portNumber);

		const hadFiber = !!existingSplice?.[`fiber_${side}_details`];
		const hadResidentialUnit = !!existingSplice?.[`residential_unit_${side}_details`];

		const mergeGroupField = `merge_group_${side}`;
		const mergeGroupValue = existingSplice?.[mergeGroupField];
		const isMergedOnThisSide = mergeGroupValue != null;

		if (isMergedOnThisSide) {
			this.fiberSplices = this.fiberSplices.map((s) => {
				if (s[mergeGroupField] === mergeGroupValue) {
					return {
						...s,
						[`fiber_${side}_details`]: null,
						[`residential_unit_${side}_details`]: null
					};
				}
				return s;
			});
		} else {
			this.fiberSplices = this.fiberSplices
				.map((s) => {
					if (s.port_number === portNumber) {
						const updated = {
							...s,
							[`fiber_${side}_details`]: null,
							[`residential_unit_${side}_details`]: null
						};
						if (
							!updated.fiber_a_details &&
							!updated.fiber_b_details &&
							!updated.residential_unit_a_details &&
							!updated.residential_unit_b_details &&
							!updated.merge_group_a &&
							!updated.merge_group_b
						) {
							return null;
						}
						return updated;
					}
					return s;
				})
				.filter((s): s is FiberSplice => s != null);
		}

		try {
			const formData = new FormData();
			formData.append('nodeStructureUuid', this.selectedStructure!.uuid);
			formData.append('portNumber', portNumber.toString());
			formData.append('side', side);

			const response = await fetch('?/clearFiberSplice', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(
					(result as { data?: ActionSuccessData }).data?.error || 'Failed to clear fiber splice'
				);
			}

			if (isMergedOnThisSide) {
				await this.fetchFiberSplices(this.selectedStructure!.uuid);
			}

			if (hadFiber) {
				this.#dispatchFiberSpliceChanged();
			}
			if (hadResidentialUnit) {
				this.#dispatchResidentialUnitSpliceChanged();
			}
		} catch (err: unknown) {
			console.error('Error clearing fiber splice:', err);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error clearing fiber splice',
				extraData: {
					from: 'FiberSpliceManager.handleClearPort',
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
			this.fiberSplices = previousSplices;
			globalToaster.error({
				title: m.common_error(),
				description: (err as Error).message || 'Failed to clear fiber'
			});
		}
	}

	/**
	 * Deselects the current structure and clears port/splice data.
	 */
	closePortTable(): void {
		this.selectedStructure = null;
		this.componentPorts = [];
		this.fiberSplices = [];
	}

	/**
	 * Clears port table selection if the deleted structure was selected.
	 */
	onStructureDeleted(structureUuid: string): void {
		if (this.selectedStructure?.uuid === structureUuid) {
			this.closePortTable();
		}
	}

	/**
	 * Toggles merge selection mode on/off, clearing selections when deactivating.
	 */
	toggleMergeSelectionMode(): void {
		this.mergeSelectionMode = !this.mergeSelectionMode;
		if (!this.mergeSelectionMode) {
			this.selectedForMerge = new Set();
		}
	}

	/**
	 * Sets the active side for merge selection, clearing selections when the side changes.
	 */
	setMergeSide(side: Side): void {
		if (side !== this.mergeSide) {
			this.mergeSide = side;
			this.selectedForMerge = new Set();
		}
	}

	/**
	 * Toggles a port's selection state for the merge operation.
	 */
	togglePortSelection(portNumber: number, side: Side): void {
		const key = `${portNumber}-${side}`;
		const newSet = new Set(this.selectedForMerge);
		if (newSet.has(key)) {
			newSet.delete(key);
		} else {
			newSet.add(key);
		}
		this.selectedForMerge = newSet;
	}

	/**
	 * Clears all port selections for the merge operation.
	 */
	clearMergeSelection(): void {
		this.selectedForMerge = new Set();
	}

	/**
	 * Merges the currently selected ports into a single group.
	 * Validates that at least 2 consecutive ports on the same side are selected.
	 * @returns True if successful
	 */
	async mergeSelectedPorts(): Promise<boolean> {
		if (this.selectedForMerge.size < 2) {
			globalToaster.warning({
				title: m.common_warning?.() || 'Warning',
				description: m.message_select_at_least_two_ports?.() || 'Select at least 2 ports to merge'
			});
			return false;
		}

		const portNumbers: number[] = [];
		let side: string | null = null;
		for (const key of this.selectedForMerge) {
			const [portNum, portSide] = key.split('-');
			portNumbers.push(parseInt(portNum));
			if (!side) side = portSide;
			else if (side !== portSide) {
				globalToaster.warning({
					title: m.common_warning?.() || 'Warning',
					description:
						m.message_cannot_merge_different_sides?.() || 'Cannot merge ports from different sides'
				});
				return false;
			}
		}

		portNumbers.sort((a, b) => a - b);
		for (let i = 1; i < portNumbers.length; i++) {
			if (portNumbers[i] !== portNumbers[i - 1] + 1) {
				globalToaster.warning({
					title: m.common_warning?.() || 'Warning',
					description:
						(
							m as unknown as Record<string, (() => string) | undefined>
						).message_ports_must_be_consecutive?.() ||
						'Ports must be consecutive (e.g., 1-2-3, not 1-3)'
				});
				return false;
			}
		}

		try {
			const formData = new FormData();
			formData.append('nodeStructureUuid', this.selectedStructure!.uuid);
			formData.append('portNumbers', JSON.stringify(portNumbers));
			formData.append('side', side!);

			const response = await fetch('?/mergePorts', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(
					(result as { data?: ActionSuccessData }).data?.error || 'Failed to merge ports'
				);
			}

			await this.fetchFiberSplices(this.selectedStructure!.uuid);
			this.selectedForMerge = new Set();
			this.mergeSelectionMode = false;

			globalToaster.success({
				title: m.title_success?.() || 'Success',
				description:
					m.message_ports_merged?.({ count: portNumbers.length }) ||
					`Merged ${portNumbers.length} ports`
			});

			return true;
		} catch (err: unknown) {
			console.error('Error merging ports:', err);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error merging ports',
				extraData: {
					from: 'FiberSpliceManager.mergeSelectedPorts',
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
			globalToaster.error({
				title: m.common_error(),
				description: (err as Error).message || 'Failed to merge ports'
			});
			return false;
		}
	}

	/**
	 * Unmerges ports from a merge group, restoring them to individual ports.
	 * @param mergeGroupId
	 * @param portNumbers - Specific ports to unmerge (if empty, unmerges all in group)
	 * @returns True if successful
	 */
	async unmergePorts(mergeGroupId: string, portNumbers: number[] = []): Promise<boolean> {
		if (!mergeGroupId) return false;

		if (portNumbers.length === 0) {
			let groupSplice = this.fiberSplices.find((s) => s.merge_group_a === mergeGroupId);
			if (groupSplice) {
				portNumbers = groupSplice?.merge_group_a_info?.port_numbers || [];
			} else {
				groupSplice = this.fiberSplices.find((s) => s.merge_group_b === mergeGroupId);
				portNumbers = groupSplice?.merge_group_b_info?.port_numbers || [];
			}
		}

		if (portNumbers.length === 0) return false;

		try {
			const formData = new FormData();
			formData.append('mergeGroup', mergeGroupId);
			formData.append('portNumbers', JSON.stringify(portNumbers));

			const response = await fetch('?/unmergePorts', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(
					(result as { data?: ActionSuccessData }).data?.error || 'Failed to unmerge ports'
				);
			}

			await this.fetchFiberSplices(this.selectedStructure!.uuid);

			globalToaster.success({
				title: m.title_success?.() || 'Success',
				description: m.message_ports_unmerged?.() || 'Ports unmerged'
			});

			return true;
		} catch (err: unknown) {
			console.error('Error unmerging ports:', err);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error unmerging ports',
				extraData: {
					from: 'FiberSpliceManager.unmergePorts',
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
			globalToaster.error({
				title: m.common_error(),
				description: (err as Error).message || 'Failed to unmerge ports'
			});
			return false;
		}
	}

	/**
	 * Handles a drop on a merged port group, connecting fibers to all ports in the group.
	 * @param mergeGroupId
	 * @param side
	 * @param dropData
	 * @returns True if successful
	 */
	async handleMergedPortDrop(
		mergeGroupId: string,
		side: Side,
		dropData: DropData
	): Promise<boolean> {
		const mergeGroupField = `merge_group_${side}`;
		const mergeGroupInfoField = `merge_group_${side}_info`;
		const groupSplice = this.fiberSplices.find((s) => s[mergeGroupField] === mergeGroupId);

		if (dropData.type === 'fiber') {
			const mergeGroupInfo = groupSplice?.[mergeGroupInfoField] as MergeGroupInfo | undefined;
			const firstPort = mergeGroupInfo?.port_numbers?.[0];
			if (firstPort) {
				if (dropData.isMove && dropData.sourcePortNumber && dropData.sourceSide) {
					return this.handleFiberMove(
						dropData.sourcePortNumber,
						dropData.sourceSide,
						firstPort,
						side,
						dropData
					);
				}
				return this.handleSingleFiberDrop(firstPort, side, dropData);
			}
			return false;
		}

		const fibers = (dropData as BundleDropData | CableDropData).fibers || [];
		if (fibers.length === 0) {
			globalToaster.warning({
				title: m.common_warning?.() || 'Warning',
				description: m.message_no_fibers_to_drop?.() || 'No fibers to drop'
			});
			return false;
		}

		const mergeInfo = groupSplice?.[mergeGroupInfoField] as MergeGroupInfo | undefined;
		const portCount = mergeInfo?.port_count || 1;

		const fiberData = fibers.slice(0, portCount).map((f) => ({
			uuid: f.uuid,
			cable_uuid:
				(dropData as BundleDropData & { cable_uuid?: string }).cable_uuid ||
				(dropData as CableDropData).uuid
		}));

		try {
			const formData = new FormData();
			formData.append('mergeGroup', mergeGroupId);
			formData.append('side', side);
			formData.append('fibers', JSON.stringify(fiberData));

			const response = await fetch('?/upsertMergedSplice', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(
					(result as { data?: ActionSuccessData }).data?.error || 'Failed to connect fibers'
				);
			}

			await this.fetchFiberSplices(this.selectedStructure!.uuid);

			globalToaster.success({
				title: m.title_success(),
				description: m.message_fibers_connected_to_merged({ count: fiberData.length })
			});

			this.#dispatchFiberSpliceChanged();

			return true;
		} catch (err: unknown) {
			console.error('Error dropping on merged ports:', err);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error dropping on merged ports',
				extraData: {
					from: 'FiberSpliceManager.handleMergedPortDrop',
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
			globalToaster.error({
				title: m.common_error(),
				description: (err as Error).message || 'Failed to connect fibers'
			});
			return false;
		}
	}

	/**
	 * Resets all manager state to initial values.
	 */
	cleanup(): void {
		this.selectedStructure = null;
		this.componentPorts = [];
		this.fiberSplices = [];
		this.fiberColors = [];
		this.loadingPorts = false;
		this.selectedForMerge = new Set();
		this.mergeSelectionMode = false;
	}

	/**
	 * Dispatches a custom event to notify other components (e.g. CableFiberSidebar)
	 * to refresh fiber usage data.
	 */
	#dispatchFiberSpliceChanged(): void {
		if (typeof window !== 'undefined') {
			window.dispatchEvent(new CustomEvent('fiberSpliceChanged'));
		}
	}
}
