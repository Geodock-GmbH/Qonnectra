import { deserialize } from '$app/forms';

/**
 * @typedef {Object} Cable
 * @property {string} uuid
 * @property {string} [name]
 * @property {number} [capacity]
 */

/**
 * @typedef {Object} FiberColor
 * @property {string} name_de
 * @property {string} name_en
 * @property {string} hex_code
 */

/**
 * @typedef {Object} Fiber
 * @property {string} uuid
 * @property {number} bundle_number
 * @property {string} bundle_color
 * @property {string} [color]
 * @property {number|null} [fiber_status_id]
 * @property {FiberStatusOption|null} [fiber_status]
 */

/**
 * @typedef {Object} FiberBundle
 * @property {number} bundleNumber
 * @property {string} bundleColor
 * @property {Fiber[]} fibers
 */

/**
 * @typedef {Object} ResidentialUnit
 * @property {string} uuid
 * @property {string} [id_residential_unit]
 * @property {string} [external_id_1]
 * @property {string} [external_id_2]
 * @property {string} [floor]
 * @property {string} [side]
 */

/**
 * @typedef {Object} NodeAddress
 * @property {string} uuid
 * @property {string} street
 * @property {string|number} housenumber
 * @property {string} [house_number_suffix]
 * @property {ResidentialUnit[]} [residential_units]
 */

/**
 * @typedef {Object} FiberStatusOption
 * @property {number} id
 * @property {string} name
 */

/**
 * Manager for cable and fiber data fetching and caching.
 * Handles lazy loading of fibers per cable and fiber color lookup.
 */
export class CableFiberDataManager {
	/** @type {string|null} */
	nodeUuid = $state(null);

	/** @type {Cable[]} */
	cables = $state([]);

	/** @type {FiberColor[]} */
	fiberColors = $state([]);

	/** @type {Map<string, Fiber[]>} */
	fibersCache = $state(new Map());

	/** @type {Set<string>} */
	loadingFibers = $state(new Set());

	/** @type {boolean} */
	loading = $state(true);

	/** @type {Set<string>} - UUIDs of fibers that are used (connected) in the current node */
	usedFiberUuids = $state(new Set());

	/** @type {boolean} */
	loadingFiberUsage = $state(false);

	/** @type {NodeAddress[]} - Addresses with residential units linked to the node */
	addresses = $state([]);

	/** @type {boolean} */
	loadingAddresses = $state(false);

	/** @type {Set<string>} - UUIDs of residential units that are connected in the current node */
	usedResidentialUnitUuids = $state(new Set());

	/** @type {boolean} */
	loadingResidentialUnitUsage = $state(false);

	/** @type {FiberStatusOption[]} - Fiber status options */
	fiberStatusOptions = $state([]);

	/** @type {boolean} */
	loadingFiberStatusOptions = $state(false);

	/**
	 * @param {string|null} nodeUuid - Initial node UUID
	 */
	constructor(nodeUuid = null) {
		this.nodeUuid = nodeUuid;
	}

	/**
	 * Color lookup map derived from fiberColors
	 * @returns {Map<string, string>}
	 */
	get colorMap() {
		const map = new Map();
		for (const color of this.fiberColors) {
			map.set(color.name_de, color.hex_code);
			map.set(color.name_en, color.hex_code);
		}
		return map;
	}

	/**
	 * Set the node UUID and reset state
	 * @param {string} uuid
	 */
	setNodeUuid(uuid) {
		this.nodeUuid = uuid;
		this.cables = [];
		this.fibersCache = new Map();
		this.usedFiberUuids = new Set();
		this.addresses = [];
		this.usedResidentialUnitUuids = new Set();
	}

