import { SvelteSet } from 'svelte/reactivity';
import { deserialize } from '$app/forms';

import { m } from '$lib/paraglide/messages';

import { globalToaster } from '$lib/stores/toaster';

/**
 * Manages state for the cable-micropipe linking panel.
 */
export class CableMicropipeManager {
	/** @type {string|null} */
	cableId = $state(null);

	/** @type {string|null} */
	cableName = $state(null);

	/** @type {SvelteSet<string>} */
	selectedTrenchIds = $state(new SvelteSet());

	/** @type {Array<{uuid: string, name: string, conduit_type_name: string, has_cable_linkage: boolean}>} */
	conduits = $state([]);

	/** @type {SvelteSet<string>} */
	selectedConduitIds = $state(new SvelteSet());

	/** @type {Array<{number: number, color_name: string, color_hex: string, available_in: string[], available_in_all: boolean, linked_to_cable: boolean, missing_in: string[]}>} */
	micropipes = $state([]);

	/** @type {{number: number, color_name: string}|null} */
	selectedMicropipe = $state(null);

	/** @type {SvelteSet<string>} */
	linkedTrenchIds = $state(new SvelteSet());

	/** @type {1|2} */
	step = $state(1);

	/** @type {boolean} */
	loading = $state(false);

	/** @type {boolean} */
	saving = $state(false);

	/**
	 * Initialize with cable data
	 * @param {string} cableId
	 * @param {string} cableName
	 */
	initialize(cableId, cableName) {
		this.cableId = cableId;
		this.cableName = cableName;
		this.reset();
		this.fetchLinkedTrenches();
	}

	/**
	 * Reset state
	 */
	reset() {
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
	async fetchLinkedTrenches() {
		if (!this.cableId) {
			this.linkedTrenchIds = new SvelteSet();
			return;
		}

		try {
			const formData = new FormData();
			formData.append('cableId', this.cableId);

			const response = await fetch('?/getLinkedTrenchesForCable', {
				method: 'POST',
				body: formData
			});

			const textResponse = await response.text();
			const result = deserialize(textResponse);

			if (result.type === 'failure') {
				console.error('Failed to fetch linked trenches:', result.data?.error);
				this.linkedTrenchIds = new SvelteSet();
				return;
			}

			this.linkedTrenchIds = new SvelteSet(result.data?.trench_uuids || []);
		} catch (error) {
			console.error('Error fetching linked trenches:', error);
			this.linkedTrenchIds = new SvelteSet();
		}
	}

	/**
	 * Handle trench selection from map
	 * @param {string[]} trenchIds
	 */
	async handleTrenchSelection(trenchIds) {
		this.selectedTrenchIds = new SvelteSet(trenchIds);
		await this.fetchConduitsForTrenches();
	}

	/**
	 * Fetch conduits for selected trenches
	 */
	async fetchConduitsForTrenches() {
		if (this.selectedTrenchIds.size === 0) {
			this.conduits = [];
			return;
		}

		this.loading = true;
		try {
			const formData = new FormData();
			formData.append('trenchIds', Array.from(this.selectedTrenchIds).join(','));
			if (this.cableId) {
				formData.append('cableId', this.cableId);
			}

			const response = await fetch('?/getConduitsByTrenches', {
				method: 'POST',
				body: formData
			});

			const textResponse = await response.text();
			const result = deserialize(textResponse);

			if (result.type === 'failure') {
				throw new Error(result.data?.error || 'Failed to fetch conduits');
			}

			this.conduits = result.data?.conduits || [];
		} catch (error) {
			console.error('Error fetching conduits:', error);
			globalToaster.error({
				title: m.common_error(),
				description: error.message
			});
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Toggle conduit selection
	 * @param {string} conduitId
	 */
	toggleConduit(conduitId) {
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
	clearConduitSelection() {
		this.selectedConduitIds = new SvelteSet();
	}

	/**
	 * Move to step 2 (micropipe selection)
	 */
	async goToStep2() {
		if (this.selectedConduitIds.size === 0) return;

		this.loading = true;
		try {
			const formData = new FormData();
			formData.append('conduitIds', Array.from(this.selectedConduitIds).join(','));
			if (this.cableId) {
				formData.append('cableId', this.cableId);
			}

			const response = await fetch('?/getMicropipesByConduits', {
				method: 'POST',
				body: formData
			});

			const textResponse = await response.text();
			const result = deserialize(textResponse);

			if (result.type === 'failure') {
				throw new Error(result.data?.error || 'Failed to fetch micropipes');
			}

			this.micropipes = result.data?.micropipes || [];
			this.step = 2;
		} catch (error) {
			console.error('Error fetching micropipes:', error);
			globalToaster.error({
				title: m.common_error(),
				description: error.message
			});
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Go back to step 1
	 */
	goToStep1() {
		this.step = 1;
		this.selectedMicropipe = null;
	}

	/**
	 * Select a micropipe
	 * @param {{number: number, color_name: string, available_in_all: boolean}} micropipe
	 */
	selectMicropipe(micropipe) {
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
	 * Save the current micropipe linkage
	 */
	async saveLinkage() {
		if (!this.selectedMicropipe || this.selectedConduitIds.size === 0) return;

		this.saving = true;
		try {
			const formData = new FormData();
			formData.append('cableId', this.cableId);
			formData.append('micropipeNumber', this.selectedMicropipe.number.toString());
			formData.append('color', this.selectedMicropipe.color_name);
			formData.append('conduitIds', JSON.stringify(Array.from(this.selectedConduitIds)));

			const response = await fetch('?/createMicropipeConnections', {
				method: 'POST',
				body: formData
			});

			const textResponse = await response.text();
			const result = deserialize(textResponse);

			if (result.type === 'failure') {
				throw new Error(result.data?.error || 'Failed to save linkage');
			}

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
			globalToaster.error({
				title: m.common_error(),
				description: error.message
			});
		} finally {
			this.saving = false;
		}
	}

	/**
	 * Remove linkage for a micropipe
	 * @param {number} micropipeNumber
	 * @param {string[]} conduitIds
	 */
	async removeLinkage(micropipeNumber, conduitIds) {
		this.saving = true;
		try {
			const formData = new FormData();
			formData.append('cableId', this.cableId);
			formData.append('micropipeNumber', micropipeNumber.toString());
			formData.append('conduitIds', JSON.stringify(conduitIds));

			const response = await fetch('?/deleteMicropipeConnections', {
				method: 'POST',
				body: formData
			});

			const textResponse = await response.text();
			const result = deserialize(textResponse);

			if (result.type === 'failure') {
				throw new Error(result.data?.error || 'Failed to remove linkage');
			}

			globalToaster.success({
				title: m.title_success(),
				description: m.message_connection_deleted_successfully()
			});
			await this.fetchConduitsForTrenches();
			await this.fetchLinkedTrenches();
			this.goToStep1();
		} catch (error) {
			console.error('Error removing linkage:', error);
			globalToaster.error({
				title: m.common_error(),
				description: error.message
			});
		} finally {
			this.saving = false;
		}
	}

	/**
	 * Clear trench selection and reset conduits
	 */
	clearTrenchSelection() {
		this.selectedTrenchIds = new SvelteSet();
		this.conduits = [];
		this.selectedConduitIds = new SvelteSet();
	}
}
