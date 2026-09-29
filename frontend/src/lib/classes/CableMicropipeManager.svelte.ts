import { SvelteSet } from 'svelte/reactivity';

import { m } from '$lib/paraglide/messages';

import { globalToaster } from '$lib/stores/toaster';
import { logToBackendClient } from '$lib/utils/logToBackendClient';
import {
	createMicropipeConnections,
	deleteMicropipeConnections,
	getConduitsByTrenches,
	getLinkedTrenchesForCable,
	getMicropipesByConduits
} from '$lib/remote/network-schema/micropipes.remote';
import { remoteErrorMessage } from '$lib/remote/shared/remote-error';

export interface Conduit {
	uuid: string;
	name: string;
	conduit_type_name: string;
	has_cable_linkage: boolean;
}

export interface Micropipe {
	number: number;
	color_name: string;
	color_hex: string;
	available_in: string[];
	available_in_all: boolean;
	linked_to_cable: boolean;
	linked_cables: { uuid: string; name: string }[];
	missing_in: string[];
	microduct_status: boolean;
}

interface MicropipeSelection {
	number: number;
	color_name: string;
	available_in_all?: boolean;
}

/**
 * Manages state for the cable-micropipe linking panel.
 */
export class CableMicropipeManager {
	cableId: string | null = $state(null);

	cableName: string | null = $state(null);

	selectedTrenchIds: SvelteSet<string> = $state(new SvelteSet());

	conduits: Conduit[] = $state([]);

	selectedConduitIds: SvelteSet<string> = $state(new SvelteSet());

	micropipes: Micropipe[] = $state([]);

	selectedMicropipe: { number: number; color_name: string } | null = $state(null);

	#linkedTrenchIds: SvelteSet<string> = $state(new SvelteSet());

	step: 1 | 2 = $state(1);

	loading: boolean = $state(false);

	saving: boolean = $state(false);

	readonly #onLinkedTrenchesChange: () => void;

	/**
	 * @param options - Optional callbacks.
	 * @param options.onLinkedTrenchesChange - Called after every replacement of
	 *   `linkedTrenchIds`, so a map layer styled from the set can redraw.
	 */
	constructor({ onLinkedTrenchesChange = () => {} }: { onLinkedTrenchesChange?: () => void } = {}) {
		this.#onLinkedTrenchesChange = onLinkedTrenchesChange;
	}

	/** Trenches the cable already runs through via a linked micropipe. */
	get linkedTrenchIds(): SvelteSet<string> {
		return this.#linkedTrenchIds;
	}

