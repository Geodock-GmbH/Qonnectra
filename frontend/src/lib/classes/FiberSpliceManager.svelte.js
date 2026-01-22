import { deserialize } from '$app/forms';

import { m } from '$lib/paraglide/messages';

import { globalToaster } from '$lib/stores/toaster';

/**
 * Manager for fiber splice operations and component port management.
 * Handles fiber-to-port connections and disconnections.
 */
export class FiberSpliceManager {
	/** @type {Object|null} */
	selectedStructure = $state(null);

	/** @type {Array<Object>} */
	componentPorts = $state([]);

	/** @type {Array<Object>} */
	fiberSplices = $state([]);

	/** @type {Array<Object>} */
	fiberColors = $state([]);

	/** @type {boolean} */
	loadingPorts = $state(false);

	/** @type {boolean} - Whether a bulk operation (cable/bundle drop) is in progress */
	bulkOperationInProgress = $state(false);

	/** @type {Set<string>} - Currently selected port keys for merging (format: "portNumber-side") */
	selectedForMerge = $state(new Set());

	/** @type {boolean} - Whether merge selection mode is active */
	mergeSelectionMode = $state(false);

	/** @type {'a'|'b'} - Currently selected side for merging */
	mergeSide = $state('a');

	/**
	 * Get port rows for rendering the port table
	 * @returns {Array<Object>}
	 */
	get portRows() {
		if (!this.componentPorts.length) return [];

		const inPorts = this.componentPorts.filter((p) => p.in_or_out === 'in');
		const outPorts = this.componentPorts.filter((p) => p.in_or_out === 'out');

		const maxInPort = inPorts.length > 0 ? Math.max(...inPorts.map((p) => p.port)) : 0;
		const maxOutPort = outPorts.length > 0 ? Math.max(...outPorts.map((p) => p.port)) : 0;
		const maxPort = Math.max(maxInPort, maxOutPort);

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
				// Side-specific merge groups (independent merging per side)
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
	 * @returns {Array<Object>}
	 */
	get portRowsWithMerge() {
		const baseRows = this.portRows;
		if (baseRows.length === 0) return [];

		// Build merge groups per side (using independent merge_group_a and merge_group_b)
		const mergeGroupsA = new Map(); // groupId -> sorted port numbers
		const mergeGroupsB = new Map();

		for (const splice of this.fiberSplices) {
			// Check side A merge group
			if (splice.merge_group_a) {
				if (!mergeGroupsA.has(splice.merge_group_a)) {
					mergeGroupsA.set(splice.merge_group_a, []);
				}
				mergeGroupsA.get(splice.merge_group_a).push(splice.port_number);
			}
			// Check side B merge group (independent from side A)
			if (splice.merge_group_b) {
				if (!mergeGroupsB.has(splice.merge_group_b)) {
					mergeGroupsB.set(splice.merge_group_b, []);
				}
				mergeGroupsB.get(splice.merge_group_b).push(splice.port_number);
			}
		}

		// Sort port numbers in each group
		for (const ports of mergeGroupsA.values()) ports.sort((a, b) => a - b);
		for (const ports of mergeGroupsB.values()) ports.sort((a, b) => a - b);

		// Get fiber(s) for a merge group on a specific side
		// When merged: there's ONE shared fiber (return just the first, deduplicated)
		const getFibersForGroup = (groupId, side) => {
			const mergeGroupField = side === 'a' ? 'merge_group_a' : 'merge_group_b';
			const fiberKey = side === 'a' ? 'fiber_a_details' : 'fiber_b_details';

			const fibersWithData = this.fiberSplices
				.filter((s) => s[mergeGroupField] === groupId && s[fiberKey])
				.map((s) => s[fiberKey]);

			// Merged side always uses shared fiber - all will be the same
			if (fibersWithData.length > 0) {
				// Return just the first (shared) fiber - they're all the same
				return [fibersWithData[0]];
			}

			return fibersWithData;
		};

		// Build merge info for a port/side
		const buildMergeInfo = (portNumber, side, groupMap) => {
			const mergeGroupField = side === 'a' ? 'merge_group_a' : 'merge_group_b';

			// Find splice for this port with merge group on this side
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

		// Annotate each row with merge info per side
		return baseRows.map((row) => ({
			...row,
			mergeInfoA: buildMergeInfo(row.portNumber, 'a', mergeGroupsA),
			mergeInfoB: buildMergeInfo(row.portNumber, 'b', mergeGroupsB)
		}));
	}

	/**
	 * Select a structure and load its ports and splices
	 * @param {Object|null} structure
	 * @param {boolean} isMobile - Whether mobile mode is active
	 * @returns {Promise<boolean>} - True if structure was selected (vs deselected)
	 */
	async selectStructure(structure, isMobile = false) {
		// Don't allow switching while a bulk operation is in progress
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
	 * Fetch component ports for a component type
	 * @param {number} componentTypeId
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
				throw new Error(result.data?.error || 'Failed to fetch component ports');
			}

			this.componentPorts = result.data?.ports || [];
		} catch (err) {
			console.error('Error fetching component ports:', err);
			this.componentPorts = [];
		}
	}

