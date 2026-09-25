import type { SharedSlotState } from '$lib/classes/NodeStructureContext.svelte';

/**
 * The floating panels the network-schema drawer opens for its feature. One
 * instance lives as long as the drawer shows one feature kind: selecting
 * another node keeps the node panels open for it, while selecting a cable or
 * closing the drawer drops them.
 */
export class SchemaPanelsState {
	slotConfigOpen = $state(false);
	structureOpen = $state(false);
	micropipeOpen = $state(false);

	/**
	 * Slot configurations the slot panel loaded, handed to the structure panel.
	 * It names its node, so the structure panel ignores one left from another node.
	 */
	sharedSlotState = $state<SharedSlotState>({
		nodeUuid: null,
		slotConfigurations: [],
		lastUpdated: 0
	});

	/** The slot configuration the structure panel starts on, with the node it belongs to. */
	#structureStart = $state<{ nodeUuid: string; slotConfigUuid: string } | null>(null);

	/**
	 * Opens the structure panel, starting on a slot configuration when one is given.
	 * @param nodeUuid - The node the slot configuration belongs to.
	 * @param slotConfigUuid - The slot configuration to start on, or null for the default.
	 */
	openStructure(nodeUuid: string, slotConfigUuid: string | null = null): void {
		this.#structureStart = slotConfigUuid ? { nodeUuid, slotConfigUuid } : null;
		this.structureOpen = true;
	}

	/**
	 * The slot configuration the structure panel starts on for this node; one
	 * picked for another node does not carry over.
	 * @param nodeUuid - The node the structure panel shows.
	 * @returns The slot configuration uuid to start on, or null for the panel's default.
	 */
	structureStartFor(nodeUuid: string): string | null {
		return this.#structureStart?.nodeUuid === nodeUuid ? this.#structureStart.slotConfigUuid : null;
	}
}
