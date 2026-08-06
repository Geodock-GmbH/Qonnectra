import { deserialize } from '$app/forms';

import { m } from '$lib/paraglide/messages';

import { globalToaster } from '$lib/stores/toaster';
import { logToBackendClient } from '$lib/utils/logToBackendClient';

import { DRAG_DROP_CONTEXT_KEY, DragDropManager } from './DragDropManager.svelte';
import { FiberSpliceManager } from './FiberSpliceManager.svelte';
import { NodeStructureManager } from './NodeStructureManager.svelte';

export { DRAG_DROP_CONTEXT_KEY };

export interface SharedSlotState {
	nodeUuid: string;
	slotConfigurations: SlotConfiguration[];
}

export interface NodeStructureContextOptions {
	initialSlotConfigUuid?: string | null;
	sharedSlotState?: SharedSlotState | null;
}

export interface SlotConfiguration {
	uuid: string;
	side?: string;
	total_slots: number;
	container?: { display_name?: string } | null;
}

export interface NodeStructure {
	uuid: string;
	slot_start: number;
	slot_end: number;
	component_type: { id: number; component_type?: string } | null;
	component_type_name?: string;
	component_structure?: unknown;
	purpose?: string;
	label?: string | null;
}

export interface SlotRow {
	slotNumber: number;
	structure: NodeStructure | undefined;
	isBlockStart: boolean;
	blockSize: number;
	isOccupied: boolean;
	hasDividerAfter: boolean;
	clipNumber: string | null;
	isDropTarget?: boolean;
}

export interface DropData {
	type: string;
	uuid?: string;
	id?: number;
	name?: string;
	occupied_slots?: number;
	slot_start?: number;
	slot_end?: number;
	count?: number;
	total_slots?: number;
}

export interface DeleteResult {
	needsConfirmation: boolean;
	spliceCount: number;
	structureUuid?: string;
}

interface FiberSplice {
	port_number: number;
	fiber_a_details?: Record<string, unknown> | null;
	fiber_b_details?: Record<string, unknown> | null;
}

/** Context key for NodeStructureContext */
export const NODE_STRUCTURE_CONTEXT_KEY = 'nodeStructureContext';

/**
 * Unified context for node structure operations.
 * Coordinates NodeStructureManager, FiberSpliceManager, and DragDropManager.
 *
 * Benefits:
 * - Single entry point for all node structure state
 * - Coordinated initialization and cleanup
 * - Action handlers grouped by domain for easy extension/removal
 */
export class NodeStructureContext {
	// ========== Sub-Managers (Encapsulated) ==========

	#structureManager: NodeStructureManager;

	#spliceManager: FiberSpliceManager;

	#dragDropManager: DragDropManager;

	// ========== UI State ==========

	editingClipSlot: number | null = $state(null);

	editingClipValue: string = $state('');

	isMobile: boolean = $state(false);

	// ========== Constructor ==========

