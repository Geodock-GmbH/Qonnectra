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
	 * Handle dropping a fiber onto a port
	 * @param {number} portNumber
	 * @param {'a'|'b'} side
	 * @param {Object} fiberData
	 * @returns {Promise<boolean>} - True if successful
	 */
	async handlePortDrop(portNumber, side, fiberData) {
		if (fiberData.type !== 'fiber') {
			globalToaster.warning({
				title: m.common_warning?.() || 'Warning',
				description:
					m.message_only_fibers_allowed?.() || 'Only individual fibers can be connected to ports'
			});
			return false;
		}

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
