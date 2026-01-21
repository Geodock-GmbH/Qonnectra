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
				fiberB: splice?.fiber_b_details || null
			});
		}
		return rows;
	}

	/**
	 * Select a structure and load its ports and splices
	 * @param {Object|null} structure
	 * @param {boolean} isMobile - Whether mobile mode is active
	 * @returns {Promise<boolean>} - True if structure was selected (vs deselected)
	 */
	async selectStructure(structure, isMobile = false) {
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

		const fiberDetails = {
			uuid: fiberData.uuid,
			fiber_number: fiberData.fiber_number,
			fiber_color: fiberData.fiber_color,
			bundle_number: fiberData.bundle_number,
			cable_name: fiberData.cable_name
		};

		if (existingSplice) {
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

			const serverSplice = result.data.splice;
			this.fiberSplices = this.fiberSplices.map((s) =>
				s.port_number === portNumber ? serverSplice : s
			);

			globalToaster.success({
				title: m.title_success(),
				description: m.message_fiber_connected?.() || 'Fiber connected successfully'
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
				description:
					m.message_bundle_connected?.({ count: successCount }) ||
					`Connected ${successCount} fibers`
			});
		} else {
			globalToaster.warning({
				title: m.common_warning?.() || 'Warning',
				description:
					m.message_partial_bundle_connected?.({ connected: successCount, total: totalFibers }) ||
					`Connected ${successCount} of ${totalFibers} fibers`
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

			// Fill available ports with fibers
			for (const portNumber of availablePorts) {
				if (fiberIndex >= sortedFibers.length) break;

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
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_connecting_fiber?.() || 'Failed to connect fibers'
			});
			return false;
		}

		const totalFibers = sortedFibers.length;
		const componentInfo = componentsUsed.length > 1 ? ` (${componentsUsed.length} components)` : '';

		if (totalSuccessCount === totalFibers) {
			globalToaster.success({
				title: m.title_success(),
				description:
					m.message_cable_connected?.({ count: totalSuccessCount }) ||
					`Connected ${totalSuccessCount} fibers${componentInfo}`
			});
		} else {
			globalToaster.warning({
				title: m.common_warning?.() || 'Warning',
				description:
					m.message_partial_cable_connected?.({
						connected: totalSuccessCount,
						total: totalFibers
					}) || `Connected ${totalSuccessCount} of ${totalFibers} fibers${componentInfo}`
			});
		}

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

		this.fiberSplices = this.fiberSplices
			.map((s) => {
				if (s.port_number === portNumber) {
					const updated = {
						...s,
						[`fiber_${side}_details`]: null
					};
					if (!updated.fiber_a_details && !updated.fiber_b_details) {
						return null;
					}
					return updated;
				}
				return s;
			})
			.filter(Boolean);

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

	/**
	 * Cleanup manager state
	 */
	cleanup() {
		this.selectedStructure = null;
		this.componentPorts = [];
		this.fiberSplices = [];
		this.fiberColors = [];
		this.loadingPorts = false;
	}
}
