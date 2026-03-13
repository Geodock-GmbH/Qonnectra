import { deserialize } from '$app/forms';

import { m } from '$lib/paraglide/messages';

import { globalToaster } from '$lib/stores/toaster';

/**
 * @typedef {{
 *   uuid: string,
 *   fiber_number: number,
 *   fiber_color: string,
 *   bundle_number: number,
 *   cable_name: string
 * }} FiberDetails
 *
 * @typedef {{
 *   uuid: string,
 *   id_residential_unit: number,
 *   display_name: string
 * }} ResidentialUnitDetails
 *
 * @typedef {{
 *   port_numbers: number[],
 *   port_count: number
 * }} MergeGroupInfo
 *
 * @typedef {{
 *   uuid: string,
 *   port_number: number,
 *   fiber_a_details: FiberDetails | null,
 *   fiber_b_details: FiberDetails | null,
 *   residential_unit_a_details: ResidentialUnitDetails | null,
 *   residential_unit_b_details: ResidentialUnitDetails | null,
 *   merge_group_a: string | null,
 *   merge_group_b: string | null,
 *   merge_group_a_info: MergeGroupInfo | null,
 *   merge_group_b_info: MergeGroupInfo | null,
 *   [key: string]: any
 * }} FiberSplice
 *
 * @typedef {{
 *   id: number,
 *   port: number,
 *   in_or_out: 'in' | 'out'
 * }} ComponentPort
 *
 * @typedef {{
 *   uuid: string,
 *   component_type: { id: number, component_type?: string } | null,
 *   slot_start: number,
 *   label?: string,
 *   [key: string]: any
 * }} NodeStructure
 *
 * @typedef {{
 *   portNumber: number,
 *   hasInPort: boolean,
 *   hasOutPort: boolean,
 *   splice: FiberSplice | undefined,
 *   fiberA: FiberDetails | null,
 *   fiberB: FiberDetails | null,
 *   residentialUnitA: ResidentialUnitDetails | null,
 *   residentialUnitB: ResidentialUnitDetails | null,
 *   mergeGroupA: string | null,
 *   mergeGroupB: string | null,
 *   mergeGroupAInfo: MergeGroupInfo | null,
 *   mergeGroupBInfo: MergeGroupInfo | null
 * }} PortRow
 *
 * @typedef {{
 *   groupId: string,
 *   isFirstInGroup: boolean,
 *   groupSize: number,
 *   portRange: string,
 *   fibers: FiberDetails[],
 *   fiberCount: number
 * }} MergeInfo
 *
 * @typedef {PortRow & {
 *   mergeInfoA: MergeInfo | null,
 *   mergeInfoB: MergeInfo | null
 * }} PortRowWithMerge
 *
 * @typedef {{
 *   type: 'fiber',
 *   uuid: string,
 *   fiber_number: number,
 *   fiber_color: string,
 *   bundle_number: number,
 *   cable_name: string,
 *   cable_uuid: string,
 *   isMove?: boolean,
 *   sourcePortNumber?: number,
 *   sourceSide?: 'a' | 'b'
 * }} FiberDropData
 *
 * @typedef {{
 *   type: 'bundle',
 *   fibers: { uuid: string, fiber_number_absolute: number, fiber_color: string, bundle_number: number }[],
 *   cable_uuid: string,
 *   cable_name: string
 * }} BundleDropData
 *
 * @typedef {{
 *   type: 'cable',
 *   uuid: string,
 *   fibers: { uuid: string, fiber_number_absolute: number, fiber_color: string, bundle_number: number }[],
 *   cable_uuid?: string
 * }} CableDropData
 *
 * @typedef {{
 *   type: 'residential_unit',
 *   uuid: string,
 *   id_residential_unit: number,
 *   display_name: string
 * }} ResidentialUnitDropData
 *
 * @typedef {{
 *   type: 'address',
 *   residential_units: { uuid: string, id_residential_unit: number, display_name: string }[]
 * }} AddressDropData
 *
 * @typedef {FiberDropData | BundleDropData | CableDropData | ResidentialUnitDropData | AddressDropData} DropData
 *
 * @typedef {{ name: string, hex: string, order: number }} FiberColor
 */

/**
 * Manager for fiber splice operations and component port management.
 * Handles fiber-to-port connections and disconnections.
 */
export class FiberSpliceManager {
	/** @type {NodeStructure | null} */
	selectedStructure = $state(null);

	/** @type {ComponentPort[]} */
	componentPorts = $state([]);

