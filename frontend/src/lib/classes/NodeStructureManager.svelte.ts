import type {
	NodeStructure,
	SharedSlotState,
	SlotConfiguration,
	SlotRow
} from './NodeStructureContext.svelte';

import { m } from '$lib/paraglide/messages';

import { globalToaster } from '$lib/stores/toaster';
import { logToBackendClient } from '$lib/utils/logToBackendClient';
import { getNodeStructures } from '$lib/remote/network-schema/containers.remote';
import {
	bulkCreateNodeStructures,
	createNodeStructure,
	createSlotDivider,
	deleteNodeStructure,
	deleteSlotDivider,
	getSlotClipNumbers,
	getSlotConfigurationsForNode,
	getSlotDividers,
	moveNodeStructure,
	upsertSlotClipNumber
} from '$lib/remote/network-schema/node-structures.remote';

export interface SlotDivider {
	uuid: string;
	slot_configuration: string | null;
	after_slot: number;
}

export interface ClipNumberEntry {
	slot_number: number;
	clip_number: string;
}

export interface ComponentData {
	id: number;
	name: string;
	occupied_slots: number;
	count?: number;
	total_slots?: number;
}

export interface StructureMoveData {
	uuid: string;
	occupied_slots: number;
}

interface FailedPlacement {
	slot_start: number;
	slot_end: number;
}

/**
 * Manager for node structure CRUD operations, dividers, and clip numbers.
 * Handles slot configuration selection and structure placement.
 */
export class NodeStructureManager {
	nodeUuid: string | null = $state(null);

	localSlotConfigurations: SlotConfiguration[] = $state([]);

	selectedSlotConfigUuid: string | null = $state(null);

	structures: NodeStructure[] = $state([]);

	dividers: SlotDivider[] = $state([]);

	clipNumbers: Map<number, string> = $state(new Map());

	loading: boolean = $state(true);

	loadingStructures: boolean = $state(false);

	creatingMultiple: boolean = $state(false);

	#sharedSlotState: SharedSlotState | null = null;

	#fetchVersion: number = 0;

	constructor(
		nodeUuid: string | null = null,
		initialSlotConfigUuid: string | null = null,
		sharedSlotState: SharedSlotState | null = null
	) {
		this.nodeUuid = nodeUuid;
		this.selectedSlotConfigUuid = initialSlotConfigUuid;
		this.#sharedSlotState = sharedSlotState;
	}

