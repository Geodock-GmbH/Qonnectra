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

	linkedTrenchIds: SvelteSet<string> = $state(new SvelteSet());

	step: 1 | 2 = $state(1);

	loading: boolean = $state(false);

	saving: boolean = $state(false);

	/**
	 * Initialize with cable data and fetch linked trenches
	 * @param cableId
	 * @param cableName
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
		this.linkedTrenchIds = new SvelteSet();
		this.step = 1;
	}

	/**
	 * Fetch trench IDs where this cable has micropipe connections
	 */
	async fetchLinkedTrenches(): Promise<void> {
		if (!this.cableId) {
			this.linkedTrenchIds = new SvelteSet();
			return;
		}

		try {
			const trenchUuids = await getLinkedTrenchesForCable(this.cableId);
			this.linkedTrenchIds = new SvelteSet(trenchUuids);
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
			this.linkedTrenchIds = new SvelteSet();
		}
	}

	/**
	 * Handle trench selection from map
	 * @param trenchIds
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
			this.conduits = await getConduitsByTrenches({
				trenchIds: Array.from(this.selectedTrenchIds),
				cableId: this.cableId ?? undefined
			});
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
				description: (error as Error).message
			});
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Toggle conduit selection
	 * @param conduitId
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
			this.micropipes = await getMicropipesByConduits({
				conduitIds: Array.from(this.selectedConduitIds),
				cableId: this.cableId ?? undefined
			});
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
				description: (error as Error).message
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
	 * Select a micropipe, or deselect if already selected
	 * @param micropipe
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
				description: (error as Error).message
			});
		} finally {
			this.saving = false;
		}
	}

	/**
	 * Remove linkage for a micropipe and refresh state
	 * @param micropipeNumber
	 * @param conduitIds
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
				description: (error as Error).message
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
