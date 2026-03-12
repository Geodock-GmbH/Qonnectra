import { deserialize } from '$app/forms';

/**
 * @typedef {Object} ConduitType
 * @property {string} [conduit_type]
 */

/**
 * @typedef {Object} Conduit
 * @property {string} [name]
 * @property {string} [uuid]
 * @property {ConduitType} [conduit_type]
 */

/**
 * @typedef {Object} PipeItem
 * @property {string} [uuid]
 * @property {string} [id]
 * @property {Conduit} [conduit]
 */

/**
 * @typedef {Object} PipeEntry
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {PipeItem} data
 * @property {string|null} pipeUuid
 */

/**
 * @typedef {Object} Microduct
 * @property {string} uuid
 * @property {string} [name]
 * @property {number} [number]
 * @property {string} [color]
 * @property {string} [hex_code]
 * @property {{id: number, microduct_status: string}|null} [microduct_status]
 * @property {{ properties?: { uuid_address?: { properties?: { street?: string, housenumber?: string, house_number_suffix?: string, zip_code?: string, city?: string } } } }} [uuid_node]
 * @property {{ name?: string, type?: string }} [cable_connection]
 * @property {Record<string, unknown>} [props]
 */

/**
 * @typedef {Object} StatusOption
 * @property {number} id
 * @property {string} microduct_status
 */

/**
 * Manages conduit/pipe data fetching and state for trench features
 * Can be used in both Map drawer (display-only) and house-connections (with actions)
 */
export class ConduitDataManager {
	/** @type {PipeEntry[]} */
	pipesInTrench = $state([]);
	/** @type {boolean} */
	loading = $state(false);
	/** @type {string|null} */
	error = $state(null);

	/** @type {Record<string, Microduct[]>} */
	microducts = $state({});
	/** @type {Record<string, boolean>} */
	loadingMicroducts = $state({});
	/** @type {Record<string, string|null>} */
	errorMicroducts = $state({});

	/** @type {Record<string, string[]>} */
	trenchUuidsByConduit = $state({});

	/** @type {StatusOption[]} */
	statusOptions = $state([]);
	/** @type {boolean} */
	loadingStatusOptions = $state(false);

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
				this.error = /** @type {string|null} */ (result.data?.error) || 'Failed to fetch pipes';
				this.pipesInTrench = [];
				return;
			}

			if (result.type === 'error') {
				this.error = result.error?.message || 'An error occurred';
				this.pipesInTrench = [];
				return;
			}

			if (result.type === 'success' && result.data) {
				const items = /** @type {PipeItem[]} */ (/** @type {unknown} */ (result.data));
				this.pipesInTrench = items.map((item) => ({
					id: item.uuid || item.id || '',
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

		if (this.microducts[pipeUuid] && !forceRefresh) return;

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
					[pipeUuid]: /** @type {string} */ (result.data?.error) || 'Failed to fetch microducts'
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
				const data = /** @type {Microduct[]} */ (/** @type {unknown} */ (result.data));
				this.microducts = { ...this.microducts, [pipeUuid]: data };
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
	 * @param {Microduct} updatedMicroduct - The updated microduct object
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

		const updatedList = currentMicroducts.map((m) =>
			m.uuid === updatedMicroduct.uuid ? updatedMicroduct : m
		);

		this.microducts = { ...this.microducts, [pipeUuid]: updatedList };
	}

	/**
	 * Get microducts for a specific pipe
	 * @param {string} pipeUuid - UUID of the conduit/pipe
	 * @returns {Microduct[]}
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
	 * Fetch trench UUIDs for a specific conduit
	 * @param {string} conduitUuid - UUID of the conduit
	 * @returns {Promise<string[]>} Array of trench UUIDs
	 */
	async fetchTrenchUuidsForConduit(conduitUuid) {
		if (!conduitUuid) return [];

		if (this.trenchUuidsByConduit[conduitUuid]) {
			return this.trenchUuidsByConduit[conduitUuid];
		}

		try {
			const formData = new FormData();
			formData.append('conduitUuid', conduitUuid);

			const response = await fetch('?/getConduitTrenches', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure') {
				console.error(
					'Failed to fetch trench UUIDs:',
					/** @type {Record<string, unknown>} */ (result.data)?.error
				);
				return [];
			}

			if (result.type === 'error') {
				console.error('Failed to fetch trench UUIDs:', result.error?.message);
				return [];
			}

			if (result.type === 'success' && result.data) {
				const data = /** @type {{ trenchUuids?: string[] }} */ (result.data);
				const trenchUuids = data.trenchUuids || [];
				this.trenchUuidsByConduit = { ...this.trenchUuidsByConduit, [conduitUuid]: trenchUuids };
				return trenchUuids;
			}

			return [];
		} catch (err) {
			console.error('Error fetching trench UUIDs for conduit:', err);
			return [];
		}
	}

	/**
	 * Get cached trench UUIDs for a conduit
	 * @param {string} conduitUuid - UUID of the conduit
	 * @returns {string[]} Array of trench UUIDs
	 */
	getTrenchUuidsForConduit(conduitUuid) {
		return this.trenchUuidsByConduit[conduitUuid] || [];
	}

	/**
	 * Fetch available microduct status options
	 * @returns {Promise<void>}
	 */
	async fetchStatusOptions() {
		if (this.statusOptions.length > 0 || this.loadingStatusOptions) return;

		this.loadingStatusOptions = true;

		try {
			const formData = new FormData();

			const response = await fetch('?/getMicroductStatusOptions', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'success' && result.data) {
				this.statusOptions = /** @type {StatusOption[]} */ (/** @type {unknown} */ (result.data));
			}
		} catch (err) {
			console.error('Error fetching status options:', err);
		} finally {
			this.loadingStatusOptions = false;
		}
	}

	/**
	 * Update a microduct's status
	 * @param {string} microductUuid - UUID of the microduct
	 * @param {number|null} statusId - ID of the status or null for healthy
	 * @returns {Promise<Microduct|null>} Updated microduct or null on error
	 */
	async updateMicroductStatus(microductUuid, statusId) {
		try {
			const formData = new FormData();
			formData.append('uuid', microductUuid);
			formData.append('microduct_status_id', statusId == null ? '' : String(statusId));

			const response = await fetch('?/updateMicroductStatus', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'success' && result.data) {
				return /** @type {Microduct} */ (result.data);
			}

			return null;
		} catch (err) {
			console.error('Error updating microduct status:', err);
			return null;
		}
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
		this.trenchUuidsByConduit = {};
		this.statusOptions = [];
		this.loadingStatusOptions = false;
	}

	/**
	 * Cleanup method to be called on destroy
	 */
	cleanup() {
		this.reset();
	}
}