	/**
	 * Get slot configurations (from shared state if available and for current node, otherwise local)
	 */
	get slotConfigurations(): SlotConfiguration[] {
		if (
			(this.#sharedSlotState?.slotConfigurations?.length ?? 0) > 0 &&
			this.#sharedSlotState?.nodeUuid === this.nodeUuid
		) {
			return this.#sharedSlotState.slotConfigurations as SlotConfiguration[];
		}
		return this.localSlotConfigurations;
	}

	/**
	 * Get the currently selected slot configuration
	 */
	get selectedConfig(): SlotConfiguration | undefined {
		return this.slotConfigurations.find((c) => c.uuid === this.selectedSlotConfigUuid);
	}

	/**
	 * Get the container path for display
	 */
	get containerPath(): string | null {
		if (!this.selectedConfig?.container) return null;
		return this.selectedConfig.container?.display_name || null;
	}

	/**
	 * Compute which slots are occupied
	 */
	get occupiedSlots(): Map<number, string> {
		const occupied = new Map<number, string>();
		for (const s of this.structures) {
			for (let i = s.slot_start; i <= s.slot_end; i++) {
				occupied.set(i, s.uuid);
			}
		}
		return occupied;
	}

	/**
	 * Compute divider positions as a Set for fast lookup
	 */
	get dividerAfterSlots(): Set<number> {
		return new Set(this.dividers.map((d) => d.after_slot));
	}

	/**
	 * Update the shared slot state reference
	 */
	setSharedSlotState(state: SharedSlotState | null): void {
		this.#sharedSlotState = state;
	}

	/**
	 * Reset manager for a new node (when user clicks a different node)
	 */
	setNodeUuid(uuid: string, sharedSlotState: SharedSlotState | null = null): void {
		this.nodeUuid = uuid;
		this.#sharedSlotState = sharedSlotState;
		this.#fetchVersion++;
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
	 */
	selectSlotConfig(uuid: string): void {
		if (this.selectedSlotConfigUuid !== uuid) {
			this.#fetchVersion++;
		}
		this.selectedSlotConfigUuid = uuid;
	}

	/**
	 * Fetch slot configurations for the node
	 */
	async fetchSlotConfigurations(): Promise<void> {
		if (!this.nodeUuid) return;

		if (
			(this.#sharedSlotState?.slotConfigurations?.length ?? 0) > 0 &&
			this.#sharedSlotState?.nodeUuid === this.nodeUuid
		) {
			this.loading = false;
			if (!this.selectedSlotConfigUuid && this.slotConfigurations.length > 0) {
				this.selectedSlotConfigUuid = this.slotConfigurations[0].uuid;
			}
			return;
		}

		const requestVersion = this.#fetchVersion;

		this.loading = true;
		try {
			// Remote queries are cached per argument — refresh() forces a fetch so
			// re-runs after mutations don't return the stale cached value.
			const configurationsQuery = getSlotConfigurationsForNode(this.nodeUuid);
			await configurationsQuery.refresh();
			const configurations = configurationsQuery.current ?? [];

			if (this.#fetchVersion !== requestVersion) return;

			this.localSlotConfigurations = configurations as SlotConfiguration[];

			if (!this.selectedSlotConfigUuid && this.localSlotConfigurations.length > 0) {
				this.selectedSlotConfigUuid = this.localSlotConfigurations[0].uuid;
			}
		} catch (err: unknown) {
			if (this.#fetchVersion !== requestVersion) return;
			console.error('Error fetching slot configurations:', err);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error fetching slot configurations',
				extraData: {
					from: 'NodeStructureManager.fetchSlotConfigurations',
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_fetching_slot_configurations()
			});
			this.localSlotConfigurations = [];
		} finally {
			if (this.#fetchVersion === requestVersion) {
				this.loading = false;
			}
		}
	}

	/**
	 * Fetch structures for the selected slot configuration
	 */
	async fetchStructures(): Promise<void> {
		if (!this.selectedSlotConfigUuid) {
			this.structures = [];
			return;
		}

		const requestVersion = this.#fetchVersion;

		this.loadingStructures = true;
		try {
			const structuresQuery = getNodeStructures(this.selectedSlotConfigUuid);
			await structuresQuery.refresh();
			const structures = structuresQuery.current ?? [];

			if (this.#fetchVersion !== requestVersion) return;

			this.structures = structures as unknown as NodeStructure[];
		} catch (err: unknown) {
			if (this.#fetchVersion !== requestVersion) return;
			console.error('Error fetching structures:', err);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error fetching structures',
				extraData: {
					from: 'NodeStructureManager.fetchStructures',
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_fetching_structures()
			});
			this.structures = [];
		} finally {
			if (this.#fetchVersion === requestVersion) {
				this.loadingStructures = false;
			}
		}
	}

	/**
	 * Fetch dividers for the selected slot configuration
	 */
	async fetchDividers(): Promise<void> {
		if (!this.selectedSlotConfigUuid) {
			this.dividers = [];
			return;
		}

		const requestVersion = this.#fetchVersion;

		try {
			const dividersQuery = getSlotDividers(this.selectedSlotConfigUuid);
			await dividersQuery.refresh();
			const dividers = dividersQuery.current ?? [];

			if (this.#fetchVersion !== requestVersion) return;

			this.dividers = dividers;
		} catch (err: unknown) {
			if (this.#fetchVersion !== requestVersion) return;
			console.error('Error fetching dividers:', err);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error fetching dividers',
				extraData: {
					from: 'NodeStructureManager.fetchDividers',
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
			this.dividers = [];
		}
	}

	/**
	 * Fetch clip numbers for the selected slot configuration
	 */
	async fetchClipNumbers(): Promise<void> {
		if (!this.selectedSlotConfigUuid) {
			this.clipNumbers = new Map();
			return;
		}

		const requestVersion = this.#fetchVersion;

		try {
			const clipsQuery = getSlotClipNumbers(this.selectedSlotConfigUuid);
			await clipsQuery.refresh();
			const clips = clipsQuery.current ?? [];

			if (this.#fetchVersion !== requestVersion) return;

			const newMap = new Map<number, string>();
			for (const clip of clips) {
				newMap.set(clip.slot_number, clip.clip_number);
			}
			this.clipNumbers = newMap;
		} catch (err: unknown) {
			if (this.#fetchVersion !== requestVersion) return;
			console.error('Error fetching clip numbers:', err);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error fetching clip numbers',
				extraData: {
					from: 'NodeStructureManager.fetchClipNumbers',
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
			this.clipNumbers = new Map();
		}
	}

	/**
	 * Fetch all data for the selected slot configuration
	 */
	async fetchAllForSlotConfig(): Promise<void> {
		await Promise.all([this.fetchStructures(), this.fetchDividers(), this.fetchClipNumbers()]);
	}

	/**
	 * Create a new structure
	 */
	async createStructure(componentData: ComponentData, slotStart: number): Promise<void> {
		const slotEnd = slotStart + componentData.occupied_slots - 1;

		if (!this.selectedConfig || slotEnd > this.selectedConfig.total_slots) {
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
		const optimisticStructure: NodeStructure = {
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
			const structure = await createNodeStructure({
				nodeUuid: this.nodeUuid as string,
				slotConfigUuid: this.selectedSlotConfigUuid as string,
				componentTypeId: componentData.id,
				slotStart,
				slotEnd,
				purpose: 'component'
			});

			this.structures = this.structures.map((s) => (s.uuid === tempUuid ? structure : s));

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_placing_component()
			});
		} catch (err: unknown) {
			this.structures = this.structures.filter((s) => s.uuid !== tempUuid);
			throw err;
		}
	}

	/**
	 * Create multiple structures at consecutive slots
	 */
	async createMultipleStructures(componentData: ComponentData, slotStart: number): Promise<void> {
		const singleSlots = componentData.occupied_slots;
		const count = componentData.count || 1;
		const totalSlotsNeeded = componentData.total_slots || singleSlots * count;
		const slotEnd = slotStart + totalSlotsNeeded - 1;

		if (!this.selectedConfig || slotEnd > this.selectedConfig.total_slots) {
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

		const tempStructures: NodeStructure[] = [];
		for (let c = 0; c < count; c++) {
			const compSlotStart = slotStart + c * singleSlots;
			const compSlotEnd = compSlotStart + singleSlots - 1;
			const tempUuid = `temp-${Date.now()}-${c}`;
			tempStructures.push({
				uuid: tempUuid,
				slot_start: compSlotStart,
				slot_end: compSlotEnd,
				component_type: { id: componentData.id, component_type: componentData.name },
				component_structure: null,
				purpose: 'component',
				label: null
			});
		}
		this.structures = [...this.structures, ...tempStructures];
		this.creatingMultiple = true;

		try {
			const result = await bulkCreateNodeStructures({
				nodeUuid: this.nodeUuid as string,
				slotConfigUuid: this.selectedSlotConfigUuid as string,
				componentTypeId: componentData.id,
				slotStart,
				count,
				occupiedSlotsPerComponent: singleSlots
			});

			const created = result.created;
			const failed = result.failed as FailedPlacement[];

			this.structures = this.structures.filter((s) => !s.uuid.startsWith('temp-')).concat(created);

			if (failed.length === 0) {
				globalToaster.success({
					title: m.title_success(),
					description: m.message_success_placing_components({ count: created.length })
				});
			} else if (created.length > 0) {
				const failedSlots = failed.map((f) => `${f.slot_start}-${f.slot_end}`).join(', ');
				globalToaster.warning({
					title: m.title_success(),
					description: `${m.message_success_placing_components({ count: created.length })}. Failed: ${failedSlots}`
				});
			} else {
				const failedSlots = failed.map((f) => `${f.slot_start}-${f.slot_end}`).join(', ');
				throw new Error(`All placements failed: ${failedSlots}`);
			}
		} catch (err: unknown) {
			this.structures = this.structures.filter((s) => !s.uuid.startsWith('temp-'));
			throw err;
		} finally {
			this.creatingMultiple = false;
		}
	}

	/**
	 * Move an existing structure to a new slot
	 */
	async moveStructure(structureData: StructureMoveData, newSlotStart: number): Promise<void> {
		const slotCount = structureData.occupied_slots;
		const newSlotEnd = newSlotStart + slotCount - 1;

		if (!this.selectedConfig || newSlotEnd > this.selectedConfig.total_slots) {
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
			const structure = await moveNodeStructure({
				structureUuid: structureData.uuid,
				slotStart: newSlotStart
			});

			this.structures = this.structures.map((s) => (s.uuid === structureData.uuid ? structure : s));

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_moving_component()
			});
		} catch (err: unknown) {
			this.structures = previousStructures;
			throw err;
		}
	}

	/**
	 * Delete a structure
	 */
	async deleteStructure(structureUuid: string): Promise<boolean> {
		const previousStructures = [...this.structures];
		this.structures = this.structures.filter((s) => s.uuid !== structureUuid);

		try {
			await deleteNodeStructure(structureUuid);

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_deleting_structure()
			});
			return true;
		} catch (err: unknown) {
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
	 */
	async toggleDivider(slotNumber: number): Promise<void> {
		const existingDivider = this.dividers.find((d) => d.after_slot === slotNumber);

		if (existingDivider) {
			const previousDividers = [...this.dividers];
			this.dividers = this.dividers.filter((d) => d.uuid !== existingDivider.uuid);

			try {
				await deleteSlotDivider(existingDivider.uuid);
			} catch (err: unknown) {
				console.error('Error deleting divider:', err);
				void logToBackendClient({
					level: 'ERROR',
					message: 'Error deleting divider',
					extraData: {
						from: 'NodeStructureManager.toggleDivider',
						error: err instanceof Error ? err.message : String(err),
						stack: err instanceof Error ? err.stack : undefined
					}
				});
				this.dividers = previousDividers;
				globalToaster.error({
					title: m.common_error(),
					description: m.message_error_deleting_divider()
				});
			}
		} else {
			const tempUuid = `temp-${Date.now()}`;
			const optimisticDivider: SlotDivider = {
				uuid: tempUuid,
				slot_configuration: this.selectedSlotConfigUuid,
				after_slot: slotNumber
			};
			this.dividers = [...this.dividers, optimisticDivider];

			try {
				const divider = await createSlotDivider({
					slotConfigUuid: this.selectedSlotConfigUuid as string,
					afterSlot: slotNumber
				});

				this.dividers = this.dividers.map((d) => (d.uuid === tempUuid ? divider : d));
			} catch (err: unknown) {
				console.error('Error creating divider:', err);
				void logToBackendClient({
					level: 'ERROR',
					message: 'Error creating divider',
					extraData: {
						from: 'NodeStructureManager.toggleDivider',
						error: err instanceof Error ? err.message : String(err),
						stack: err instanceof Error ? err.stack : undefined
					}
				});
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
	 */
	async saveClipNumber(slotNumber: number, clipNumber: string): Promise<void> {
		const newClipNumber = clipNumber.trim();
		if (!newClipNumber) return;

		const previousClipNumbers = new Map(this.clipNumbers);
		this.clipNumbers.set(slotNumber, newClipNumber);
		this.clipNumbers = new Map(this.clipNumbers);

		try {
			await upsertSlotClipNumber({
				slotConfigUuid: this.selectedSlotConfigUuid as string,
				slotNumber,
				clipNumber: newClipNumber
			});
		} catch (err: unknown) {
			console.error('Error saving clip number:', err);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error saving clip number',
				extraData: {
					from: 'NodeStructureManager.saveClipNumber',
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
			this.clipNumbers = previousClipNumbers;
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_saving_clip_number()
			});
		}
	}

	/**
	 * Compute slot rows for rendering
	 */
	computeSlotRows(): SlotRow[] {
		if (!this.selectedConfig) return [];

		const rows: SlotRow[] = [];
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
	 */
	syncWithSharedState(sharedState: SharedSlotState | null): void {
		if (!sharedState) return;

		if (sharedState.nodeUuid !== this.nodeUuid) return;

		this.#sharedSlotState = sharedState;
		this.loading = false;

		const currentConfigStillExists = sharedState.slotConfigurations?.some(
			(c) => c.uuid === this.selectedSlotConfigUuid
		);

		if (!currentConfigStillExists && (sharedState.slotConfigurations?.length ?? 0) > 0) {
			this.selectedSlotConfigUuid = (sharedState.slotConfigurations as SlotConfiguration[])[0].uuid;
		} else if (!this.selectedSlotConfigUuid && (sharedState.slotConfigurations?.length ?? 0) > 0) {
			this.selectedSlotConfigUuid = (sharedState.slotConfigurations as SlotConfiguration[])[0].uuid;
		}
	}

	/**
	 * Cleanup manager state
	 */
	cleanup(): void {
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