	#setLinkedTrenchIds(ids: Iterable<string> = []): void {
		this.#linkedTrenchIds = new SvelteSet(ids);
		this.#onLinkedTrenchesChange();
	}

	/**
	 * Starts the panel for a cable: clears every selection and loads the trenches
	 * the cable already runs through.
	 * @param cableId - Uuid of the cable whose micropipes are linked.
	 * @param cableName - Display name of the cable.
	 */
	initialize(cableId: string, cableName: string): void {
		this.cableId = cableId;
		this.cableName = cableName;
		this.reset();
		this.fetchLinkedTrenches();
	}

	/**
	 * Reset all selection and micropipe state back to initial values
	 */
	reset(): void {
		this.selectedTrenchIds = new SvelteSet();
		this.conduits = [];
		this.selectedConduitIds = new SvelteSet();
		this.micropipes = [];
		this.selectedMicropipe = null;
		this.#setLinkedTrenchIds();
		this.step = 1;
	}

	/**
	 * Fetch trench IDs where this cable has micropipe connections
	 */
	async fetchLinkedTrenches(): Promise<void> {
		if (!this.cableId) {
			this.#setLinkedTrenchIds();
			return;
		}

		try {
			// Remote queries are cached per argument, so a plain re-call after a
			// mutation returns the stale cached value — refresh() forces a fetch.
			const trenchesQuery = getLinkedTrenchesForCable(this.cableId);
			await trenchesQuery.refresh();
			this.#setLinkedTrenchIds(trenchesQuery.current ?? []);
		} catch (error) {
			console.error('Error fetching linked trenches:', error);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error fetching linked trenches',
				extraData: {
					from: 'CableMicropipeManager.fetchLinkedTrenches',
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined
				}
			});
			this.#setLinkedTrenchIds();
		}
	}

	/**
	 * Replaces the trench selection from the map and loads the conduits in those trenches.
	 * @param trenchIds - Uuids of the trenches selected on the map; empty clears the conduits.
	 */
	async handleTrenchSelection(trenchIds: string[]): Promise<void> {
		this.selectedTrenchIds = new SvelteSet(trenchIds);
		await this.fetchConduitsForTrenches();
	}

	/**
	 * Fetch conduits for selected trenches
	 */
	async fetchConduitsForTrenches(): Promise<void> {
		if (this.selectedTrenchIds.size === 0) {
			this.conduits = [];
			return;
		}

		this.loading = true;
		try {
			// Remote queries are cached per argument, so a plain re-call after a
			// mutation returns the stale cached value — refresh() forces a fetch.
			const conduitsQuery = getConduitsByTrenches({
				trenchIds: Array.from(this.selectedTrenchIds),
				cableId: this.cableId ?? undefined
			});
			await conduitsQuery.refresh();
			this.conduits = conduitsQuery.current ?? [];
		} catch (error) {
			console.error('Error fetching conduits:', error);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error fetching conduits',
				extraData: {
					from: 'CableMicropipeManager.fetchConduitsForTrenches',
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined
				}
			});
			globalToaster.error({
				title: m.common_error(),
				description: remoteErrorMessage(error) ?? m.message_error_fetching_conduit()
			});
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Adds the conduit to the selection, or removes it when it is already selected.
	 * @param conduitId - Uuid of the conduit.
	 */
	toggleConduit(conduitId: string): void {
		const newSet = new SvelteSet(this.selectedConduitIds);
		if (newSet.has(conduitId)) {
			newSet.delete(conduitId);
		} else {
			newSet.add(conduitId);
		}
		this.selectedConduitIds = newSet;
	}

	/**
	 * Clear conduit selection
	 */
	clearConduitSelection(): void {
		this.selectedConduitIds = new SvelteSet();
	}

	/**
	 * Move to step 2 (micropipe selection) by fetching micropipes for selected conduits
	 */
	async goToStep2(): Promise<void> {
		if (this.selectedConduitIds.size === 0) return;

		this.loading = true;
		try {
			// Remote queries are cached per argument, so a plain re-call after a
			// mutation returns the stale cached value — refresh() forces a fetch.
			const micropipesQuery = getMicropipesByConduits({
				conduitIds: Array.from(this.selectedConduitIds),
				cableId: this.cableId ?? undefined
			});
			await micropipesQuery.refresh();
			this.micropipes = micropipesQuery.current ?? [];
			this.step = 2;
		} catch (error) {
			console.error('Error fetching micropipes:', error);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error fetching micropipes',
				extraData: {
					from: 'CableMicropipeManager.goToStep2',
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined
				}
			});
			globalToaster.error({
				title: m.common_error(),
				description: remoteErrorMessage(error) ?? m.message_error_fetching_micropipes()
			});
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Go back to step 1 (conduit selection)
	 */
	goToStep1(): void {
		this.step = 1;
		this.selectedMicropipe = null;
	}

	/**
	 * Selects a micropipe, or deselects it when it is already selected. Only a
	 * micropipe present in every selected conduit can be selected.
	 * @param micropipe - The micropipe, identified by its number and color.
	 */
	selectMicropipe(micropipe: MicropipeSelection): void {
		if (!micropipe.available_in_all) return;

		if (
			this.selectedMicropipe?.number === micropipe.number &&
			this.selectedMicropipe?.color_name === micropipe.color_name
		) {
			this.selectedMicropipe = null;
		} else {
			this.selectedMicropipe = {
				number: micropipe.number,
				color_name: micropipe.color_name
			};
		}
	}

	/**
	 * Save the current micropipe linkage and refresh state
	 */
	async saveLinkage(): Promise<void> {
		if (!this.selectedMicropipe || this.selectedConduitIds.size === 0) return;

		this.saving = true;
		try {
			await createMicropipeConnections({
				cableId: this.cableId as string,
				micropipeNumber: this.selectedMicropipe.number,
				color: this.selectedMicropipe.color_name,
				conduitIds: Array.from(this.selectedConduitIds)
			});

			globalToaster.success({
				title: m.title_success(),
				description: m.message_created_connections()
			});

			// Refresh conduits to update linkage status
			await this.fetchConduitsForTrenches();
			await this.fetchLinkedTrenches();
			this.goToStep1();
		} catch (error) {
			console.error('Error saving linkage:', error);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error saving linkage',
				extraData: {
					from: 'CableMicropipeManager.saveLinkage',
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined
				}
			});
			globalToaster.error({
				title: m.common_error(),
				description: remoteErrorMessage(error) ?? m.message_error_creating_connection()
			});
		} finally {
			this.saving = false;
		}
	}

	/**
	 * Removes the cable's link to a micropipe in the given conduits, then reloads
	 * the conduits and linked trenches and returns to conduit selection.
	 * @param micropipeNumber - Number of the micropipe within its conduits.
	 * @param conduitIds - Uuids of the conduits whose micropipe is unlinked.
	 */
	async removeLinkage(micropipeNumber: number, conduitIds: string[]): Promise<void> {
		this.saving = true;
		try {
			await deleteMicropipeConnections({
				cableId: this.cableId as string,
				micropipeNumber,
				conduitIds
			});

			globalToaster.success({
				title: m.title_success(),
				description: m.message_connection_deleted_successfully()
			});
			await this.fetchConduitsForTrenches();
			await this.fetchLinkedTrenches();
			this.goToStep1();
		} catch (error) {
			console.error('Error removing linkage:', error);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error removing linkage',
				extraData: {
					from: 'CableMicropipeManager.removeLinkage',
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined
				}
			});
			globalToaster.error({
				title: m.common_error(),
				description: remoteErrorMessage(error) ?? m.message_error_connection_deleted()
			});
		} finally {
			this.saving = false;
		}
	}

	/**
	 * Clear trench selection and reset conduits
	 */
	clearTrenchSelection(): void {
		this.selectedTrenchIds = new SvelteSet();
		this.conduits = [];
		this.selectedConduitIds = new SvelteSet();
	}
}