	/**
	 * Fetch cables at the current node
	 */
	async fetchCables() {
		if (!this.nodeUuid) return;

		this.loading = true;
		try {
			const formData = new FormData();
			formData.append('nodeUuid', this.nodeUuid);

			const response = await fetch('?/getCablesAtNode', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'success') {
				this.cables = /** @type {Cable[]} */ (result.data?.cables) || [];
			}
		} catch (err) {
			console.error('Error fetching cables:', err);
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Fetch fiber usage for the current node
	 * Returns a set of fiber UUIDs that are connected in this node
	 */
	async fetchFiberUsage() {
		if (!this.nodeUuid) return;

		this.loadingFiberUsage = true;
		try {
			const formData = new FormData();
			formData.append('nodeUuid', this.nodeUuid);

			const response = await fetch('?/getFiberUsageInNode', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'success') {
				this.usedFiberUuids = new Set(/** @type {any} */ (result.data)?.usedFiberUuids || []);
			}
		} catch (err) {
			console.error('Error fetching fiber usage:', err);
		} finally {
			this.loadingFiberUsage = false;
		}
	}

	/**
	 * Check if a fiber is used (connected) in this node
	 * @param {string} fiberUuid
	 * @returns {boolean}
	 */
	isFiberUsed(fiberUuid) {
		return this.usedFiberUuids.has(fiberUuid);
	}

	/**
	 * Check if all fibers in a bundle are used in this node
	 * @param {Fiber[]} bundleFibers - Array of fiber objects
	 * @returns {boolean}
	 */
	isBundleFullyUsed(bundleFibers) {
		if (!bundleFibers || bundleFibers.length === 0) return false;
		return bundleFibers.every((fiber) => this.usedFiberUuids.has(fiber.uuid));
	}

	/**
	 * Fetch addresses with residential units for the current node
	 */
	async fetchAddresses() {
		if (!this.nodeUuid) return;

		this.loadingAddresses = true;
		try {
			const formData = new FormData();
			formData.append('nodeUuid', this.nodeUuid);

			const response = await fetch('?/getAddressesForNode', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());
			if (result.type === 'success') {
				this.addresses = /** @type {NodeAddress[]} */ (result.data?.addresses) || [];
			}
		} catch (err) {
			console.error('Error fetching addresses:', err);
		} finally {
			this.loadingAddresses = false;
		}
	}

	/**
	 * Fetch residential unit usage for the current node
	 */
	async fetchResidentialUnitUsage() {
		if (!this.nodeUuid) return;

		this.loadingResidentialUnitUsage = true;
		try {
			const formData = new FormData();
			formData.append('nodeUuid', this.nodeUuid);

			const response = await fetch('?/getUsedResidentialUnits', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());
			if (result.type === 'success') {
				this.usedResidentialUnitUuids = new Set(/** @type {any} */ (result.data)?.used_uuids || []);
			}
		} catch (err) {
			console.error('Error fetching residential unit usage:', err);
		} finally {
			this.loadingResidentialUnitUsage = false;
		}
	}

	/**
	 * Check if a residential unit is used (connected) in this node
	 * @param {string} uuid
	 * @returns {boolean}
	 */
	isResidentialUnitUsed(uuid) {
		return this.usedResidentialUnitUuids.has(uuid);
	}

	/**
	 * Get display name for a residential unit
	 * @param {ResidentialUnit} ru - Residential unit object
	 * @returns {string}
	 */
	getResidentialUnitDisplayName(ru) {
		let main = ru.id_residential_unit || 'Unit';

		if (ru.external_id_1) {
			main += ` (${ru.external_id_1})`;
		} else if (ru.external_id_2) {
			main += ` (${ru.external_id_2})`;
		} else if (ru.floor || ru.side) {
			const parts = [];
			if (ru.floor) parts.push(`${ru.floor}. OG`);
			if (ru.side) parts.push(ru.side);
			if (parts.length) main += ` (${parts.join(' ')})`;
		}

		return main;
	}

	/**
	 * Get display string for an address
	 * @param {NodeAddress} address
	 * @returns {string}
	 */
	getAddressDisplay(address) {
		let display = address.street + ' ' + address.housenumber;
		if (address.house_number_suffix) {
			display += address.house_number_suffix;
		}
		return display;
	}

	/**
	 * Fetch fiber colors (singleton - only fetches once)
	 */
	async fetchFiberColors() {
		if (this.fiberColors.length > 0) return;

		try {
			const response = await fetch('?/getFiberColors', {
				method: 'POST',
				body: new FormData()
			});

			const result = deserialize(await response.text());

			if (result.type === 'success') {
				this.fiberColors = /** @type {FiberColor[]} */ (result.data?.fiberColors) || [];
			}
		} catch (err) {
			console.error('Error fetching fiber colors:', err);
		}
	}

	/**
	 * Fetch fibers for a cable (lazy loading with cache)
	 * @param {string} cableUuid
	 */
	async fetchFibersForCable(cableUuid) {
		if (this.fibersCache.has(cableUuid) || this.loadingFibers.has(cableUuid)) return;

		this.loadingFibers.add(cableUuid);
		this.loadingFibers = new Set(this.loadingFibers);

		try {
			const formData = new FormData();
			formData.append('cableUuid', cableUuid);

			const response = await fetch('?/getFibersForCable', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'success') {
				this.fibersCache.set(cableUuid, /** @type {Fiber[]} */ (result.data?.fibers) || []);
				this.fibersCache = new Map(this.fibersCache);
			}
		} catch (err) {
			console.error('Error fetching fibers:', err);
		} finally {
			this.loadingFibers.delete(cableUuid);
			this.loadingFibers = new Set(this.loadingFibers);
		}
	}

	/**
	 * Get fibers for a cable from cache
	 * @param {string} cableUuid
	 * @returns {Fiber[]}
	 */
	getFibersForCable(cableUuid) {
		return this.fibersCache.get(cableUuid) || [];
	}

	/**
	 * Get cached fibers for a cable, or null if not cached
	 * Used for synchronous operations like drag start
	 * @param {string} cableUuid
	 * @returns {Fiber[]|null}
	 */
	getCachedFibersForCable(cableUuid) {
		return this.fibersCache.get(cableUuid) || null;
	}

	/**
	 * Check if fibers are loading for a cable
	 * @param {string} cableUuid
	 * @returns {boolean}
	 */
	isLoadingFibers(cableUuid) {
		return this.loadingFibers.has(cableUuid);
	}

	/**
	 * Group fibers by bundle number
	 * @param {Fiber[]} fibers
	 * @returns {FiberBundle[]}
	 */
	groupFibersByBundle(fibers) {
		const groups = new Map();
		for (const fiber of fibers) {
			const bundleKey = fiber.bundle_number;
			if (!groups.has(bundleKey)) {
				groups.set(bundleKey, {
					bundleNumber: fiber.bundle_number,
					bundleColor: fiber.bundle_color,
					fibers: []
				});
			}
			groups.get(bundleKey).fibers.push(fiber);
		}
		return Array.from(groups.values()).sort((a, b) => a.bundleNumber - b.bundleNumber);
	}

	/**
	 * Get color hex code from color name
	 * @param {string} colorName
	 * @returns {string}
	 */
	getColorHex(colorName) {
		return this.colorMap.get(colorName) || '#999999';
	}

	/**
	 * Clear the fibers cache (for refresh)
	 */
	clearFibersCache() {
		this.fibersCache = new Map();
	}

	/**
	 * Get all fibers for a cable, fetching if necessary
	 * @param {string} cableUuid
	 * @returns {Promise<Fiber[]>}
	 */
	async getAllFibersForCable(cableUuid) {
		if (this.fibersCache.has(cableUuid)) {
			return /** @type {Fiber[]} */ (this.fibersCache.get(cableUuid));
		}

		await this.fetchFibersForCable(cableUuid);
		return this.fibersCache.get(cableUuid) || [];
	}

	/**
	 * Fetch fiber status options (singleton - only fetches once)
	 */
	async fetchFiberStatusOptions() {
		if (this.fiberStatusOptions.length > 0 || this.loadingFiberStatusOptions) return;

		this.loadingFiberStatusOptions = true;
		try {
			const response = await fetch('?/getFiberStatusOptions', {
				method: 'POST',
				body: new FormData()
			});

			const result = deserialize(await response.text());

			if (result.type === 'success' && Array.isArray(result.data)) {
				this.fiberStatusOptions = result.data;
			}
		} catch (err) {
			console.error('Error fetching fiber status options:', err);
		} finally {
			this.loadingFiberStatusOptions = false;
		}
	}

	/**
	 * Update fiber status
	 * @param {string} fiberUuid
	 * @param {number|null} statusId
	 * @returns {Promise<Fiber|null>} Updated fiber or null on error
	 */
	async updateFiberStatus(fiberUuid, statusId) {
		try {
			const formData = new FormData();
			formData.append('uuid', fiberUuid);
			formData.append('fiber_status_id', statusId === null ? 'null' : String(statusId));

			const response = await fetch('?/updateFiberStatus', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'success') {
				return /** @type {Fiber|null} */ (result.data) ?? null;
			}
			return null;
		} catch (err) {
			console.error('Error updating fiber status:', err);
			return null;
		}
	}

	/**
	 * Update a fiber in the cache after status change
	 * @param {string} cableUuid
	 * @param {Fiber} updatedFiber
	 */
	updateFiberInCache(cableUuid, updatedFiber) {
		const fibers = this.fibersCache.get(cableUuid);
		if (!fibers) return;

		const index = fibers.findIndex((f) => f.uuid === updatedFiber.uuid);
		if (index !== -1) {
			const newFibers = [...fibers];
			newFibers[index] = updatedFiber;
			const newCache = new Map(this.fibersCache);
			newCache.set(cableUuid, newFibers);
			this.fibersCache = newCache;
		}
	}

	/**
	 * Cleanup manager state
	 */
	cleanup() {
		this.nodeUuid = null;
		this.cables = [];
		this.fiberColors = [];
		this.fibersCache = new Map();
		this.loadingFibers = new Set();
		this.loading = false;
		this.usedFiberUuids = new Set();
		this.loadingFiberUsage = false;
		this.addresses = [];
		this.loadingAddresses = false;
		this.usedResidentialUnitUuids = new Set();
		this.loadingResidentialUnitUsage = false;
		this.fiberStatusOptions = [];
		this.loadingFiberStatusOptions = false;
	}
}
