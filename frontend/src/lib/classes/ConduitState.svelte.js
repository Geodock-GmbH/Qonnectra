const STORAGE_KEY = 'conduit-form-defaults';

/**
 * State manager for the conduit route
 * Manages conduits array and provides methods for CRUD operations
 */
export class ConduitState {
	conduits = $state.raw([]);

	// Form defaults (persisted to localStorage)
	defaultConduitName = $state('');
	defaultOuterConduit = $state('');
	defaultConduitType = $state([]);
	defaultStatus = $state([]);
	defaultNetworkLevel = $state([]);
	defaultOwner = $state([]);
	defaultConstructor = $state([]);
	defaultManufacturer = $state([]);
	defaultDate = $state('');
	defaultFlag = $state([]);

	/**
	 * Initialize state with conduits from load function
	 * @param {Object} initialData - Data from +page.server.js load function
	 */
	constructor(initialData) {
		this.conduits = initialData.pipes || [];
		this.#loadDefaultsFromStorage();
	}

	/**
	 * Load form defaults from localStorage
	 */
	#loadDefaultsFromStorage() {
		if (typeof window === 'undefined') return;

		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored) {
				const defaults = JSON.parse(stored);
				this.defaultConduitName = defaults.conduitName || '';
				this.defaultOuterConduit = defaults.outerConduit || '';
				this.defaultConduitType = defaults.conduitType || [];
				this.defaultStatus = defaults.status || [];
				this.defaultNetworkLevel = defaults.networkLevel || [];
				this.defaultOwner = defaults.owner || [];
				this.defaultConstructor = defaults.constructor || [];
				this.defaultManufacturer = defaults.manufacturer || [];
				this.defaultDate = defaults.date || '';
				this.defaultFlag = defaults.flag || [];
			}
		} catch (e) {
			console.warn('Failed to load conduit form defaults from localStorage:', e);
		}
	}

	/**
	 * Save form defaults to localStorage
	 */
	#saveDefaultsToStorage() {
		if (typeof window === 'undefined') return;

		try {
			const defaults = {
				conduitName: this.defaultConduitName,
				outerConduit: this.defaultOuterConduit,
				conduitType: this.defaultConduitType,
				status: this.defaultStatus,
				networkLevel: this.defaultNetworkLevel,
				owner: this.defaultOwner,
				constructor: this.defaultConstructor,
				manufacturer: this.defaultManufacturer,
				date: this.defaultDate,
				flag: this.defaultFlag
			};
			localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
		} catch (e) {
			console.warn('Failed to save conduit form defaults to localStorage:', e);
		}
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

	/**
	 * Save form defaults for next conduit creation
	 * @param {Object} values - Form values to save as defaults
	 */
	setDefaults(values) {
		this.defaultConduitName = values.conduitName || '';
		this.defaultOuterConduit = values.outerConduit || '';
		this.defaultConduitType = values.conduitType || [];
		this.defaultStatus = values.status || [];
		this.defaultNetworkLevel = values.networkLevel || [];
		this.defaultOwner = values.owner || [];
		this.defaultConstructor = values.constructor || [];
		this.defaultManufacturer = values.manufacturer || [];
		this.defaultDate = values.date || '';
		this.defaultFlag = values.flag || [];
		this.#saveDefaultsToStorage();
	}

	/**
	 * Get form defaults for conduit creation
	 * @returns {Object} Default values for form fields
	 */
	getDefaults() {
		return {
			conduitName: this.defaultConduitName,
			outerConduit: this.defaultOuterConduit,
			conduitType: this.defaultConduitType,
			status: this.defaultStatus,
			networkLevel: this.defaultNetworkLevel,
			owner: this.defaultOwner,
			constructor: this.defaultConstructor,
			manufacturer: this.defaultManufacturer,
			date: this.defaultDate,
			flag: this.defaultFlag
		};
	}
}