	/**
	 * Fetch fiber splices for a node structure
	 * @param {string} nodeStructureUuid
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
				throw new Error(result.data?.error || 'Failed to fetch fiber splices');
			}

			this.fiberSplices = result.data?.splices || [];
		} catch (err) {
			console.error('Error fetching fiber splices:', err);
			this.fiberSplices = [];
		}
	}

	/**
	 * Fetch fiber colors (singleton - only fetches once)
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
				throw new Error(result.data?.error || 'Failed to fetch fiber colors');
			}

			this.fiberColors = result.data?.fiberColors || [];
		} catch (err) {
			console.error('Error fetching fiber colors:', err);
		}
	}

	/**
	 * Handle dropping onto a port - routes to appropriate handler based on type
	 * @param {number} portNumber - Starting port number
	 * @param {'a'|'b'} side
	 * @param {Object} dropData
	 * @param {Array<Object>} allStructures - All structures for multi-component cable drop
	 * @returns {Promise<boolean>} - True if any fibers were connected
	 */
	async handlePortDrop(portNumber, side, dropData, allStructures = []) {
		if (dropData.type === 'fiber') {
			// Check if this is a move operation (drag from another port)
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
		}

		globalToaster.warning({
			title: m.common_warning?.() || 'Warning',
			description: m.message_unsupported_drop_type?.() || 'Unsupported drop type'
		});
		return false;
	}

	/**
	 * Handle moving a fiber from one port to another
	 * @param {number} sourcePort - Source port number
	 * @param {'a'|'b'} sourceSide - Source side
	 * @param {number} targetPort - Target port number
	 * @param {'a'|'b'} targetSide - Target side
	 * @param {Object} fiberData - Fiber data
	 * @returns {Promise<boolean>} - True if successful
	 */
	async handleFiberMove(sourcePort, sourceSide, targetPort, targetSide, fiberData) {
		// Don't do anything if dropping on the same cell
		if (sourcePort === targetPort && sourceSide === targetSide) {
			return false;
		}

		// First, place the fiber in the target port
		const success = await this.handleSingleFiberDrop(targetPort, targetSide, fiberData);

		if (success) {
			// Then clear the source port
			await this.handleClearPort(sourcePort, sourceSide);
		}

		return success;
	}

	/**
	 * Get available ports for a side starting from a port number
	 * @param {'a'|'b'} side
	 * @param {number} startPort
	 * @returns {Array<number>} - Array of available port numbers
	 */
	getAvailablePorts(side, startPort) {
		const portType = side === 'a' ? 'in' : 'out';
		const portsOnSide = this.componentPorts
			.filter((p) => p.in_or_out === portType)
			.map((p) => p.port)
			.sort((a, b) => a - b);

		const maxPort = portsOnSide.length > 0 ? Math.max(...portsOnSide) : 0;
		const available = [];

		for (let port = startPort; port <= maxPort; port++) {
			// Check if this port exists on this side
			if (!portsOnSide.includes(port)) continue;

			// Check if port is already occupied on this side
			const existingSplice = this.fiberSplices.find((s) => s.port_number === port);
			if (existingSplice?.[`fiber_${side}_details`]) {
				// Port is occupied - stop here (per requirements)
				break;
			}

			available.push(port);
		}

		return available;
	}

