import { deserialize } from '$app/forms';

import { m } from '$lib/paraglide/messages';

import { globalToaster } from '$lib/stores/toaster';

import { DRAG_DROP_CONTEXT_KEY, DragDropManager } from './DragDropManager.svelte.js';
import { FiberSpliceManager } from './FiberSpliceManager.svelte.js';
import { NodeStructureManager } from './NodeStructureManager.svelte.js';

export { DRAG_DROP_CONTEXT_KEY };

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

	/** @type {NodeStructureManager} */
	#structureManager;

	/** @type {FiberSpliceManager} */
	#spliceManager;

	/** @type {DragDropManager} */
	#dragDropManager;

	// ========== UI State ==========

	/** @type {number|null} - Slot number being edited for clip number */
	editingClipSlot = $state(null);

	/** @type {string} - Current clip number value being edited */
	editingClipValue = $state('');

	/** @type {boolean} - Whether responsive mode is mobile */
	isMobile = $state(false);

	// ========== Constructor ==========

	/**
	 * @param {string|null} [nodeUuid] - Node UUID (optional, can be set later via setNodeUuid)
	 * @param {Object} [options] - Configuration options
	 * @param {string|null} [options.initialSlotConfigUuid] - Initial slot config selection
	 * @param {Object|null} [options.sharedSlotState] - Shared state from parent
	 */
	constructor(nodeUuid = null, options = {}) {
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
	 * @param {string} uuid - Slot configuration UUID to select
	 */
	setInitialSlotConfigUuid(uuid) {
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

	set dropPreviewSlots(value) {
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
	 * @returns {Array<Object>}
	 */
	computeSlotRows() {
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
			onDragOver: (e, slotNumber) => this.#handleSlotDragOver(e, slotNumber),
			onDrop: (e, slotNumber) => this.#handleSlotDrop(e, slotNumber),
			onTap: (slotNumber) => this.#handleMobileSlotTap(slotNumber)
		};
	}

	/**
	 * Structure-related actions (select, delete, drag)
	 */
	get structureActions() {
		return {
			onSelect: (structure) => this.#handleStructureSelect(structure),
			onDelete: (uuid) => this.#handleDeleteStructure(uuid),
			onDragStart: (e, structure) => this.#dragDropManager.startStructureDrag(e, structure),
			onDragEnd: () => this.#dragDropManager.endDrag()
		};
	}

	/**
	 * Clip number editing actions
	 */
	get clipActions() {
		return {
			onStartEditing: (slotNumber, currentValue) => {
				this.editingClipSlot = slotNumber;
				this.editingClipValue = currentValue || String(slotNumber);
			},
			onSave: () => this.#saveClipNumber(),
			onKeydown: (e) => this.#handleClipKeydown(e)
		};
	}

	/**
	 * Divider toggle action
	 */
	get dividerActions() {
		return {
			onToggle: (slotNumber) => this.#structureManager.toggleDivider(slotNumber)
		};
	}

	/**
	 * Port-related actions (drop, clear, merge operations)
	 */
	get portActions() {
		return {
			onDrop: (portNumber, side, dropData) => this.#handlePortDrop(portNumber, side, dropData),
			onClear: (portNumber, side) => this.#spliceManager.handleClearPort(portNumber, side),
			onClose: () => this.#spliceManager.closePortTable(),
			onToggleMergeMode: () => this.#spliceManager.toggleMergeSelectionMode(),
			onTogglePortSelection: (portNumber, side) =>
				this.#spliceManager.togglePortSelection(portNumber, side),
			onMergePorts: () => this.#spliceManager.mergeSelectedPorts(),
			onUnmergePorts: (mergeGroupId) => this.#spliceManager.unmergePorts(mergeGroupId),
			onMergedPortDrop: (mergeGroupId, side, data) =>
				this.#spliceManager.handleMergedPortDrop(mergeGroupId, side, data),
			onSetMergeSide: (side) => this.#spliceManager.setMergeSide(side)
		};
	}

	/**
	 * Sidebar drag actions (for ComponentTypeSidebar)
	 */
	get sidebarActions() {
		return {
			onDragStart: (componentType) => this.#dragDropManager.startComponentDrag(componentType),
			onDragEnd: () => this.#dragDropManager.endDrag(),
			onMobileSelect: (componentType) => {
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
			onFiberSelect: (fiberData) => {
				this.#dragDropManager.selectMobileItem(fiberData);
			}
		};
	}

	// ========== Configuration Methods ==========

	/**
	 * Select a slot configuration
	 * @param {string} uuid
	 */
	selectSlotConfig(uuid) {
		this.#structureManager.selectSlotConfig(uuid);
	}

	/**
	 * Handle responsive change (mobile/desktop switch)
	 * @param {boolean} isMobile
	 */
	handleResponsiveChange(isMobile) {
		this.isMobile = isMobile;
		this.#dragDropManager.handleResponsiveChange(isMobile);
	}

	// ========== Lifecycle Methods ==========

	/**
	 * Initialize the context - fetch initial data
	 */
	async initialize() {
		await this.#structureManager.fetchSlotConfigurations();
	}

	/**
	 * Reset context for a new node
	 * @param {string} nodeUuid - New node UUID
	 * @param {Object|null} sharedSlotState - Optional shared state
	 */
	setNodeUuid(nodeUuid, sharedSlotState = null) {
		this.#structureManager.setNodeUuid(nodeUuid, sharedSlotState);
		this.#spliceManager.closePortTable();
		this.#dragDropManager.cleanup();

		// Reset UI state
		this.editingClipSlot = null;
		this.editingClipValue = '';
	}

	/**
	 * Sync with shared slot state from parent
	 * @param {Object|null} sharedState
	 */
	syncWithSharedState(sharedState) {
		this.#structureManager.syncWithSharedState(sharedState);
	}

	/**
	 * Fetch all data for the selected slot configuration
	 */
	async fetchAllForSlotConfig() {
		await this.#structureManager.fetchAllForSlotConfig();
	}

	/**
	 * Cleanup all managers
	 */
	cleanup() {
		this.#structureManager.cleanup();
		this.#spliceManager.cleanup();
		this.#dragDropManager.cleanup();
		this.editingClipSlot = null;
		this.editingClipValue = '';
	}

	/**
	 * Get the drag drop manager for context sharing
	 * (Used by setContext for child components)
	 * @returns {DragDropManager}
	 */
	getDragDropManager() {
		return this.#dragDropManager;
	}

	// ========== Private Handler Methods ==========

	/**
	 * Handle slot drag over
	 * @param {DragEvent} e
	 * @param {number} slotNumber
	 */
	#handleSlotDragOver(e, slotNumber) {
		e.preventDefault();

		const { canDrop } = this.#dragDropManager.updateDropPreview(
			slotNumber,
			this.selectedConfig?.total_slots || 0,
			this.#structureManager.occupiedSlots
		);

		e.dataTransfer.dropEffect = this.#dragDropManager.getDropEffect(canDrop);
	}

	/**
	 * Handle slot drop
	 * @param {DragEvent} e
	 * @param {number} slotNumber
	 */
	async #handleSlotDrop(e, slotNumber) {
		e.preventDefault();
		this.#dragDropManager.clearDropPreview();

		const data = this.#dragDropManager.parseDropData(e);
		if (!data) {
			this.#dragDropManager.endDrag();
			return;
		}

		try {
			if (data.type === 'component_type') {
				await this.#structureManager.createStructure(data, slotNumber);
			} else if (data.type === 'multi_component_type') {
				await this.#structureManager.createMultipleStructures(data, slotNumber);
			} else if (data.type === 'existing_structure') {
				if (data.slot_start === slotNumber) {
					this.#dragDropManager.endDrag();
					return;
				}
				await this.#structureManager.moveStructure(data, slotNumber);
			}
		} catch (err) {
			console.error('Drop error:', err);
			globalToaster.error({
				title: m.common_error(),
				description: err.message || m.message_error_placing_component()
			});
		}

		this.#dragDropManager.endDrag();
	}

	/**
	 * Handle mobile slot tap (tap-to-place)
	 * @param {number} slotNumber
	 */
	async #handleMobileSlotTap(slotNumber) {
		if (!this.#dragDropManager.mobileSelectedItem) return;

		try {
			const item = this.#dragDropManager.mobileSelectedItem;
			if (item.type === 'multi_component_type') {
				await this.#structureManager.createMultipleStructures(item, slotNumber);
			} else {
				await this.#structureManager.createStructure(item, slotNumber);
			}
		} catch (err) {
			globalToaster.error({
				title: m.common_error(),
				description: err.message || m.message_error_placing_component()
			});
		}

		this.#dragDropManager.clearMobileSelection();
	}

	/**
	 * Handle structure selection (opens port table)
	 * @param {Object} structure
	 * @returns {Promise<boolean>} - True if structure was selected
	 */
	async #handleStructureSelect(structure) {
		const wasSelected = await this.#spliceManager.selectStructure(structure, this.isMobile);
		return wasSelected;
	}

	/**
	 * Handle structure deletion with splice check
	 * @param {string} structureUuid
	 * @returns {Promise<{needsConfirmation: boolean, spliceCount: number}>}
	 */
	async #handleDeleteStructure(structureUuid) {
		// Check if the structure has fiber splices before deleting
		try {
			const formData = new FormData();
			formData.append('nodeStructureUuid', structureUuid);

			const response = await fetch('?/getFiberSplices', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());
			const splices = result.data?.splices || [];

			// Count splices that have actual fiber connections
			const activeSpliceCount = splices.filter(
				(s) => s.fiber_a_details || s.fiber_b_details
			).length;

			if (activeSpliceCount > 0) {
				return { needsConfirmation: true, spliceCount: activeSpliceCount, structureUuid };
			}

			// No splices, delete directly
			await this.executeDelete(structureUuid);
			return { needsConfirmation: false, spliceCount: 0 };
		} catch (err) {
			console.error('Error checking splices before delete:', err);
			// On error, proceed with delete (backend will handle cascading)
			await this.executeDelete(structureUuid);
			return { needsConfirmation: false, spliceCount: 0 };
		}
	}

	/**
	 * Execute structure deletion
	 * @param {string} structureUuid
	 */
	async executeDelete(structureUuid) {
		const deleted = await this.#structureManager.deleteStructure(structureUuid);
		if (deleted) {
			this.#spliceManager.onStructureDeleted(structureUuid);
		}
	}

	/**
	 * Handle port drop
	 * @param {number} portNumber
	 * @param {'a'|'b'} side
	 * @param {Object} dropData
	 */
	async #handlePortDrop(portNumber, side, dropData) {
		// For cable drops, pass all structures to enable multi-component filling
		const structures = dropData.type === 'cable' ? this.#structureManager.structures : [];
		const success = await this.#spliceManager.handlePortDrop(
			portNumber,
			side,
			dropData,
			structures
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
	async #saveClipNumber() {
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
	 * @param {KeyboardEvent} e
	 */
	#handleClipKeydown(e) {
		if (e.key === 'Enter') {
			e.preventDefault();
			this.#saveClipNumber();
		} else if (e.key === 'Escape') {
			this.editingClipSlot = null;
			this.editingClipValue = '';
		}
	}
}
