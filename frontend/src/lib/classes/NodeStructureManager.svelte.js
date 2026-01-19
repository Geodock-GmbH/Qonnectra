import { deserialize } from '$app/forms';

import { m } from '$lib/paraglide/messages';

import { globalToaster } from '$lib/stores/toaster';

/**
 * Manager for node structure CRUD operations, dividers, and clip numbers.
 * Handles slot configuration selection and structure placement.
 */
export class NodeStructureManager {
	/** @type {string|null} */
	nodeUuid = $state(null);

	/** @type {Array<Object>} */
	localSlotConfigurations = $state([]);

	/** @type {string|null} */
	selectedSlotConfigUuid = $state(null);

	/** @type {Array<Object>} */
	structures = $state([]);

	/** @type {Array<Object>} */
	dividers = $state([]);

	/** @type {Map<number, string>} */
	clipNumbers = $state(new Map());

	/** @type {boolean} */
	loading = $state(true);

	/** @type {boolean} */
	loadingStructures = $state(false);

	/** @type {Object|null} - Shared state from parent for slot configurations */
	#sharedSlotState = null;

	/**
	 * @param {string|null} nodeUuid - Node UUID
	 * @param {string|null} initialSlotConfigUuid - Initial slot config selection
	 * @param {Object|null} sharedSlotState - Optional shared state from parent
	 */
	constructor(nodeUuid = null, initialSlotConfigUuid = null, sharedSlotState = null) {
		this.nodeUuid = nodeUuid;
		this.selectedSlotConfigUuid = initialSlotConfigUuid;
		this.#sharedSlotState = sharedSlotState;
	}

	/**
	 * Get slot configurations (from shared state if available, otherwise local)
	 * @returns {Array<Object>}
	 */
	get slotConfigurations() {
		if (this.#sharedSlotState?.slotConfigurations?.length > 0) {
			return this.#sharedSlotState.slotConfigurations;
		}
		return this.localSlotConfigurations;
	}

	/**
	 * Get the currently selected slot configuration
	 * @returns {Object|undefined}
	 */
	get selectedConfig() {
		return this.slotConfigurations.find((c) => c.uuid === this.selectedSlotConfigUuid);
	}

	/**
	 * Get the container path for display
	 * @returns {string|null}
	 */
	get containerPath() {
		if (!this.selectedConfig?.container) return null;
		return this.selectedConfig.container?.display_name || null;
	}

	/**
	 * Compute which slots are occupied
	 * @returns {Map<number, string>}
	 */
	get occupiedSlots() {
		const occupied = new Map();
		for (const s of this.structures) {
			for (let i = s.slot_start; i <= s.slot_end; i++) {
				occupied.set(i, s.uuid);
			}
		}
		return occupied;
	}

	/**
	 * Compute divider positions as a Set for fast lookup
	 * @returns {Set<number>}
	 */
	get dividerAfterSlots() {
		return new Set(this.dividers.map((d) => d.after_slot));
	}

	/**
	 * Update the shared slot state reference
	 * @param {Object|null} state
	 */
	setSharedSlotState(state) {
		this.#sharedSlotState = state;
	}

	/**
	 * Reset manager for a new node (when user clicks a different node)
	 * @param {string} uuid - New node UUID
	 * @param {Object|null} sharedSlotState - Optional shared state from parent
	 */
	setNodeUuid(uuid, sharedSlotState = null) {
		this.nodeUuid = uuid;
		this.#sharedSlotState = sharedSlotState;
		this.localSlotConfigurations = [];
		this.selectedSlotConfigUuid = null;
		this.structures = [];
		this.dividers = [];
		this.clipNumbers = new Map();
		this.loading = true;
		this.loadingStructures = false;
	}

	/**
	 * Update the selected slot configuration UUID
	 * @param {string} uuid
	 */
	selectSlotConfig(uuid) {
		this.selectedSlotConfigUuid = uuid;
	}