	/** @type {FiberSplice[]} */
	fiberSplices = $state([]);

	/** @type {FiberColor[]} */
	fiberColors = $state([]);

	/** @type {boolean} */
	loadingPorts = $state(false);

	/** @type {boolean} Whether a bulk operation (cable/bundle drop) is in progress */
	bulkOperationInProgress = $state(false);

	/** @type {Set<string>} Currently selected port keys for merging (format: "portNumber-side") */
	selectedForMerge = $state(new Set());

	/** @type {boolean} Whether merge selection mode is active */
	mergeSelectionMode = $state(false);

	/** @type {'a'|'b'} Currently selected side for merging */
	mergeSide = $state('a');

	/**
	 * Builds port rows by combining component port definitions with splice data
	 * for rendering the port table.
	 * @returns {PortRow[]}
	 */
	get portRows() {
		if (!this.componentPorts.length) return [];

		const inPorts = this.componentPorts.filter((p) => p.in_or_out === 'in');
		const outPorts = this.componentPorts.filter((p) => p.in_or_out === 'out');

		const maxInPort = inPorts.length > 0 ? Math.max(...inPorts.map((p) => p.port)) : 0;
		const maxOutPort = outPorts.length > 0 ? Math.max(...outPorts.map((p) => p.port)) : 0;
		const maxPort = Math.max(maxInPort, maxOutPort);

		/** @type {PortRow[]} */
		const rows = [];
		for (let port = 1; port <= maxPort; port++) {
			const hasInPort = inPorts.some((p) => p.port === port);
			const hasOutPort = outPorts.some((p) => p.port === port);
			const splice = this.fiberSplices.find((s) => s.port_number === port);

			rows.push({
				portNumber: port,
				hasInPort,
				hasOutPort,
				splice,
				fiberA: splice?.fiber_a_details || null,
				fiberB: splice?.fiber_b_details || null,
				residentialUnitA: splice?.residential_unit_a_details || null,
				residentialUnitB: splice?.residential_unit_b_details || null,
				mergeGroupA: splice?.merge_group_a || null,
				mergeGroupB: splice?.merge_group_b || null,
				mergeGroupAInfo: splice?.merge_group_a_info || null,
				mergeGroupBInfo: splice?.merge_group_b_info || null
			});
		}
		return rows;
	}

	/**
	 * Get port rows with merge group annotations per side (for spanning cell display).
	 * All rows are kept - no collapsing. Each row has mergeInfoA and mergeInfoB.
	 * @returns {PortRowWithMerge[]}
	 */
	get portRowsWithMerge() {
		const baseRows = this.portRows;
		if (baseRows.length === 0) return [];

		/** @type {Map<string, number[]>} */
		const mergeGroupsA = new Map();
		/** @type {Map<string, number[]>} */
		const mergeGroupsB = new Map();

		for (const splice of this.fiberSplices) {
			if (splice.merge_group_a) {
				if (!mergeGroupsA.has(splice.merge_group_a)) {
					mergeGroupsA.set(splice.merge_group_a, []);
				}
				/** @type {number[]} */ (mergeGroupsA.get(splice.merge_group_a)).push(splice.port_number);
			}
			if (splice.merge_group_b) {
				if (!mergeGroupsB.has(splice.merge_group_b)) {
					mergeGroupsB.set(splice.merge_group_b, []);
				}
				/** @type {number[]} */ (mergeGroupsB.get(splice.merge_group_b)).push(splice.port_number);
			}
		}

		for (const ports of mergeGroupsA.values()) ports.sort((a, b) => a - b);
		for (const ports of mergeGroupsB.values()) ports.sort((a, b) => a - b);

		/**
		 * Get fiber(s) for a merge group on a specific side
		 * @param {string} groupId
		 * @param {'a' | 'b'} side
		 * @returns {FiberDetails[]}
		 */
		const getFibersForGroup = (groupId, side) => {
			const mergeGroupField = side === 'a' ? 'merge_group_a' : 'merge_group_b';
			const fiberKey = side === 'a' ? 'fiber_a_details' : 'fiber_b_details';

			/** @type {FiberDetails[]} */
			const fibersWithData = this.fiberSplices
				.filter((s) => s[mergeGroupField] === groupId && s[fiberKey] != null)
				.map((s) => /** @type {FiberDetails} */ (s[fiberKey]));

			// Merged side always uses shared fiber - all will be the same
			if (fibersWithData.length > 0) {
				return [fibersWithData[0]];
			}

			return fibersWithData;
		};

		/**
		 * @param {number} portNumber
		 * @param {'a' | 'b'} side
		 * @param {Map<string, number[]>} groupMap
		 * @returns {MergeInfo | null}
		 */
		const buildMergeInfo = (portNumber, side, groupMap) => {
			const mergeGroupField = side === 'a' ? 'merge_group_a' : 'merge_group_b';

			const splice = this.fiberSplices.find(
				(s) => s.port_number === portNumber && s[mergeGroupField]
			);
			if (!splice?.[mergeGroupField]) return null;

			const groupId = splice[mergeGroupField];
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
	 * @param {NodeStructure | null} structure
	 * @param {boolean} isMobile - Whether mobile mode is active
	 * @returns {Promise<boolean>} True if structure was selected, false if deselected or blocked
	 */
	async selectStructure(structure, isMobile = false) {
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
	 * @param {number} componentTypeId
	 * @returns {Promise<void>}
	 */
	async fetchComponentPorts(componentTypeId) {
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
					/** @type {any} */ (result).data?.error || 'Failed to fetch component ports'
				);
			}

			this.componentPorts = /** @type {any} */ (result).data?.ports || [];
		} catch (err) {
			console.error('Error fetching component ports:', err);
			this.componentPorts = [];
		}
	}