	/**
	 * Handle dropping a single fiber onto a port
	 * @param {number} portNumber
	 * @param {'a'|'b'} side
	 * @param {Object} fiberData
	 * @returns {Promise<boolean>} - True if successful
	 */
	async handleSingleFiberDrop(portNumber, side, fiberData) {
		const previousSplices = [...this.fiberSplices];
		const existingSplice = this.fiberSplices.find((s) => s.port_number === portNumber);

		// Check if this port is merged on this side (using side-specific merge group)
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

		// Optimistic update for UI
		if (isMergedOnThisSide) {
			// Update all ports in the merge group
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
			const newSplice = {
				uuid: `temp-${Date.now()}`,
				port_number: portNumber,
				fiber_a_details: side === 'a' ? fiberDetails : null,
				fiber_b_details: side === 'b' ? fiberDetails : null
			};
			this.fiberSplices = [...this.fiberSplices, newSplice];
		}

		try {
			const formData = new FormData();
			formData.append('nodeStructureUuid', this.selectedStructure.uuid);
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
				throw new Error(result.data?.error || 'Failed to save fiber splice');
			}

			// If merged, re-fetch all splices to get updated shared fiber on all ports
			// Otherwise just update the single splice
			if (isMergedOnThisSide) {
				await this.fetchFiberSplices(this.selectedStructure.uuid);
			} else {
				const serverSplice = result.data.splice;
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

			return true;
		} catch (err) {
			console.error('Error saving fiber splice:', err);
			this.fiberSplices = previousSplices;
			globalToaster.error({
				title: m.common_error(),
				description:
					err.message || m.message_error_connecting_fiber?.() || 'Failed to connect fiber'
			});
			return false;
		}
	}

	/**
	 * Handle dropping a bundle onto a port - fills sequential ports with fibers
	 * @param {number} startPort - Starting port number
	 * @param {'a'|'b'} side
	 * @param {Object} bundleData - Bundle data including fibers array
	 * @returns {Promise<boolean>} - True if any fibers were connected
	 */
	async handleBundleDrop(startPort, side, bundleData) {
		const fibers = bundleData.fibers || [];
		if (fibers.length === 0) {
			globalToaster.warning({
				title: m.common_warning?.() || 'Warning',
				description: m.message_bundle_empty?.() || 'Bundle contains no fibers'
			});
			return false;
		}

		// Sort fibers by absolute fiber number
		const sortedFibers = [...fibers].sort(
			(a, b) => a.fiber_number_absolute - b.fiber_number_absolute
		);

		// Get available ports starting from drop location
		const availablePorts = this.getAvailablePorts(side, startPort);

		if (availablePorts.length === 0) {
			globalToaster.warning({
				title: m.common_warning?.() || 'Warning',
				description: m.message_no_available_ports?.() || 'No available ports'
			});
			return false;
		}

		this.bulkOperationInProgress = true;
		const previousSplices = [...this.fiberSplices];
		let successCount = 0;
		let errorOccurred = false;

		// Connect fibers sequentially to available ports
		for (let i = 0; i < Math.min(sortedFibers.length, availablePorts.length); i++) {
			const fiber = sortedFibers[i];
			const portNumber = availablePorts[i];

			const fiberData = {
				type: 'fiber',
				uuid: fiber.uuid,
				cable_uuid: bundleData.cable_uuid,
				cable_name: bundleData.cable_name,
				bundle_number: fiber.bundle_number,
				fiber_number: fiber.fiber_number_absolute,
				fiber_color: fiber.fiber_color
			};

			// Optimistically update UI
			const fiberDetails = {
				uuid: fiber.uuid,
				fiber_number: fiber.fiber_number_absolute,
				fiber_color: fiber.fiber_color,
				bundle_number: fiber.bundle_number,
				cable_name: bundleData.cable_name
			};

			const existingSplice = this.fiberSplices.find((s) => s.port_number === portNumber);
			if (existingSplice) {
				this.fiberSplices = this.fiberSplices.map((s) => {
					if (s.port_number === portNumber) {
						return { ...s, [`fiber_${side}_details`]: fiberDetails };
					}
					return s;
				});
			} else {
				const newSplice = {
					uuid: `temp-${Date.now()}-${i}`,
					port_number: portNumber,
					fiber_a_details: side === 'a' ? fiberDetails : null,
					fiber_b_details: side === 'b' ? fiberDetails : null
				};
				this.fiberSplices = [...this.fiberSplices, newSplice];
			}

			// Make server call
			try {
				const formData = new FormData();
				formData.append('nodeStructureUuid', this.selectedStructure.uuid);
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
					throw new Error(result.data?.error || 'Failed to save fiber splice');
				}

				const serverSplice = result.data.splice;
				this.fiberSplices = this.fiberSplices.map((s) =>
					s.port_number === portNumber ? serverSplice : s
				);

				successCount++;
			} catch (err) {
				console.error('Error saving fiber splice:', err);
				errorOccurred = true;
				break; // Stop on first error
			}
		}

