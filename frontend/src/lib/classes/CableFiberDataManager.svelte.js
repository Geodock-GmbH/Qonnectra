import { deserialize } from '$app/forms';

/**
 * Manager for cable and fiber data fetching and caching.
 * Handles lazy loading of fibers per cable and fiber color lookup.
 */
export class CableFiberDataManager {
	/** @type {string|null} */
	nodeUuid = $state(null);

	/** @type {Array<Object>} */
	cables = $state([]);

	/** @type {Array<Object>} */
	fiberColors = $state([]);

	/** @type {Map<string, Array<Object>>} */
	fibersCache = $state(new Map());

	/** @type {Set<string>} */
	loadingFibers = $state(new Set());

	/** @type {boolean} */
	loading = $state(true);

	/** @type {Set<string>} - UUIDs of fibers that are used (connected) in the current node */
	usedFiberUuids = $state(new Set());

	/** @type {boolean} */
	loadingFiberUsage = $state(false);

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
				this.cables = result.data?.cables || [];
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
				this.usedFiberUuids = new Set(result.data?.usedFiberUuids || []);
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
	 * @param {Array<Object>} bundleFibers - Array of fiber objects
	 * @returns {boolean}
	 */
	isBundleFullyUsed(bundleFibers) {
		if (!bundleFibers || bundleFibers.length === 0) return false;
		return bundleFibers.every((fiber) => this.usedFiberUuids.has(fiber.uuid));
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
				this.fiberColors = result.data?.fiberColors || [];
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
				this.fibersCache.set(cableUuid, result.data?.fibers || []);
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
	 * @returns {Array<Object>}
	 */
	getFibersForCable(cableUuid) {
		return this.fibersCache.get(cableUuid) || [];
	}

	/**
	 * Get cached fibers for a cable, or null if not cached
	 * Used for synchronous operations like drag start
	 * @param {string} cableUuid
	 * @returns {Array<Object>|null}
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
	 * @param {Array<Object>} fibers
	 * @returns {Array<{bundleNumber: number, bundleColor: string, fibers: Array<Object>}>}
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
	 * @returns {Promise<Array<Object>>}
	 */
	async getAllFibersForCable(cableUuid) {
		if (this.fibersCache.has(cableUuid)) {
			return this.fibersCache.get(cableUuid);
		}

		await this.fetchFibersForCable(cableUuid);
		return this.fibersCache.get(cableUuid) || [];
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
	}
}