	/**
	 * Fetches existing fiber splice connections for a node structure from the server.
	 * @param {string} nodeStructureUuid
	 * @returns {Promise<void>}
	 */
	async fetchFiberSplices(nodeStructureUuid) {
		try {
			const formData = new FormData();
			formData.append('nodeStructureUuid', nodeStructureUuid);

			const response = await fetch('?/getFiberSplices', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(/** @type {any} */ (result).data?.error || 'Failed to fetch fiber splices');
			}

			this.fiberSplices = /** @type {any} */ (result).data?.splices || [];
		} catch (err) {
			console.error('Error fetching fiber splices:', err);
			this.fiberSplices = [];
		}
	}

	/**
	 * Fetches the fiber color palette from the server. Only fetches once per manager lifetime.
	 * @returns {Promise<void>}
	 */
	async fetchFiberColorsIfNeeded() {
		if (this.fiberColors.length > 0) return;

		try {
			const response = await fetch('?/getFiberColors', {
				method: 'POST',
				body: new FormData()
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(/** @type {any} */ (result).data?.error || 'Failed to fetch fiber colors');
			}

			this.fiberColors = /** @type {any} */ (result).data?.fiberColors || [];
		} catch (err) {
			console.error('Error fetching fiber colors:', err);
		}
	}

	/**
	 * Routes a port drop event to the appropriate handler based on the drop data type.
	 * @param {number} portNumber - Starting port number
	 * @param {'a'|'b'} side
	 * @param {DropData} dropData
	 * @param {NodeStructure[]} allStructures - All structures for multi-component cable drop
	 * @returns {Promise<boolean>} True if any connections were created
	 */
	async handlePortDrop(portNumber, side, dropData, allStructures = []) {
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
				/** @type {any} */ (m).message_unsupported_drop_type?.() || 'Unsupported drop type'
		});
		return false;
	}

	/**
	 * Moves a fiber from one port/side to another by placing it at the target and clearing the source.
	 * No-op if source and target are the same cell.
	 * @param {number} sourcePort - Source port number
	 * @param {'a'|'b'} sourceSide - Source side
	 * @param {number} targetPort - Target port number
	 * @param {'a'|'b'} targetSide - Target side
	 * @param {FiberDropData} fiberData - Fiber data
	 * @returns {Promise<boolean>} True if successful
	 */
	async handleFiberMove(sourcePort, sourceSide, targetPort, targetSide, fiberData) {
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
	 * @param {'a'|'b'} side
	 * @param {number} startPort
	 * @returns {number[]} Array of available port numbers
	 */
	getAvailablePorts(side, startPort) {
		const portType = side === 'a' ? 'in' : 'out';
		const portsOnSide = this.componentPorts
			.filter((p) => p.in_or_out === portType)
			.map((p) => p.port)
			.sort((a, b) => a - b);

		const maxPort = portsOnSide.length > 0 ? Math.max(...portsOnSide) : 0;
		/** @type {number[]} */
		const available = [];

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
	 * @param {number} portNumber
	 * @param {'a'|'b'} side
	 * @param {FiberDropData} fiberData
	 * @returns {Promise<boolean>} True if successful
	 */
	async handleSingleFiberDrop(portNumber, side, fiberData) {
		const previousSplices = [...this.fiberSplices];
		const existingSplice = this.fiberSplices.find((s) => s.port_number === portNumber);

		const mergeGroupField = `merge_group_${side}`;
		const mergeGroupValue = existingSplice?.[mergeGroupField];
		const isMergedOnThisSide = mergeGroupValue != null;

		const fiberDetails = {
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
			const newSplice = /** @type {FiberSplice} */ ({
				uuid: `temp-${Date.now()}`,
				port_number: portNumber,
				fiber_a_details: side === 'a' ? fiberDetails : null,
				fiber_b_details: side === 'b' ? fiberDetails : null
			});
			this.fiberSplices = [...this.fiberSplices, newSplice];
		}

		try {
			const formData = new FormData();
			formData.append(
				'nodeStructureUuid',
				/** @type {NodeStructure} */ (this.selectedStructure).uuid
			);
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
				throw new Error(/** @type {any} */ (result).data?.error || 'Failed to save fiber splice');
			}

			if (isMergedOnThisSide) {
				await this.fetchFiberSplices(/** @type {NodeStructure} */ (this.selectedStructure).uuid);
			} else {
				const serverSplice = /** @type {any} */ (result).data.splice;
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
		} catch (err) {
			console.error('Error saving fiber splice:', err);
			this.fiberSplices = previousSplices;
			globalToaster.error({
				title: m.common_error(),
				description:
					/** @type {any} */ (err).message ||
					m.message_error_connecting_fiber?.() ||
					'Failed to connect fiber'
			});
			return false;
		}
	}

	/**
	 * Connects a bundle of fibers to sequential ports using the bulk API.
	 * @param {number} startPort - Starting port number
	 * @param {'a'|'b'} side
	 * @param {BundleDropData} bundleData - Bundle data including fibers array
	 * @returns {Promise<boolean>} True if any fibers were connected
	 */
	async handleBundleDrop(startPort, side, bundleData) {
		const fibers = bundleData.fibers || [];
		if (fibers.length === 0) {
			globalToaster.warning({
				title: m.common_warning?.() || 'Warning',
				description: /** @type {any} */ (m).message_bundle_empty?.() || 'Bundle contains no fibers'
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
				description: /** @type {any} */ (m).message_no_available_ports?.() || 'No available ports'
			});
			return false;
		}

		this.bulkOperationInProgress = true;
		const previousSplices = [...this.fiberSplices];

		/** @type {{ node_structure_uuid: string, port_number: number, side: string, fiber_uuid: string, cable_uuid: string }[]} */
		const spliceData = [];
		/** @type {{ portNumber: number, fiberDetails: FiberDetails }[]} */
		const optimisticUpdates = [];

		for (let i = 0; i < Math.min(sortedFibers.length, availablePorts.length); i++) {
			const fiber = sortedFibers[i];
			const portNumber = availablePorts[i];

			spliceData.push({
				node_structure_uuid: /** @type {NodeStructure} */ (this.selectedStructure).uuid,
				port_number: portNumber,
				side: side,
				fiber_uuid: fiber.uuid,
				cable_uuid: bundleData.cable_uuid
			});

			const fiberDetails = {
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
					/** @type {FiberSplice} */ ({
						uuid: `temp-${Date.now()}-${portNumber}`,
						port_number: portNumber,
						fiber_a_details: side === 'a' ? fiberDetails : null,
						fiber_b_details: side === 'b' ? fiberDetails : null
					})
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
				throw new Error(/** @type {any} */ (result).data?.error || 'Failed to save fiber splices');
			}

			const created = /** @type {any} */ (result).data?.created || [];
			const failed = /** @type {any} */ (result).data?.failed || [];

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
		} catch (err) {
			console.error('Error saving fiber splices:', err);
			this.fiberSplices = previousSplices;
			this.bulkOperationInProgress = false;
			globalToaster.error({
				title: m.common_error(),
				description:
					/** @type {any} */ (err).message ||
					m.message_error_connecting_fiber?.() ||
					'Failed to connect fibers'
			});
			return false;
		}
	}

	/**
	 * Fetches fiber data for a cable from the server.
	 * @param {string} cableUuid
	 * @returns {Promise<any[]>}
	 */
	async #fetchFibersForCable(cableUuid) {
		try {
			const formData = new FormData();
			formData.append('cableUuid', cableUuid);

			const response = await fetch('?/getFibersForCable', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(/** @type {any} */ (result).data?.error || 'Failed to fetch fibers');
			}

			return /** @type {any} */ (result).data?.fibers || [];
		} catch (err) {
			console.error('Error fetching fibers for cable:', err);
			return [];
		}
	}

	/**
	 * Connects all fibers from a cable to sequential ports, continuing across
	 * subsequent components in slot order if fibers remain. Uses bulk API per structure.
	 * @param {number} startPort - Starting port number
	 * @param {'a'|'b'} side
	 * @param {CableDropData} cableData - Cable data including fibers array
	 * @param {NodeStructure[]} allStructures - All structures in slot grid for multi-component mode
	 * @returns {Promise<boolean>} True if any fibers were connected
	 */
	async handleCableDrop(startPort, side, cableData, allStructures = []) {
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

		const structuresToFill =
			currentStructureIndex >= 0 ? sortedStructures.slice(currentStructureIndex) : [];

		if (structuresToFill.length === 0 && this.selectedStructure) {
			structuresToFill.push(this.selectedStructure);
		}

		let totalSuccessCount = 0;
		let fiberIndex = 0;
		let errorOccurred = false;
		/** @type {string[]} */
		const componentsUsed = [];

		for (const structure of structuresToFill) {
			if (fiberIndex >= sortedFibers.length) break;
			/** @type {ComponentPort[]} */
			let ports = [];
			/** @type {FiberSplice[]} */
			let splices = [];

			if (structure.uuid === this.selectedStructure?.uuid) {
				ports = this.componentPorts;
				splices = this.fiberSplices;
			} else {
				try {
					const portsResult = await this.#fetchPortsForStructure(
						/** @type {NonNullable<NodeStructure['component_type']>} */ (structure.component_type)
							.id
					);
					const splicesResult = await this.#fetchSplicessForStructure(structure.uuid);
					ports = portsResult;
					splices = splicesResult;
				} catch (err) {
					console.error('Error fetching ports for structure:', err);
					continue; // Skip this structure
				}
			}

			const availablePorts = this.#getAvailablePortsForStructure(
				ports,
				splices,
				side,
				structure.uuid === this.selectedStructure?.uuid ? startPort : 1
			);

			if (availablePorts.length === 0) continue;

			/** @type {{ node_structure_uuid: string, port_number: number, side: string, fiber_uuid: string, cable_uuid: string }[]} */
			const spliceData = [];
			/** @type {Set<string>} */
			const processedMergeGroups = new Set();

			for (const portNumber of availablePorts) {
				if (fiberIndex >= sortedFibers.length) break;

				const mergeGroupField = `merge_group_${side}`;
				const existingSplice = splices.find((s) => s.port_number === portNumber);
				const mergeGroupId = existingSplice?.[mergeGroupField];

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
						/** @type {any} */ (result).data?.error || 'Failed to save fiber splices'
					);
				}

				const created = /** @type {any} */ (result).data?.created || [];
				const failed = /** @type {any} */ (result).data?.failed || [];

				if (structure.uuid === this.selectedStructure?.uuid) {
					const createdByPort = new Map(
						created.map((/** @type {FiberSplice} */ s) => [s.port_number, s])
					);
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
			} catch (err) {
				console.error('Error saving fiber splices for structure:', err);
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
	 * @param {number} portNumber
	 * @param {'a'|'b'} side
	 * @param {ResidentialUnitDropData} unitData
	 * @returns {Promise<boolean>} True if successful
	 */
	async handleResidentialUnitDrop(portNumber, side, unitData) {
		const previousSplices = [...this.fiberSplices];
		const existingSplice = this.fiberSplices.find((s) => s.port_number === portNumber);

		const unitDetails = {
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
			const newSplice = /** @type {FiberSplice} */ ({
				uuid: `temp-${Date.now()}`,
				port_number: portNumber,
				residential_unit_a_details: side === 'a' ? unitDetails : null,
				residential_unit_b_details: side === 'b' ? unitDetails : null
			});
			this.fiberSplices = [...this.fiberSplices, newSplice];
		}

		try {
			const formData = new FormData();
			formData.append(
				'nodeStructureUuid',
				/** @type {NodeStructure} */ (this.selectedStructure).uuid
			);
			formData.append('portNumber', portNumber.toString());
			formData.append('side', side);
			formData.append('residentialUnitUuid', unitData.uuid);

			const response = await fetch('?/upsertFiberSplice', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(/** @type {any} */ (result).data?.error || 'Failed to save connection');
			}

			const serverSplice = /** @type {any} */ (result).data.splice;
			this.fiberSplices = this.fiberSplices.map((s) =>
				s.port_number === portNumber ? serverSplice : s
			);

			globalToaster.success({
				title: m.title_success(),
				description: m.message_residential_unit_connected?.() || 'Residential unit connected'
			});

			this.#dispatchResidentialUnitSpliceChanged();
			return true;
		} catch (err) {
			console.error('Error saving residential unit connection:', err);
			this.fiberSplices = previousSplices;
			globalToaster.error({
				title: m.common_error(),
				description: /** @type {any} */ (err).message || 'Failed to connect residential unit'
			});
			return false;
		}
	}

	/**
	 * Connects all residential units from an address to sequential ports using bulk API.
	 * @param {number} startPort - Starting port number
	 * @param {'a'|'b'} side
	 * @param {AddressDropData} addressData - Address data including residential_units array
	 * @returns {Promise<boolean>} True if any units were connected
	 */
	async handleAddressDrop(startPort, side, addressData) {
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
				description: /** @type {any} */ (m).message_no_available_ports?.() || 'No available ports'
			});
			return false;
		}

		this.bulkOperationInProgress = true;
		const previousSplices = [...this.fiberSplices];

		/** @type {{ node_structure_uuid: string, port_number: number, side: string, residential_unit_uuid: string }[]} */
		const spliceData = [];

		for (let i = 0; i < Math.min(sortedUnits.length, availablePorts.length); i++) {
			const unit = sortedUnits[i];
			const portNumber = availablePorts[i];

			spliceData.push({
				node_structure_uuid: /** @type {NodeStructure} */ (this.selectedStructure).uuid,
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
				throw new Error(/** @type {any} */ (result).data?.error || 'Failed to save connections');
			}

			const created = /** @type {any} */ (result).data?.created || [];
			const failed = /** @type {any} */ (result).data?.failed || [];

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
		} catch (err) {
			console.error('Error saving residential unit connections:', err);
			this.fiberSplices = previousSplices;
			this.bulkOperationInProgress = false;
			globalToaster.error({
				title: m.common_error(),
				description: /** @type {any} */ (err).message || 'Failed to connect residential units'
			});
			return false;
		}
	}

	/**
	 * Dispatches a custom event to notify other components that residential unit splices changed.
	 * @returns {void}
	 */
	#dispatchResidentialUnitSpliceChanged() {
		if (typeof window !== 'undefined') {
			window.dispatchEvent(new CustomEvent('residentialUnitSpliceChanged'));
		}
	}

	/**
	 * Fetches component port definitions for a given component type.
	 * @param {number} componentTypeId
	 * @returns {Promise<ComponentPort[]>}
	 */
	async #fetchPortsForStructure(componentTypeId) {
		const formData = new FormData();
		formData.append('componentTypeId', componentTypeId.toString());

		const response = await fetch('?/getComponentPorts', {
			method: 'POST',
			body: formData
		});

		const result = deserialize(await response.text());

		if (result.type === 'failure' || result.type === 'error') {
			throw new Error(/** @type {any} */ (result).data?.error || 'Failed to fetch component ports');
		}

		return /** @type {any} */ (result).data?.ports || [];
	}

	/**
	 * Fetches fiber splice data for a given node structure.
	 * @param {string} nodeStructureUuid
	 * @returns {Promise<FiberSplice[]>}
	 */
	async #fetchSplicessForStructure(nodeStructureUuid) {
		const formData = new FormData();
		formData.append('nodeStructureUuid', nodeStructureUuid);

		const response = await fetch('?/getFiberSplices', {
			method: 'POST',
			body: formData
		});

		const result = deserialize(await response.text());

		if (result.type === 'failure' || result.type === 'error') {
			throw new Error(/** @type {any} */ (result).data?.error || 'Failed to fetch fiber splices');
		}

		return /** @type {any} */ (result).data?.splices || [];
	}

	/**
	 * Returns consecutive unoccupied port numbers for a given structure and side.
	 * Stops at the first occupied port.
	 * @param {ComponentPort[]} ports
	 * @param {FiberSplice[]} splices
	 * @param {'a'|'b'} side
	 * @param {number} startPort
	 * @returns {number[]}
	 */
	#getAvailablePortsForStructure(ports, splices, side, startPort) {
		const portType = side === 'a' ? 'in' : 'out';
		const portsOnSide = ports
			.filter((p) => p.in_or_out === portType)
			.map((p) => p.port)
			.sort((a, b) => a - b);

		const maxPort = portsOnSide.length > 0 ? Math.max(...portsOnSide) : 0;
		/** @type {number[]} */
		const available = [];

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
	 * @param {number} portNumber
	 * @param {'a'|'b'} side
	 * @returns {Promise<void>}
	 */
	async handleClearPort(portNumber, side) {
		const previousSplices = [...this.fiberSplices];
		const existingSplice = this.fiberSplices.find((s) => s.port_number === portNumber);

		const mergeGroupField = `merge_group_${side}`;
		const mergeGroupValue = existingSplice?.[mergeGroupField];
		const isMergedOnThisSide = mergeGroupValue != null;

		if (isMergedOnThisSide) {
			this.fiberSplices = this.fiberSplices.map((s) => {
				if (s[mergeGroupField] === mergeGroupValue) {
					return {
						...s,
						[`fiber_${side}_details`]: null
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
							[`fiber_${side}_details`]: null
						};
						// Only remove if both sides empty and not in any merge group
						if (
							!updated.fiber_a_details &&
							!updated.fiber_b_details &&
							!updated.merge_group_a &&
							!updated.merge_group_b
						) {
							return null;
						}
						return updated;
					}
					return s;
				})
				.filter(/** @returns {s is FiberSplice} */ (s) => s != null);
		}

		try {
			const formData = new FormData();
			formData.append(
				'nodeStructureUuid',
				/** @type {NodeStructure} */ (this.selectedStructure).uuid
			);
			formData.append('portNumber', portNumber.toString());
			formData.append('side', side);

			const response = await fetch('?/clearFiberSplice', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(/** @type {any} */ (result).data?.error || 'Failed to clear fiber splice');
			}

			if (isMergedOnThisSide) {
				await this.fetchFiberSplices(/** @type {NodeStructure} */ (this.selectedStructure).uuid);
			}

			this.#dispatchFiberSpliceChanged();
		} catch (err) {
			console.error('Error clearing fiber splice:', err);
			this.fiberSplices = previousSplices;
			globalToaster.error({
				title: m.common_error(),
				description: /** @type {any} */ (err).message || 'Failed to clear fiber'
			});
		}
	}

	/**
	 * Deselects the current structure and clears port/splice data.
	 * @returns {void}
	 */
	closePortTable() {
		this.selectedStructure = null;
		this.componentPorts = [];
		this.fiberSplices = [];
	}

	/**
	 * Clears port table selection if the deleted structure was selected.
	 * @param {string} structureUuid
	 * @returns {void}
	 */
	onStructureDeleted(structureUuid) {
		if (this.selectedStructure?.uuid === structureUuid) {
			this.closePortTable();
		}
	}

	/**
	 * Toggles merge selection mode on/off, clearing selections when deactivating.
	 * @returns {void}
	 */
	toggleMergeSelectionMode() {
		this.mergeSelectionMode = !this.mergeSelectionMode;
		if (!this.mergeSelectionMode) {
			this.selectedForMerge = new Set();
		}
	}

	/**
	 * Sets the active side for merge selection, clearing selections when the side changes.
	 * @param {'a'|'b'} side
	 * @returns {void}
	 */
	setMergeSide(side) {
		if (side !== this.mergeSide) {
			this.mergeSide = side;
			this.selectedForMerge = new Set();
		}
	}

	/**
	 * Toggles a port's selection state for the merge operation.
	 * @param {number} portNumber
	 * @param {'a'|'b'} side
	 * @returns {void}
	 */
	togglePortSelection(portNumber, side) {
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
	 * @returns {void}
	 */
	clearMergeSelection() {
		this.selectedForMerge = new Set();
	}

	/**
	 * Merges the currently selected ports into a single group.
	 * Validates that at least 2 consecutive ports on the same side are selected.
	 * @returns {Promise<boolean>} True if successful
	 */
	async mergeSelectedPorts() {
		if (this.selectedForMerge.size < 2) {
			globalToaster.warning({
				title: m.common_warning?.() || 'Warning',
				description: m.message_select_at_least_two_ports?.() || 'Select at least 2 ports to merge'
			});
			return false;
		}

		/** @type {number[]} */
		const portNumbers = [];
		/** @type {string | null} */
		let side = null;
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
						/** @type {any} */ (m).message_ports_must_be_consecutive?.() ||
						'Ports must be consecutive (e.g., 1-2-3, not 1-3)'
				});
				return false;
			}
		}

		try {
			const formData = new FormData();
			formData.append(
				'nodeStructureUuid',
				/** @type {NodeStructure} */ (this.selectedStructure).uuid
			);
			formData.append('portNumbers', JSON.stringify(portNumbers));
			formData.append('side', /** @type {string} */ (side));

			const response = await fetch('?/mergePorts', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(/** @type {any} */ (result).data?.error || 'Failed to merge ports');
			}

			await this.fetchFiberSplices(/** @type {NodeStructure} */ (this.selectedStructure).uuid);
			this.selectedForMerge = new Set();
			this.mergeSelectionMode = false;

			globalToaster.success({
				title: m.title_success?.() || 'Success',
				description:
					m.message_ports_merged?.({ count: portNumbers.length }) ||
					`Merged ${portNumbers.length} ports`
			});

			return true;
		} catch (err) {
			console.error('Error merging ports:', err);
			globalToaster.error({
				title: m.common_error(),
				description: /** @type {any} */ (err).message || 'Failed to merge ports'
			});
			return false;
		}
	}

	/**
	 * Unmerges ports from a merge group, restoring them to individual ports.
	 * @param {string} mergeGroupId
	 * @param {number[]} portNumbers - Specific ports to unmerge (if empty, unmerges all in group)
	 * @returns {Promise<boolean>} True if successful
	 */
	async unmergePorts(mergeGroupId, portNumbers = []) {
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
				throw new Error(/** @type {any} */ (result).data?.error || 'Failed to unmerge ports');
			}

			await this.fetchFiberSplices(/** @type {NodeStructure} */ (this.selectedStructure).uuid);

			globalToaster.success({
				title: m.title_success?.() || 'Success',
				description: m.message_ports_unmerged?.() || 'Ports unmerged'
			});

			return true;
		} catch (err) {
			console.error('Error unmerging ports:', err);
			globalToaster.error({
				title: m.common_error(),
				description: /** @type {any} */ (err).message || 'Failed to unmerge ports'
			});
			return false;
		}
	}

	/**
	 * Handles a drop on a merged port group, connecting fibers to all ports in the group.
	 * @param {string} mergeGroupId
	 * @param {'a'|'b'} side
	 * @param {DropData} dropData
	 * @returns {Promise<boolean>} True if successful
	 */
	async handleMergedPortDrop(mergeGroupId, side, dropData) {
		const mergeGroupField = `merge_group_${side}`;
		const mergeGroupInfoField = `merge_group_${side}_info`;
		let groupSplice = this.fiberSplices.find((s) => s[mergeGroupField] === mergeGroupId);

		if (dropData.type === 'fiber') {
			const firstPort = groupSplice?.[mergeGroupInfoField]?.port_numbers?.[0];
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

		const fibers = /** @type {any} */ (dropData).fibers || [];
		if (fibers.length === 0) {
			globalToaster.warning({
				title: m.common_warning?.() || 'Warning',
				description: m.message_no_fibers_to_drop?.() || 'No fibers to drop'
			});
			return false;
		}

		const mergeInfo = groupSplice?.[mergeGroupInfoField];
		const portCount = mergeInfo?.port_count || 1;

		const fiberData = fibers.slice(0, portCount).map((/** @type {any} */ f) => ({
			uuid: f.uuid,
			cable_uuid: /** @type {any} */ (dropData).cable_uuid || /** @type {any} */ (dropData).uuid
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
				throw new Error(/** @type {any} */ (result).data?.error || 'Failed to connect fibers');
			}

			await this.fetchFiberSplices(/** @type {NodeStructure} */ (this.selectedStructure).uuid);

			globalToaster.success({
				title: m.title_success(),
				description: m.message_fibers_connected_to_merged({ count: fiberData.length })
			});

			this.#dispatchFiberSpliceChanged();

			return true;
		} catch (err) {
			console.error('Error dropping on merged ports:', err);
			globalToaster.error({
				title: m.common_error(),
				description: /** @type {any} */ (err).message || 'Failed to connect fibers'
			});
			return false;
		}
	}

	/**
	 * Resets all manager state to initial values.
	 * @returns {void}
	 */
	cleanup() {
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
	 * @returns {void}
	 */
	#dispatchFiberSpliceChanged() {
		if (typeof window !== 'undefined') {
			window.dispatchEvent(new CustomEvent('fiberSpliceChanged'));
		}
	}
}