		this.bulkOperationInProgress = false;

		// Show result toast
		if (errorOccurred && successCount === 0) {
			this.fiberSplices = previousSplices;
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_connecting_fiber?.() || 'Failed to connect fibers'
			});
			return false;
		}

		const totalFibers = sortedFibers.length;
		if (successCount === totalFibers) {
			globalToaster.success({
				title: m.title_success(),
				description: m.message_bundle_connected({ count: successCount })
			});
		} else {
			globalToaster.warning({
				title: m.common_warning(),
				description: m.message_partial_bundle_connected({
					connected: successCount,
					total: totalFibers
				})
			});
		}

		return successCount > 0;
	}

	/**
	 * Fetch fibers for a cable
	 * @param {string} cableUuid
	 * @returns {Promise<Array<Object>>}
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
				throw new Error(result.data?.error || 'Failed to fetch fibers');
			}

			return result.data?.fibers || [];
		} catch (err) {
			console.error('Error fetching fibers for cable:', err);
			return [];
		}
	}

	/**
	 * Handle dropping a cable onto a port - fills sequential ports with all fibers
	 * Continues to subsequent components in slot order if fibers remain
	 * @param {number} startPort - Starting port number
	 * @param {'a'|'b'} side
	 * @param {Object} cableData - Cable data including fibers array
	 * @param {Array<Object>} allStructures - All structures in slot grid (for multi-component mode)
	 * @returns {Promise<boolean>} - True if any fibers were connected
	 */
	async handleCableDrop(startPort, side, cableData, allStructures = []) {
		let fibers = cableData.fibers || [];

		// If fibers not in drag data, fetch them now
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

		// Sort fibers by bundle then by fiber number (to fill sequentially)
		const sortedFibers = [...fibers].sort((a, b) => {
			if (a.bundle_number !== b.bundle_number) {
				return a.bundle_number - b.bundle_number;
			}
			return a.fiber_number_absolute - b.fiber_number_absolute;
		});

		// Get structures sorted by slot_start (components in order)
		const sortedStructures = [...allStructures]
			.filter((s) => s.component_type?.id) // Only structures with component types (have ports)
			.sort((a, b) => a.slot_start - b.slot_start);

		// Find the index of the currently selected structure
		const currentStructureIndex = sortedStructures.findIndex(
			(s) => s.uuid === this.selectedStructure?.uuid
		);

		// Build list of structures to fill (current + subsequent ones)
		const structuresToFill =
			currentStructureIndex >= 0 ? sortedStructures.slice(currentStructureIndex) : [];

		if (structuresToFill.length === 0) {
			structuresToFill.push(this.selectedStructure);
		}

		let totalSuccessCount = 0;
		let fiberIndex = 0;
		let errorOccurred = false;
		const componentsUsed = [];

		// Iterate through structures
		for (const structure of structuresToFill) {
			if (fiberIndex >= sortedFibers.length) break; // All fibers placed

			// Fetch ports for this structure if not the current one
			let ports = [];
			let splices = [];

			if (structure.uuid === this.selectedStructure?.uuid) {
				// Use current loaded data
				ports = this.componentPorts;
				splices = this.fiberSplices;
			} else {
				// Fetch ports and splices for this structure
				try {
					const portsResult = await this.#fetchPortsForStructure(structure.component_type.id);
					const splicesResult = await this.#fetchSplicessForStructure(structure.uuid);
					ports = portsResult;
					splices = splicesResult;
				} catch (err) {
					console.error('Error fetching ports for structure:', err);
					continue; // Skip this structure
				}
			}

			// Get available ports for this structure
			const availablePorts = this.#getAvailablePortsForStructure(
				ports,
				splices,
				side,
				structure.uuid === this.selectedStructure?.uuid ? startPort : 1
			);

			if (availablePorts.length === 0) continue;

			let structureSuccessCount = 0;
			const processedMergeGroups = new Set(); // Track merge groups we've already handled

			// Fill available ports with fibers
			for (const portNumber of availablePorts) {
				if (fiberIndex >= sortedFibers.length) break;

				// Check if this port is part of a merge group on this side
				const mergeGroupField = `merge_group_${side}`;
				const existingSplice = splices.find((s) => s.port_number === portNumber);
				const mergeGroupId = existingSplice?.[mergeGroupField];

				// Skip if we already processed this merge group
				if (mergeGroupId && processedMergeGroups.has(mergeGroupId)) {
					continue;
				}

				const fiber = sortedFibers[fiberIndex];

				try {
					const formData = new FormData();
					formData.append('nodeStructureUuid', structure.uuid);
					formData.append('portNumber', portNumber.toString());
					formData.append('side', side);
					formData.append('fiberUuid', fiber.uuid);
					formData.append('cableUuid', cableData.uuid);

					const response = await fetch('?/upsertFiberSplice', {
						method: 'POST',
						body: formData
					});

					const result = deserialize(await response.text());

					if (result.type === 'failure' || result.type === 'error') {
						throw new Error(result.data?.error || 'Failed to save fiber splice');
					}

					// Update local state if this is the current structure
					if (structure.uuid === this.selectedStructure?.uuid) {
						const serverSplice = result.data.splice;
						const existingSpliceIndex = this.fiberSplices.findIndex(
							(s) => s.port_number === portNumber
						);

						if (existingSpliceIndex >= 0) {
							this.fiberSplices = this.fiberSplices.map((s) =>
								s.port_number === portNumber ? serverSplice : s
							);
						} else {
							this.fiberSplices = [...this.fiberSplices, serverSplice];
						}
					}

					// Mark this merge group as processed so we skip other ports in it
					if (mergeGroupId) {
						processedMergeGroups.add(mergeGroupId);
					}

					totalSuccessCount++;
					structureSuccessCount++;
					fiberIndex++;
				} catch (err) {
					console.error('Error saving fiber splice:', err);
					errorOccurred = true;
					break;
				}
			}

			if (structureSuccessCount > 0) {
				componentsUsed.push(structure.component_type?.component_type || structure.label || '-');
			}

			if (errorOccurred) break;
		}

		// Show result toast
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
			componentsUsed.length > 1 ? ` ${m.message_component_count({ count: componentsUsed.length })}` : '';

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

		this.bulkOperationInProgress = false;
		return totalSuccessCount > 0;
	}

	/**
	 * Fetch ports for a structure (private helper)
	 * @param {number} componentTypeId
	 * @returns {Promise<Array<Object>>}
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
			throw new Error(result.data?.error || 'Failed to fetch component ports');
		}

		return result.data?.ports || [];
	}

	/**
	 * Fetch splices for a structure (private helper)
	 * @param {string} nodeStructureUuid
	 * @returns {Promise<Array<Object>>}
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
			throw new Error(result.data?.error || 'Failed to fetch fiber splices');
		}

		return result.data?.splices || [];
	}

	/**
	 * Get available ports for a specific structure (private helper)
	 * @param {Array<Object>} ports
	 * @param {Array<Object>} splices
	 * @param {'a'|'b'} side
	 * @param {number} startPort
	 * @returns {Array<number>}
	 */
	#getAvailablePortsForStructure(ports, splices, side, startPort) {
		const portType = side === 'a' ? 'in' : 'out';
		const portsOnSide = ports
			.filter((p) => p.in_or_out === portType)
			.map((p) => p.port)
			.sort((a, b) => a - b);

		const maxPort = portsOnSide.length > 0 ? Math.max(...portsOnSide) : 0;
		const available = [];

		for (let port = startPort; port <= maxPort; port++) {
			if (!portsOnSide.includes(port)) continue;

			const existingSplice = splices.find((s) => s.port_number === port);
			if (existingSplice?.[`fiber_${side}_details`]) {
				break; // Port is occupied - stop here
			}

			available.push(port);
		}

		return available;
	}

	/**
	 * Clear a fiber from a port
	 * @param {number} portNumber
	 * @param {'a'|'b'} side
	 */
	async handleClearPort(portNumber, side) {
		const previousSplices = [...this.fiberSplices];
		const existingSplice = this.fiberSplices.find((s) => s.port_number === portNumber);

		// Check if this port is merged on this side (using side-specific merge group)
		const mergeGroupField = `merge_group_${side}`;
		const mergeGroupValue = existingSplice?.[mergeGroupField];
		const isMergedOnThisSide = mergeGroupValue != null;

		// Optimistic update
		if (isMergedOnThisSide) {
			// Clear fiber on all ports in the merge group
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
				.filter(Boolean);
		}

		try {
			const formData = new FormData();
			formData.append('nodeStructureUuid', this.selectedStructure.uuid);
			formData.append('portNumber', portNumber.toString());
			formData.append('side', side);

			const response = await fetch('?/clearFiberSplice', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(result.data?.error || 'Failed to clear fiber splice');
			}

			// If merged, re-fetch all splices to ensure consistency
			if (isMergedOnThisSide) {
				await this.fetchFiberSplices(this.selectedStructure.uuid);
			}
		} catch (err) {
			console.error('Error clearing fiber splice:', err);
			this.fiberSplices = previousSplices;
			globalToaster.error({
				title: m.common_error(),
				description: err.message || 'Failed to clear fiber'
			});
		}
	}

	/**
	 * Close the port table (deselect structure)
	 */
	closePortTable() {
		this.selectedStructure = null;
		this.componentPorts = [];
		this.fiberSplices = [];
	}

	/**
	 * Check if a structure is being deleted and clear selection if needed
	 * @param {string} structureUuid
	 */
	onStructureDeleted(structureUuid) {
		if (this.selectedStructure?.uuid === structureUuid) {
			this.closePortTable();
		}
	}

	// ========== Merge/Unmerge Operations ==========

	/**
	 * Toggle merge selection mode
	 */
	toggleMergeSelectionMode() {
		this.mergeSelectionMode = !this.mergeSelectionMode;
		if (!this.mergeSelectionMode) {
			this.selectedForMerge = new Set();
		}
	}

	/**
	 * Set the merge side for selection
	 * @param {'a'|'b'} side
	 */
	setMergeSide(side) {
		if (side !== this.mergeSide) {
			this.mergeSide = side;
			// Clear selections when changing sides
			this.selectedForMerge = new Set();
		}
	}

	/**
	 * Toggle port selection for merge operation
	 * @param {number} portNumber
	 * @param {'a'|'b'} side
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
	 * Clear all merge selections
	 */
	clearMergeSelection() {
		this.selectedForMerge = new Set();
	}

	/**
	 * Merge selected ports
	 * @returns {Promise<boolean>} - True if successful
	 */
	async mergeSelectedPorts() {
		if (this.selectedForMerge.size < 2) {
			globalToaster.warning({
				title: m.common_warning?.() || 'Warning',
				description: m.message_select_at_least_two_ports?.() || 'Select at least 2 ports to merge'
			});
			return false;
		}

		// Parse selections to get port numbers and side
		const portNumbers = [];
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

		// Sort port numbers and check for contiguity
		portNumbers.sort((a, b) => a - b);
		for (let i = 1; i < portNumbers.length; i++) {
			if (portNumbers[i] !== portNumbers[i - 1] + 1) {
				globalToaster.warning({
					title: m.common_warning?.() || 'Warning',
					description:
						m.message_ports_must_be_consecutive?.() ||
						'Ports must be consecutive (e.g., 1-2-3, not 1-3)'
				});
				return false;
			}
		}

		try {
			const formData = new FormData();
			formData.append('nodeStructureUuid', this.selectedStructure.uuid);
			formData.append('portNumbers', JSON.stringify(portNumbers));
			formData.append('side', side);

			const response = await fetch('?/mergePorts', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(result.data?.error || 'Failed to merge ports');
			}

			// Refresh splices
			await this.fetchFiberSplices(this.selectedStructure.uuid);
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
				description: err.message || 'Failed to merge ports'
			});
			return false;
		}
	}

	/**
	 * Unmerge ports from a merge group
	 * @param {string} mergeGroupId
	 * @param {Array<number>} portNumbers - Specific ports to unmerge (if empty, unmerge all)
	 * @returns {Promise<boolean>} - True if successful
	 */
	async unmergePorts(mergeGroupId, portNumbers = []) {
		if (!mergeGroupId) return false;

		// If no specific ports provided, get all ports in the group
		// Check both side A and side B merge groups
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
				throw new Error(result.data?.error || 'Failed to unmerge ports');
			}

			// Refresh splices
			await this.fetchFiberSplices(this.selectedStructure.uuid);

			globalToaster.success({
				title: m.title_success?.() || 'Success',
				description: m.message_ports_unmerged?.() || 'Ports unmerged'
			});

			return true;
		} catch (err) {
			console.error('Error unmerging ports:', err);
			globalToaster.error({
				title: m.common_error(),
				description: err.message || 'Failed to unmerge ports'
			});
			return false;
		}
	}

	/**
	 * Handle drop on a merged port group
	 * @param {string} mergeGroupId
	 * @param {'a'|'b'} side
	 * @param {Object} dropData
	 * @returns {Promise<boolean>} - True if successful
	 */
	async handleMergedPortDrop(mergeGroupId, side, dropData) {
		// Find the merge group - check both side A and side B
		const mergeGroupField = `merge_group_${side}`;
		const mergeGroupInfoField = `merge_group_${side}_info`;
		let groupSplice = this.fiberSplices.find((s) => s[mergeGroupField] === mergeGroupId);

		// For single fiber, just connect to first port in group
		if (dropData.type === 'fiber') {
			const firstPort = groupSplice?.[mergeGroupInfoField]?.port_numbers?.[0];
			if (firstPort) {
				// Check if this is a move operation (drag from another port)
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

		// For bundle or cable, fill all ports in merge group
		const fibers = dropData.fibers || [];
		if (fibers.length === 0) {
			globalToaster.warning({
				title: m.common_warning?.() || 'Warning',
				description: m.message_no_fibers_to_drop?.() || 'No fibers to drop'
			});
			return false;
		}

		// Get merge group info
		const mergeInfo = groupSplice?.[mergeGroupInfoField];
		const portCount = mergeInfo?.port_count || 1;

		// Prepare fibers data for API (limit to port count)
		const fiberData = fibers.slice(0, portCount).map((f) => ({
			uuid: f.uuid,
			cable_uuid: dropData.cable_uuid || dropData.uuid
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
				throw new Error(result.data?.error || 'Failed to connect fibers');
			}

			// Refresh splices
			await this.fetchFiberSplices(this.selectedStructure.uuid);

			globalToaster.success({
				title: m.title_success(),
				description: m.message_fibers_connected_to_merged({ count: fiberData.length })
			});

			return true;
		} catch (err) {
			console.error('Error dropping on merged ports:', err);
			globalToaster.error({
				title: m.common_error(),
				description: err.message || 'Failed to connect fibers'
			});
			return false;
		}
	}

	/**
	 * Cleanup manager state
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
}