	/**
	 * Fetch slot configurations for the node
	 */
	async fetchSlotConfigurations() {
		if (!this.nodeUuid) return;

		if (this.#sharedSlotState?.slotConfigurations?.length > 0) {
			this.loading = false;
			if (!this.selectedSlotConfigUuid && this.slotConfigurations.length > 0) {
				this.selectedSlotConfigUuid = this.slotConfigurations[0].uuid;
			}
			return;
		}

		this.loading = true;
		try {
			const formData = new FormData();
			formData.append('nodeUuid', this.nodeUuid);

			const response = await fetch('?/getSlotConfigurationsForNode', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(result.data?.error || 'Failed to fetch slot configurations');
			}

			this.localSlotConfigurations = result.data?.configurations || [];

			if (!this.selectedSlotConfigUuid && this.localSlotConfigurations.length > 0) {
				this.selectedSlotConfigUuid = this.localSlotConfigurations[0].uuid;
			}
		} catch (err) {
			console.error('Error fetching slot configurations:', err);
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_fetching_slot_configurations()
			});
			this.localSlotConfigurations = [];
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Fetch structures for the selected slot configuration
	 */
	async fetchStructures() {
		if (!this.selectedSlotConfigUuid) {
			this.structures = [];
			return;
		}

		this.loadingStructures = true;
		try {
			const formData = new FormData();
			formData.append('slotConfigUuid', this.selectedSlotConfigUuid);

			const response = await fetch('?/getNodeStructures', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(result.data?.error || 'Failed to fetch structures');
			}

			this.structures = result.data?.structures || [];
		} catch (err) {
			console.error('Error fetching structures:', err);
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_fetching_structures()
			});
			this.structures = [];
		} finally {
			this.loadingStructures = false;
		}
	}

	/**
	 * Fetch dividers for the selected slot configuration
	 */
	async fetchDividers() {
		if (!this.selectedSlotConfigUuid) {
			this.dividers = [];
			return;
		}

		try {
			const formData = new FormData();
			formData.append('slotConfigUuid', this.selectedSlotConfigUuid);

			const response = await fetch('?/getSlotDividers', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(result.data?.error || 'Failed to fetch dividers');
			}

			this.dividers = result.data?.dividers || [];
		} catch (err) {
			console.error('Error fetching dividers:', err);
			this.dividers = [];
		}
	}

	/**
	 * Fetch clip numbers for the selected slot configuration
	 */
	async fetchClipNumbers() {
		if (!this.selectedSlotConfigUuid) {
			this.clipNumbers = new Map();
			return;
		}

		try {
			const formData = new FormData();
			formData.append('slotConfigUuid', this.selectedSlotConfigUuid);

			const response = await fetch('?/getSlotClipNumbers', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(result.data?.error || 'Failed to fetch clip numbers');
			}

			const clips = result.data?.clipNumbers || [];
			const newMap = new Map();
			for (const clip of clips) {
				newMap.set(clip.slot_number, clip.clip_number);
			}
			this.clipNumbers = newMap;
		} catch (err) {
			console.error('Error fetching clip numbers:', err);
			this.clipNumbers = new Map();
		}
	}

	/**
	 * Fetch all data for the selected slot configuration
	 */
	async fetchAllForSlotConfig() {
		await Promise.all([this.fetchStructures(), this.fetchDividers(), this.fetchClipNumbers()]);
	}

	/**
	 * Create a new structure
	 * @param {Object} componentData - Component type data
	 * @param {number} slotStart - Starting slot number
	 */
	async createStructure(componentData, slotStart) {
		const slotEnd = slotStart + componentData.occupied_slots - 1;

		if (slotEnd > this.selectedConfig.total_slots) {
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_not_enough_slots()
			});
			return;
		}

		for (let i = slotStart; i <= slotEnd; i++) {
			if (this.occupiedSlots.has(i)) {
				globalToaster.error({
					title: m.common_error(),
					description: m.message_error_slots_occupied()
				});
				return;
			}
		}

		const tempUuid = `temp-${Date.now()}`;
		const optimisticStructure = {
			uuid: tempUuid,
			slot_start: slotStart,
			slot_end: slotEnd,
			component_type: { id: componentData.id, component_type: componentData.name },
			component_structure: null,
			purpose: 'component',
			label: null
		};
		this.structures = [...this.structures, optimisticStructure];

		try {
			const formData = new FormData();
			formData.append('nodeUuid', this.nodeUuid);
			formData.append('slotConfigUuid', this.selectedSlotConfigUuid);
			formData.append('componentTypeId', componentData.id.toString());
			formData.append('slotStart', slotStart.toString());
			formData.append('slotEnd', slotEnd.toString());
			formData.append('purpose', 'component');

			const response = await fetch('?/createNodeStructure', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(result.data?.error || 'Failed to create structure');
			}

			this.structures = this.structures.map((s) =>
				s.uuid === tempUuid ? result.data.structure : s
			);

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_placing_component()
			});
		} catch (err) {
			this.structures = this.structures.filter((s) => s.uuid !== tempUuid);
			throw err;
		}
	}

	/**
	 * Move an existing structure to a new slot
	 * @param {Object} structureData - Structure data with uuid and occupied_slots
	 * @param {number} newSlotStart - New starting slot number
	 */
	async moveStructure(structureData, newSlotStart) {
		const slotCount = structureData.occupied_slots;
		const newSlotEnd = newSlotStart + slotCount - 1;

		if (newSlotEnd > this.selectedConfig.total_slots) {
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_not_enough_slots()
			});
			return;
		}

		for (let i = newSlotStart; i <= newSlotEnd; i++) {
			const occupyingUuid = this.occupiedSlots.get(i);
			if (occupyingUuid && occupyingUuid !== structureData.uuid) {
				globalToaster.error({
					title: m.common_error(),
					description: m.message_error_slots_occupied()
				});
				return;
			}
		}

		const previousStructures = [...this.structures];
		this.structures = this.structures.map((s) => {
			if (s.uuid === structureData.uuid) {
				return { ...s, slot_start: newSlotStart, slot_end: newSlotEnd };
			}
			return s;
		});

		try {
			const formData = new FormData();
			formData.append('structureUuid', structureData.uuid);
			formData.append('slotStart', newSlotStart.toString());

			const response = await fetch('?/moveNodeStructure', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(result.data?.error || 'Failed to move structure');
			}

			this.structures = this.structures.map((s) =>
				s.uuid === structureData.uuid ? result.data.structure : s
			);

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_moving_component()
			});
		} catch (err) {
			this.structures = previousStructures;
			throw err;
		}
	}

	/**
	 * Delete a structure
	 * @param {string} structureUuid
	 * @returns {boolean} - True if deletion was successful
	 */
	async deleteStructure(structureUuid) {
		const previousStructures = [...this.structures];
		this.structures = this.structures.filter((s) => s.uuid !== structureUuid);

		try {
			const formData = new FormData();
			formData.append('structureUuid', structureUuid);

			const response = await fetch('?/deleteNodeStructure', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(result.data?.error || 'Failed to delete structure');
			}

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_deleting_structure()
			});
			return true;
		} catch (err) {
			this.structures = previousStructures;
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_deleting_structure()
			});
			return false;
		}
	}

	/**
	 * Toggle a divider after a slot
	 * @param {number} slotNumber
	 */
	async toggleDivider(slotNumber) {
		const existingDivider = this.dividers.find((d) => d.after_slot === slotNumber);

		if (existingDivider) {
			const previousDividers = [...this.dividers];
			this.dividers = this.dividers.filter((d) => d.uuid !== existingDivider.uuid);

			try {
				const formData = new FormData();
				formData.append('dividerUuid', existingDivider.uuid);

				const response = await fetch('?/deleteSlotDivider', {
					method: 'POST',
					body: formData
				});

				const result = deserialize(await response.text());

				if (result.type === 'failure' || result.type === 'error') {
					throw new Error(result.data?.error || 'Failed to delete divider');
				}
			} catch (err) {
				console.error('Error deleting divider:', err);
				this.dividers = previousDividers;
				globalToaster.error({
					title: m.common_error(),
					description: m.message_error_deleting_divider()
				});
			}
		} else {
			const tempUuid = `temp-${Date.now()}`;
			const optimisticDivider = {
				uuid: tempUuid,
				slot_configuration: this.selectedSlotConfigUuid,
				after_slot: slotNumber
			};
			this.dividers = [...this.dividers, optimisticDivider];

			try {
				const formData = new FormData();
				formData.append('slotConfigUuid', this.selectedSlotConfigUuid);
				formData.append('afterSlot', slotNumber.toString());

				const response = await fetch('?/createSlotDivider', {
					method: 'POST',
					body: formData
				});

				const result = deserialize(await response.text());

				if (result.type === 'failure' || result.type === 'error') {
					throw new Error(result.data?.error || 'Failed to create divider');
				}

				this.dividers = this.dividers.map((d) => (d.uuid === tempUuid ? result.data.divider : d));
			} catch (err) {
				console.error('Error creating divider:', err);
				this.dividers = this.dividers.filter((d) => d.uuid !== tempUuid);
				globalToaster.error({
					title: m.common_error(),
					description: m.message_error_creating_divider()
				});
			}
		}
	}

	/**
	 * Save a clip number for a slot
	 * @param {number} slotNumber
	 * @param {string} clipNumber
	 */
	async saveClipNumber(slotNumber, clipNumber) {
		const newClipNumber = clipNumber.trim();
		if (!newClipNumber) return;

		const previousClipNumbers = new Map(this.clipNumbers);
		this.clipNumbers.set(slotNumber, newClipNumber);
		this.clipNumbers = new Map(this.clipNumbers);

		try {
			const formData = new FormData();
			formData.append('slotConfigUuid', this.selectedSlotConfigUuid);
			formData.append('slotNumber', slotNumber.toString());
			formData.append('clipNumber', newClipNumber);

			const response = await fetch('?/upsertSlotClipNumber', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(result.data?.error || 'Failed to save clip number');
			}
		} catch (err) {
			console.error('Error saving clip number:', err);
			this.clipNumbers = previousClipNumbers;
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_saving_clip_number()
			});
		}
	}

	/**
	 * Compute slot rows for rendering
	 * @returns {Array<Object>}
	 */
	computeSlotRows() {
		if (!this.selectedConfig) return [];

		const rows = [];
		for (let slot = 1; slot <= this.selectedConfig.total_slots; slot++) {
			const structure = this.structures.find((s) => s.slot_start <= slot && s.slot_end >= slot);
			rows.push({
				slotNumber: slot,
				structure,
				isBlockStart: structure?.slot_start === slot,
				blockSize: structure ? structure.slot_end - structure.slot_start + 1 : 0,
				isOccupied: this.occupiedSlots.has(slot),
				hasDividerAfter: this.dividerAfterSlots.has(slot),
				clipNumber: this.clipNumbers.get(slot) || null
			});
		}
		return rows;
	}

	/**
	 * Handle shared slot state updates
	 * @param {Object|null} sharedState
	 */
	syncWithSharedState(sharedState) {
		if (!sharedState) return;

		this.#sharedSlotState = sharedState;
		this.loading = false;

		const currentConfigStillExists = sharedState.slotConfigurations?.some(
			(c) => c.uuid === this.selectedSlotConfigUuid
		);

		if (!currentConfigStillExists && sharedState.slotConfigurations?.length > 0) {
			this.selectedSlotConfigUuid = sharedState.slotConfigurations[0].uuid;
		} else if (!this.selectedSlotConfigUuid && sharedState.slotConfigurations?.length > 0) {
			this.selectedSlotConfigUuid = sharedState.slotConfigurations[0].uuid;
		}
	}

	/**
	 * Cleanup manager state
	 */
	cleanup() {
		this.nodeUuid = null;
		this.localSlotConfigurations = [];
		this.selectedSlotConfigUuid = null;
		this.structures = [];
		this.dividers = [];
		this.clipNumbers = new Map();
		this.loading = false;
		this.loadingStructures = false;
		this.#sharedSlotState = null;
	}
}
