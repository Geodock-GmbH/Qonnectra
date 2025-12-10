import { deserialize } from '$app/forms';

/**
 * Manages conduit/pipe data fetching and state for trench features
 * Can be used in both Map drawer (display-only) and house-connections (with actions)
 */
export class ConduitDataManager {
	// State for pipes/conduits in trench
	pipesInTrench = $state([]);
	loading = $state(false);
	error = $state(null);

	// State for microducts (keyed by pipeUuid)
	/** @type {Record<string, Array<Object>>} */
	microducts = $state({});
	/** @type {Record<string, boolean>} */
	loadingMicroducts = $state({});
	/** @type {Record<string, string|null>} */
	errorMicroducts = $state({});

	/**
	 * Fetch all conduits/pipes in a trench
	 * @param {string} featureId - UUID of the trench
	 * @returns {Promise<void>}
	 */
	async fetchPipesInTrench(featureId) {
		if (!featureId) return;

		this.loading = true;
		this.error = null;

		try {
			const formData = new FormData();
			formData.append('uuid', featureId);

			const response = await fetch('?/getPipesInTrench', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure') {
				this.error = result.data?.error || 'Failed to fetch pipes';
				this.pipesInTrench = [];
				return;
			}

			if (result.type === 'error') {
				this.error = result.error?.message || 'An error occurred';
				this.pipesInTrench = [];
				return;
			}

			if (result.type === 'success' && result.data) {
				this.pipesInTrench = result.data.map((item) => ({
					id: item.uuid || item.id,
					title: item.conduit?.name
						? `${item.conduit.name}${item.conduit.conduit_type?.conduit_type ? ` (${item.conduit.conduit_type.conduit_type})` : ''}`
						: `Conduit ${item.uuid?.slice(0, 8)}`,
					description: '',
					data: item,
					pipeUuid: item.conduit?.uuid || null
				}));
			}
		} catch (err) {
			console.error('Error fetching pipes in trench:', err);
			this.error = 'Failed to load pipes';
			this.pipesInTrench = [];
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Fetch microducts for a specific pipe
	 * @param {string} pipeUuid - UUID of the conduit/pipe
	 * @param {boolean} forceRefresh - Force refresh even if already loaded
	 * @returns {Promise<void>}
	 */
	async fetchMicroducts(pipeUuid, forceRefresh = false) {
		if (!pipeUuid) return;

		// If already loaded and not forcing refresh, don't fetch again
		if (this.microducts[pipeUuid] && !forceRefresh) return;

		// Set loading state for this pipe - create new object to trigger reactivity
		this.loadingMicroducts = { ...this.loadingMicroducts, [pipeUuid]: true };

		try {
			const formData = new FormData();
			formData.append('uuid', pipeUuid);

			const response = await fetch('?/getMicroducts', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure') {
				this.errorMicroducts = {
					...this.errorMicroducts,
					[pipeUuid]: result.data?.error || 'Failed to fetch microducts'
				};
				this.microducts = { ...this.microducts, [pipeUuid]: [] };
				return;
			}

			if (result.type === 'error') {
				this.errorMicroducts = {
					...this.errorMicroducts,
					[pipeUuid]: result.error?.message || 'An error occurred'
				};
				this.microducts = { ...this.microducts, [pipeUuid]: [] };
				return;
			}

			if (result.type === 'success' && result.data) {
				this.microducts = { ...this.microducts, [pipeUuid]: result.data };
				// Clear any previous error
				this.errorMicroducts = { ...this.errorMicroducts, [pipeUuid]: null };
			}
		} catch (err) {
			console.error('Error fetching microducts:', err);
			this.errorMicroducts = { ...this.errorMicroducts, [pipeUuid]: 'Failed to load microducts' };
			this.microducts = { ...this.microducts, [pipeUuid]: [] };
		} finally {
			this.loadingMicroducts = { ...this.loadingMicroducts, [pipeUuid]: false };
		}
	}

	/**
	 * Force refresh microducts for a specific pipe
	 * @param {string} pipeUuid - UUID of the conduit/pipe
	 * @returns {Promise<void>}
	 */
	async refreshMicroducts(pipeUuid) {
		await this.fetchMicroducts(pipeUuid, true);
	}

	/**
	 * Update a specific microduct in the state without full reload
	 * @param {string} pipeUuid - UUID of the pipe containing the microduct
	 * @param {Object} updatedMicroduct - The updated microduct object
	 */
	updateMicroductInState(pipeUuid, updatedMicroduct) {
		if (!pipeUuid || !updatedMicroduct) {
			console.warn('Missing pipeUuid or updatedMicroduct');
			return;
		}

		const currentMicroducts = this.microducts[pipeUuid];
		if (!currentMicroducts) {
			console.warn(`No microducts found for pipe ${pipeUuid}`);
			return;
		}

		// Find and update the specific microduct
		const updatedList = currentMicroducts.map((m) =>
			m.uuid === updatedMicroduct.uuid ? updatedMicroduct : m
		);

		// Update state with new array to trigger reactivity
		this.microducts = { ...this.microducts, [pipeUuid]: updatedList };
	}

	/**
	 * Get microducts for a specific pipe
	 * @param {string} pipeUuid - UUID of the conduit/pipe
	 * @returns {Array<Object>}
	 */
	getMicroductsForPipe(pipeUuid) {
		return this.microducts[pipeUuid] || [];
	}

	/**
	 * Get loading state for a specific pipe's microducts
	 * @param {string} pipeUuid - UUID of the conduit/pipe
	 * @returns {boolean}
	 */
	isLoadingMicroducts(pipeUuid) {
		return this.loadingMicroducts[pipeUuid] || false;
	}

	/**
	 * Get error state for a specific pipe's microducts
	 * @param {string} pipeUuid - UUID of the conduit/pipe
	 * @returns {string|null}
	 */
	getMicroductsError(pipeUuid) {
		return this.errorMicroducts[pipeUuid] || null;
	}

	/**
	 * Reset all state
	 */
	reset() {
		this.pipesInTrench = [];
		this.loading = false;
		this.error = null;
		this.microducts = {};
		this.loadingMicroducts = {};
		this.errorMicroducts = {};
	}

	/**
	 * Cleanup method to be called on destroy
	 */
	cleanup() {
		this.reset();
	}
}
