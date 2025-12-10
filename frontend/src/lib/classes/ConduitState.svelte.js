/**
 * State manager for the conduit route
 * Manages conduits array and provides methods for CRUD operations
 */
export class ConduitState {
	conduits = $state.raw([]);

	/**
	 * Initialize state with conduits from load function
	 * @param {Object} initialData - Data from +page.server.js load function
	 */
	constructor(initialData) {
		this.conduits = initialData.pipes || [];
	}

	/**
	 * Format conduit data from API response to table display format
	 * @param {Object} conduit - Raw conduit data from API
	 * @returns {Object} Formatted conduit for table display
	 */
	formatConduit(conduit) {
		return {
			value: conduit.uuid,
			name: conduit.name,
			conduit_type: conduit.conduit_type?.conduit_type || '',
			outer_conduit: conduit.outer_conduit,
			status: conduit.status?.status || '',
			network_level: conduit.network_level?.network_level || '',
			owner: conduit.owner?.company || '',
			constructor: conduit.constructor?.company || '',
			manufacturer: conduit.manufacturer?.company || '',
			date: conduit.date,
			flag: conduit.flag?.flag || ''
		};
	}

	/**
	 * Update a conduit in local state
	 * @param {Object} updatedConduit - Updated conduit data from API
	 */
	updateConduit(updatedConduit) {
		const index = this.conduits.findIndex((c) => c.value === updatedConduit.uuid);
		if (index !== -1) {
			const formattedConduit = this.formatConduit(updatedConduit);
			this.conduits = [
				...this.conduits.slice(0, index),
				formattedConduit,
				...this.conduits.slice(index + 1)
			];
		}
	}

	/**
	 * Delete a conduit from local state
	 * @param {string} conduitId - UUID of conduit to delete
	 */
	deleteConduit(conduitId) {
		this.conduits = this.conduits.filter((c) => c.value !== conduitId);
	}

	/**
	 * Add a new conduit to local state (prepends to array)
	 * @param {Object} newConduit - New conduit data from API
	 */
	addConduit(newConduit) {
		const formattedConduit = this.formatConduit(newConduit);
		this.conduits = [formattedConduit, ...this.conduits];
	}

	/**
	 * Set conduits array (used when data is reloaded, e.g., after search)
	 * @param {Array} pipes - Array of formatted pipes from load function
	 */
	setConduits(pipes) {
		this.conduits = pipes || [];
	}
}