	/**
	 * @param nodeUuid - Node UUID (optional, can be set later via setNodeUuid)
	 * @param options - Configuration options
	 */
	constructor(nodeUuid: string | null = null, options: NodeStructureContextOptions = {}) {
		this.#structureManager = new NodeStructureManager(
			nodeUuid,
			options.initialSlotConfigUuid,
			options.sharedSlotState
		);
		this.#spliceManager = new FiberSpliceManager();
		this.#dragDropManager = new DragDropManager();
	}

	/**
	 * Set the initial slot configuration UUID
	 * @param uuid - Slot configuration UUID to select
	 */
	setInitialSlotConfigUuid(uuid: string): void {
		this.#structureManager.selectSlotConfig(uuid);
	}

	// ========== Exposed State (Read-Only via Getters) ==========

	// --- Structure Manager State ---
	get nodeUuid() {
		return this.#structureManager.nodeUuid;
	}

	get slotConfigurations() {
		return this.#structureManager.slotConfigurations;
	}

	get selectedSlotConfigUuid() {
		return this.#structureManager.selectedSlotConfigUuid;
	}

	get selectedConfig() {
		return this.#structureManager.selectedConfig;
	}

	get containerPath() {
		return this.#structureManager.containerPath;
	}

	get structures() {
		return this.#structureManager.structures;
	}

	get occupiedSlots() {
		return this.#structureManager.occupiedSlots;
	}

	get loading() {
		return this.#structureManager.loading;
	}

	get loadingStructures() {
		return this.#structureManager.loadingStructures;
	}

	get creatingMultiple() {
		return this.#structureManager.creatingMultiple;
	}

	// --- Splice Manager State ---
	get selectedStructure() {
		return this.#spliceManager.selectedStructure;
	}

	get portRowsWithMerge() {
		return this.#spliceManager.portRowsWithMerge;
	}

	get fiberColors() {
		return this.#spliceManager.fiberColors;
	}

	get loadingPorts() {
		return this.#spliceManager.loadingPorts;
	}

	get mergeSelectionMode() {
		return this.#spliceManager.mergeSelectionMode;
	}

	get selectedForMerge() {
		return this.#spliceManager.selectedForMerge;
	}

	get mergeSide() {
		return this.#spliceManager.mergeSide;
	}

	// --- Drag Drop Manager State ---
	get isDragging() {
		return this.#dragDropManager.isDragging;
	}

	get draggedItem() {
		return this.#dragDropManager.draggedItem;
	}

	get dropPreviewSlots() {
		return this.#dragDropManager.dropPreviewSlots;
	}

	set dropPreviewSlots(value: number[]) {
		this.#dragDropManager.dropPreviewSlots = value;
	}

	get componentRanges() {
		return this.#dragDropManager.componentRanges;
	}

	get mobileSelectedItem() {
		return this.#dragDropManager.mobileSelectedItem;
	}

	// ========== Computed State ==========

	/**
	 * Compute slot rows for rendering with drop preview info
	 */
	computeSlotRows(): SlotRow[] {
		const baseRows = this.#structureManager.computeSlotRows();
		return baseRows.map((row) => ({
			...row,
			isDropTarget: this.#dragDropManager.dropPreviewSlots.includes(row.slotNumber)
		}));
	}

	// ========== Action Handlers ==========

	/**
	 * Slot-related actions (drop, drag over, tap)
	 */
	get slotActions() {
		return {
			onDragOver: (e: DragEvent, slotNumber: number) => this.#handleSlotDragOver(e, slotNumber),
			onDrop: (e: DragEvent, slotNumber: number) => this.#handleSlotDrop(e, slotNumber),
			onTap: (slotNumber: number) => this.#handleMobileSlotTap(slotNumber)
		};
	}

	/**
	 * Structure-related actions (select, delete, drag)
	 */
	get structureActions() {
		return {
			onSelect: (structure: NodeStructure) => this.#handleStructureSelect(structure),
			onDelete: (uuid: string) => this.#handleDeleteStructure(uuid),
			onDragStart: (e: DragEvent, structure: NodeStructure) =>
				this.#dragDropManager.startStructureDrag(e, structure),
			onDragEnd: () => this.#dragDropManager.endDrag()
		};
	}

	/**
	 * Clip number editing actions
	 */
	get clipActions() {
		return {
			onStartEditing: (slotNumber: number, currentValue: string | null) => {
				this.editingClipSlot = slotNumber;
				this.editingClipValue = currentValue || String(slotNumber);
			},
			onSave: () => this.#saveClipNumber(),
			onKeydown: (e: KeyboardEvent) => this.#handleClipKeydown(e)
		};
	}

	/**
	 * Divider toggle action
	 */
	get dividerActions() {
		return {
			onToggle: (slotNumber: number) => this.#structureManager.toggleDivider(slotNumber)
		};
	}

	/**
	 * Port-related actions (drop, clear, merge operations)
	 */
	get portActions() {
		return {
			onDrop: (portNumber: number, side: 'a' | 'b', dropData: DropData) =>
				this.#handlePortDrop(portNumber, side, dropData),
			onClear: (portNumber: number, side: 'a' | 'b') =>
				this.#spliceManager.handleClearPort(portNumber, side),
			onClose: () => this.#spliceManager.closePortTable(),
			onToggleMergeMode: () => this.#spliceManager.toggleMergeSelectionMode(),
			onTogglePortSelection: (portNumber: number, side: 'a' | 'b') =>
				this.#spliceManager.togglePortSelection(portNumber, side),
			onMergePorts: () => this.#spliceManager.mergeSelectedPorts(),
			onUnmergePorts: (mergeGroupId: string) => this.#spliceManager.unmergePorts(mergeGroupId),
			onMergedPortDrop: (mergeGroupId: string, side: 'a' | 'b', data: DropData) =>
				this.#spliceManager.handleMergedPortDrop(mergeGroupId, side, data as never),
			onSetMergeSide: (side: 'a' | 'b') => this.#spliceManager.setMergeSide(side)
		};
	}

	/**
	 * Sidebar drag actions (for ComponentTypeSidebar)
	 */
	get sidebarActions() {
		return {
			onDragStart: (componentType: {
				id: number;
				component_type: string;
				occupied_slots: number;
			}) => this.#dragDropManager.startComponentDrag(componentType),
			onDragEnd: () => this.#dragDropManager.endDrag(),
			onMobileSelect: (componentType: {
				id: number;
				component_type: string;
				occupied_slots: number;
			}) => {
				this.#dragDropManager.selectMobileComponent(componentType);
			}
		};
	}

	/**
	 * Mobile-specific actions
	 */
	get mobileActions() {
		return {
			onClearSelection: () => this.#dragDropManager.clearMobileSelection(),
			onFiberSelect: (fiberData: DropData) => {
				this.#dragDropManager.selectMobileItem(fiberData);
			}
		};
	}

	// ========== Configuration Methods ==========

	/**
	 * Select a slot configuration
	 */
	selectSlotConfig(uuid: string): void {
		this.#structureManager.selectSlotConfig(uuid);
	}

	/**
	 * Handle responsive change (mobile/desktop switch)
	 */
	handleResponsiveChange(isMobile: boolean): void {
		this.isMobile = isMobile;
		this.#dragDropManager.handleResponsiveChange(isMobile);
	}

	// ========== Lifecycle Methods ==========

	/**
	 * Initialize the context - fetch initial data
	 */
	async initialize(): Promise<void> {
		await this.#structureManager.fetchSlotConfigurations();
	}

	/**
	 * Reset context for a new node
	 * @param nodeUuid - New node UUID
	 * @param sharedSlotState - Optional shared state
	 */
	setNodeUuid(nodeUuid: string, sharedSlotState: SharedSlotState | null = null): void {
		this.#structureManager.setNodeUuid(nodeUuid, sharedSlotState);
		this.#spliceManager.closePortTable();
		this.#dragDropManager.cleanup();

		// Reset UI state
		this.editingClipSlot = null;
		this.editingClipValue = '';
	}

	/**
	 * Sync with shared slot state from parent
	 */
	syncWithSharedState(sharedState: SharedSlotState | null): void {
		this.#structureManager.syncWithSharedState(sharedState);
	}

	/**
	 * Fetch all data for the selected slot configuration
	 */
	async fetchAllForSlotConfig(): Promise<void> {
		await this.#structureManager.fetchAllForSlotConfig();
	}

	/**
	 * Cleanup all managers
	 */
	cleanup(): void {
		this.#structureManager.cleanup();
		this.#spliceManager.cleanup();
		this.#dragDropManager.cleanup();
		this.editingClipSlot = null;
		this.editingClipValue = '';
	}

	/**
	 * Get the drag drop manager for context sharing
	 * (Used by setContext for child components)
	 */
	getDragDropManager(): DragDropManager {
		return this.#dragDropManager;
	}

	// ========== Private Handler Methods ==========

	/**
	 * Handle slot drag over
	 */
	#handleSlotDragOver(e: DragEvent, slotNumber: number): void {
		e.preventDefault();

		const { canDrop } = this.#dragDropManager.updateDropPreview(
			slotNumber,
			this.selectedConfig?.total_slots || 0,
			this.#structureManager.occupiedSlots
		);

		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = this.#dragDropManager.getDropEffect(canDrop);
		}
	}

	/**
	 * Handle slot drop
	 */
	async #handleSlotDrop(e: DragEvent, slotNumber: number): Promise<void> {
		e.preventDefault();
		this.#dragDropManager.clearDropPreview();

		const data = this.#dragDropManager.parseDropData(e);
		if (!data) {
			this.#dragDropManager.endDrag();
			return;
		}

		try {
			if (data.type === 'component_type') {
				await this.#structureManager.createStructure(
					data as { id: number; name: string; occupied_slots: number },
					slotNumber
				);
			} else if (data.type === 'multi_component_type') {
				await this.#structureManager.createMultipleStructures(
					data as {
						id: number;
						name: string;
						occupied_slots: number;
						count?: number;
						total_slots?: number;
					},
					slotNumber
				);
			} else if (data.type === 'existing_structure') {
				if (data.slot_start === slotNumber) {
					this.#dragDropManager.endDrag();
					return;
				}
				await this.#structureManager.moveStructure(
					data as { uuid: string; occupied_slots: number },
					slotNumber
				);
			}
		} catch (err: unknown) {
			console.error('Drop error:', err);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Drop error',
				extraData: {
					from: 'NodeStructureContext.#handleSlotDrop',
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
			globalToaster.error({
				title: m.common_error(),
				description: (err as Error)?.message || m.message_error_placing_component()
			});
		}

		this.#dragDropManager.endDrag();
	}

	/**
	 * Handle mobile slot tap (tap-to-place)
	 */
	async #handleMobileSlotTap(slotNumber: number): Promise<void> {
		if (!this.#dragDropManager.mobileSelectedItem) return;

		try {
			const item = this.#dragDropManager.mobileSelectedItem;
			if (item.type === 'multi_component_type') {
				await this.#structureManager.createMultipleStructures(
					item as {
						id: number;
						name: string;
						occupied_slots: number;
						count?: number;
						total_slots?: number;
					},
					slotNumber
				);
			} else {
				await this.#structureManager.createStructure(
					item as { id: number; name: string; occupied_slots: number },
					slotNumber
				);
			}
		} catch (err: unknown) {
			globalToaster.error({
				title: m.common_error(),
				description: (err as Error)?.message || m.message_error_placing_component()
			});
		}

		this.#dragDropManager.clearMobileSelection();
	}

	/**
	 * Handle structure selection (opens port table)
	 */
	async #handleStructureSelect(structure: NodeStructure): Promise<boolean> {
		const wasSelected = await this.#spliceManager.selectStructure(
			structure as never,
			this.isMobile
		);
		return wasSelected;
	}

	/**
	 * Handle structure deletion with splice check
	 */
	async #handleDeleteStructure(structureUuid: string): Promise<DeleteResult> {
		// Check if the structure has fiber splices before deleting
		try {
			const formData = new FormData();
			formData.append('nodeStructureUuid', structureUuid);

			const response = await fetch('?/getFiberSplices', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text()) as { data?: { splices?: FiberSplice[] } };
			const splices = result.data?.splices || [];

			// Count splices that have actual fiber connections
			const activeSpliceCount = (splices as FiberSplice[]).filter(
				(s: FiberSplice) => s.fiber_a_details || s.fiber_b_details
			).length;

			if (activeSpliceCount > 0) {
				return { needsConfirmation: true, spliceCount: activeSpliceCount, structureUuid };
			}

			// No splices, delete directly
			await this.executeDelete(structureUuid);
			return { needsConfirmation: false, spliceCount: 0 };
		} catch (err) {
			console.error('Error checking splices before delete:', err);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error checking splices before delete',
				extraData: {
					from: 'NodeStructureContext.#handleDeleteStructure',
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
			// On error, proceed with delete (backend will handle cascading)
			await this.executeDelete(structureUuid);
			return { needsConfirmation: false, spliceCount: 0 };
		}
	}

	/**
	 * Execute structure deletion
	 */
	async executeDelete(structureUuid: string): Promise<void> {
		const deleted = await this.#structureManager.deleteStructure(structureUuid);
		if (deleted) {
			this.#spliceManager.onStructureDeleted(structureUuid);
			window.dispatchEvent(new CustomEvent('fiberSpliceChanged'));
		}
	}

	/**
	 * Handle port drop
	 */
	async #handlePortDrop(portNumber: number, side: 'a' | 'b', dropData: DropData): Promise<void> {
		// For cable drops, pass all structures to enable multi-component filling
		const structures = dropData.type === 'cable' ? this.#structureManager.structures : [];
		const success = await this.#spliceManager.handlePortDrop(
			portNumber,
			side,
			dropData as never,
			structures as never[]
		);

		// Clear mobile selection on success for any fiber-related drop type
		if (this.isMobile && success) {
			const dropType = this.#dragDropManager.mobileSelectedItem?.type;
			if (dropType === 'fiber' || dropType === 'bundle' || dropType === 'cable') {
				this.#dragDropManager.clearMobileSelection();
			}
		}
	}

	/**
	 * Save clip number
	 */
	async #saveClipNumber(): Promise<void> {
		if (this.editingClipSlot === null || !this.editingClipValue.trim()) {
			this.editingClipSlot = null;
			this.editingClipValue = '';
			return;
		}

		const slotNumber = this.editingClipSlot;
		const clipValue = this.editingClipValue;

		this.editingClipSlot = null;
		this.editingClipValue = '';

		await this.#structureManager.saveClipNumber(slotNumber, clipValue);
	}

	/**
	 * Handle clip number keydown
	 */
	#handleClipKeydown(e: KeyboardEvent): void {
		if (e.key === 'Enter') {
			e.preventDefault();
			this.#saveClipNumber();
		} else if (e.key === 'Escape') {
			this.editingClipSlot = null;
			this.editingClipValue = '';
		}
	}
}
