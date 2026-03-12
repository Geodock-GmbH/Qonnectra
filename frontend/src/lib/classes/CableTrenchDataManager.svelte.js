import { deserialize } from '$app/forms';

/**
 * @typedef {{
 *   id: string,
 *   title: string,
 *   fiberCount: number,
 *   data: Object,
 *   cableUuid: string
 * }} CableTrenchItem
 *
 * @typedef {{
 *   id: number,
 *   fiber_color: string,
 *   hex_code: string,
 *   name_de?: string,
 *   name_en?: string
 * }} FiberColor
 */

/**
 * Manages cable and fiber data fetching for trench features in map view
 * Displays cables that pass through a trench with lazy-loaded fiber details
 */
export class CableTrenchDataManager {
	// State for cables in trench
	/** @type {CableTrenchItem[]} */
	cablesInTrench = $state([]);
	loading = $state(false);
	/** @type {string|null} */
	error = $state(null);

	// State for fibers (keyed by cableUuid)
	/** @type {Record<string, Object[]>} */
	fibers = $state({});
	/** @type {Record<string, boolean>} */
	loadingFibers = $state({});
	/** @type {Record<string, string|null>} */
	errorFibers = $state({});

	// State for fiber colors
	/** @type {FiberColor[]} */
	fiberColors = $state([]);
	loadingFiberColors = $state(false);

	/**
	 * Fetch all cables that pass through a trench
	 * @param {string} trenchUuid - UUID of the trench
	 * @returns {Promise<void>}
	 */
	async fetchCablesInTrench(trenchUuid) {
		if (!trenchUuid) return;

		this.loading = true;
		this.error = null;

		try {
			const formData = new FormData();
			formData.append('trenchUuid', trenchUuid);

			const response = await fetch('?/getCablesInTrench', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure') {
				this.error = /** @type {any} */ (result.data)?.error || 'Failed to fetch cables';
				this.cablesInTrench = [];
				return;
			}

			if (result.type === 'error') {
				this.error = result.error?.message || 'An error occurred';
				this.cablesInTrench = [];
				return;
			}

			if (result.type === 'success' && result.data) {
				const data = /** @type {any[]} */ (/** @type {unknown} */ (result.data));
				this.cablesInTrench = data.map((/** @type {any} */ cable) => ({
					id: cable.uuid,
					title: cable.name
						? `${cable.name}${cable.cable_type?.cable_type ? ` (${cable.cable_type.cable_type})` : ''}`
						: `Cable ${cable.uuid?.slice(0, 8)}`,
					fiberCount: cable.fiber_count || 0,
					data: cable,
					cableUuid: cable.uuid
				}));
			}
		} catch (err) {
			console.error('Error fetching cables in trench:', err);
			this.error = 'Failed to load cables';
			this.cablesInTrench = [];
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Fetch fibers for a specific cable
	 * @param {string} cableUuid - UUID of the cable
	 * @param {boolean} forceRefresh - Force refresh even if already loaded
	 * @returns {Promise<void>}
	 */
	async fetchFibersForCable(cableUuid, forceRefresh = false) {
		if (!cableUuid) return;

		// If already loaded and not forcing refresh, don't fetch again
		if (this.fibers[cableUuid] && !forceRefresh) return;

		// Set loading state for this cable - create new object to trigger reactivity
		this.loadingFibers = /** @type {Record<string, boolean>} */ ({
			...this.loadingFibers,
			[cableUuid]: true
		});

		try {
			const formData = new FormData();
			formData.append('cableUuid', cableUuid);

			const response = await fetch('?/getFibersForCable', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure') {
				this.errorFibers = /** @type {Record<string, string|null>} */ ({
					...this.errorFibers,
					[cableUuid]: /** @type {any} */ (result.data)?.error || 'Failed to fetch fibers'
				});
				this.fibers = /** @type {Record<string, Object[]>} */ ({ ...this.fibers, [cableUuid]: [] });
				return;
			}

			if (result.type === 'error') {
				this.errorFibers = /** @type {Record<string, string|null>} */ ({
					...this.errorFibers,
					[cableUuid]: result.error?.message || 'An error occurred'
				});
				this.fibers = /** @type {Record<string, Object[]>} */ ({ ...this.fibers, [cableUuid]: [] });
				return;
			}

			if (result.type === 'success' && result.data) {
				const data = /** @type {any} */ (result.data);
				this.fibers = /** @type {Record<string, Object[]>} */ ({
					...this.fibers,
					[cableUuid]: data.fibers || []
				});
				// Clear any previous error
				this.errorFibers = /** @type {Record<string, string|null>} */ ({
					...this.errorFibers,
					[cableUuid]: null
				});
			}
		} catch (err) {
			console.error('Error fetching fibers:', err);
			this.errorFibers = /** @type {Record<string, string|null>} */ ({
				...this.errorFibers,
				[cableUuid]: 'Failed to load fibers'
			});
			this.fibers = /** @type {Record<string, Object[]>} */ ({ ...this.fibers, [cableUuid]: [] });
		} finally {
			this.loadingFibers = /** @type {Record<string, boolean>} */ ({
				...this.loadingFibers,
				[cableUuid]: false
			});
		}
	}

	/**
	 * Fetch fiber colors for display
	 * @returns {Promise<void>}
	 */
	async fetchFiberColors() {
		if (this.fiberColors.length > 0 || this.loadingFiberColors) return;

		this.loadingFiberColors = true;

		try {
			const formData = new FormData();

			const response = await fetch('?/getFiberColors', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'success' && result.data) {
				const data = /** @type {any} */ (result.data);
				this.fiberColors = data.fiberColors || [];
			}
		} catch (err) {
			console.error('Error fetching fiber colors:', err);
		} finally {
			this.loadingFiberColors = false;
		}
	}

	/**
	 * Get the current locale from localStorage
	 * @returns {'de' | 'en'}
	 */
	#getLocale() {
		if (typeof localStorage === 'undefined') return 'de';
		return localStorage.getItem('PARAGLIDE_LOCALE') === 'en' ? 'en' : 'de';
	}

	/**
	 * Get hex color code from color name
	 * @param {string} colorName - Name of the color (can be German or English)
	 * @returns {string} Hex color code or fallback color
	 */
	getColorHex(colorName) {
		if (!colorName || !Array.isArray(this.fiberColors)) return '#808080';

		const lowerName = colorName.toLowerCase();
		const locale = this.#getLocale();
		/** @type {'name_en' | 'name_de'} */
		const primaryField = locale === 'en' ? 'name_en' : 'name_de';
		/** @type {'name_en' | 'name_de'} */
		const fallbackField = locale === 'en' ? 'name_de' : 'name_en';

		const color = this.fiberColors.find(
			(c) =>
				c[primaryField]?.toLowerCase() === lowerName ||
				c[fallbackField]?.toLowerCase() === lowerName
		);

		return color?.hex_code || '#808080';
	}

	/**
	 * Get translated color name based on current locale
	 * @param {string} colorName - Name of the color
	 * @returns {string} Translated color name
	 */
	getColorName(colorName) {
		if (!colorName || !Array.isArray(this.fiberColors)) return colorName;

		const lowerName = colorName.toLowerCase();
		const locale = this.#getLocale();
		/** @type {'name_en' | 'name_de'} */
		const targetField = locale === 'en' ? 'name_en' : 'name_de';

		const color = this.fiberColors.find(
			(c) => c.name_de?.toLowerCase() === lowerName || c.name_en?.toLowerCase() === lowerName
		);

		return color?.[targetField] || colorName;
	}

	/**
	 * Get fibers for a specific cable
	 * @param {string} cableUuid - UUID of the cable
	 * @returns {Array<Object>}
	 */
	getFibersForCable(cableUuid) {
		return this.fibers[cableUuid] || [];
	}

	/**
	 * Get loading state for a specific cable's fibers
	 * @param {string} cableUuid - UUID of the cable
	 * @returns {boolean}
	 */
	isLoadingFibers(cableUuid) {
		return this.loadingFibers[cableUuid] || false;
	}

	/**
	 * Get error state for a specific cable's fibers
	 * @param {string} cableUuid - UUID of the cable
	 * @returns {string|null}
	 */
	getFibersError(cableUuid) {
		return this.errorFibers[cableUuid] || null;
	}

	/**
	 * Reset all state
	 */
	reset() {
		this.cablesInTrench = [];
		this.loading = false;
		this.error = null;
		this.fibers = {};
		this.loadingFibers = {};
		this.errorFibers = {};
		this.fiberColors = [];
		this.loadingFiberColors = false;
	}

	/**
	 * Cleanup method to be called on destroy
	 */
	cleanup() {
		this.reset();
	}
}
