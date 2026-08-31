import type { Fiber } from './CableFiberDataManager.svelte';
import type { FiberColor } from '$lib/server/nodeData';
import { deserialize } from '$app/forms';

import { logToBackendClient } from '$lib/utils/logToBackendClient';

interface CableTrenchItem {
	id: string;
	title: string;
	fiberCount: number;
	data: Record<string, unknown>;
	cableUuid: string;
}

/**
 * Manages cable and fiber data fetching for trench features in map view
 * Displays cables that pass through a trench with lazy-loaded fiber details
 */
export class CableTrenchDataManager {
	cablesInTrench: CableTrenchItem[] = $state([]);
	loading: boolean = $state(false);
	error: string | null = $state(null);

	fibers: Record<string, Fiber[]> = $state({});
	loadingFibers: Record<string, boolean> = $state({});
	errorFibers: Record<string, string | null> = $state({});

	fiberColors: FiberColor[] = $state([]);
	loadingFiberColors: boolean = $state(false);

	/**
	 * Fetch all cables that pass through a trench
	 * @param trenchUuid - UUID of the trench
	 */
	async fetchCablesInTrench(trenchUuid: string): Promise<void> {
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
				this.error =
					((result.data as Record<string, unknown>)?.error as string) || 'Failed to fetch cables';
				this.cablesInTrench = [];
				return;
			}

			if (result.type === 'error') {
				this.error = result.error?.message || 'An error occurred';
				this.cablesInTrench = [];
				return;
			}

			if (result.type === 'success' && result.data) {
				const data = result.data as unknown as Array<Record<string, unknown>>;
				this.cablesInTrench = data.map((cable) => ({
					id: cable.uuid as string,
					title: cable.name
						? `${cable.name}${(cable.cable_type as Record<string, unknown>)?.cable_type ? ` (${(cable.cable_type as Record<string, unknown>).cable_type})` : ''}`
						: `Cable ${(cable.uuid as string)?.slice(0, 8)}`,
					fiberCount: (cable.fiber_count as number) || 0,
					data: cable,
					cableUuid: cable.uuid as string
				}));
			}
		} catch (err) {
			console.error('Error fetching cables in trench:', err);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error fetching cables in trench',
				extraData: {
					from: 'CableTrenchDataManager.fetchCablesInTrench',
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
			this.error = 'Failed to load cables';
			this.cablesInTrench = [];
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Fetch fibers for a specific cable
	 * @param cableUuid - UUID of the cable
	 * @param forceRefresh - Force refresh even if already loaded
	 */
	async fetchFibersForCable(cableUuid: string, forceRefresh: boolean = false): Promise<void> {
		if (!cableUuid) return;

		if (this.fibers[cableUuid] && !forceRefresh) return;

		this.loadingFibers = {
			...this.loadingFibers,
			[cableUuid]: true
		};

		try {
			const formData = new FormData();
			formData.append('cableUuid', cableUuid);

			const response = await fetch('?/getFibersForCable', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure') {
				this.errorFibers = {
					...this.errorFibers,
					[cableUuid]:
						((result.data as Record<string, unknown>)?.error as string) || 'Failed to fetch fibers'
				};
				this.fibers = { ...this.fibers, [cableUuid]: [] };
				return;
			}

			if (result.type === 'error') {
				this.errorFibers = {
					...this.errorFibers,
					[cableUuid]: result.error?.message || 'An error occurred'
				};
				this.fibers = { ...this.fibers, [cableUuid]: [] };
				return;
			}

			if (result.type === 'success' && result.data) {
				const data = result.data as Record<string, unknown>;
				this.fibers = {
					...this.fibers,
					[cableUuid]: (data.fibers as Fiber[]) || []
				};

				this.errorFibers = {
					...this.errorFibers,
					[cableUuid]: null
				};
			}
		} catch (err) {
			console.error('Error fetching fibers:', err);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error fetching fibers',
				extraData: {
					from: 'CableTrenchDataManager.fetchFibersForCable',
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
			this.errorFibers = {
				...this.errorFibers,
				[cableUuid]: 'Failed to load fibers'
			};
			this.fibers = { ...this.fibers, [cableUuid]: [] };
		} finally {
			this.loadingFibers = {
				...this.loadingFibers,
				[cableUuid]: false
			};
		}
	}

	/**
	 * Fetch fiber colors for display
	 */
	async fetchFiberColors(): Promise<void> {
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
				const data = result.data as Record<string, unknown>;
				this.fiberColors = (data.fiberColors as FiberColor[]) || [];
			}
		} catch (err) {
			console.error('Error fetching fiber colors:', err);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error fetching fiber colors',
				extraData: {
					from: 'CableTrenchDataManager.fetchFiberColors',
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
		} finally {
			this.loadingFiberColors = false;
		}
	}

	/**
	 * Get the current locale from localStorage
	 */
	#getLocale(): 'de' | 'en' {
		if (typeof localStorage === 'undefined') return 'de';
		return localStorage.getItem('PARAGLIDE_LOCALE') === 'en' ? 'en' : 'de';
	}

	/**
	 * Get hex color code from color name
	 * @param colorName - Name of the color (can be German or English)
	 */
	getColorHex(colorName: string): string {
		if (!colorName || !Array.isArray(this.fiberColors)) return '#808080';

		const lowerName = colorName.toLowerCase();
		const locale = this.#getLocale();
		const primaryField: 'name_en' | 'name_de' = locale === 'en' ? 'name_en' : 'name_de';
		const fallbackField: 'name_en' | 'name_de' = locale === 'en' ? 'name_de' : 'name_en';

		const color = this.fiberColors.find(
			(c) =>
				c[primaryField]?.toLowerCase() === lowerName ||
				c[fallbackField]?.toLowerCase() === lowerName
		);

		return color?.hex_code || '#808080';
	}

	/**
	 * Get translated color name based on current locale
	 * @param colorName - Name of the color
	 */
	getColorName(colorName: string): string {
		if (!colorName || !Array.isArray(this.fiberColors)) return colorName;

		const lowerName = colorName.toLowerCase();
		const locale = this.#getLocale();
		const targetField: 'name_en' | 'name_de' = locale === 'en' ? 'name_en' : 'name_de';

		const color = this.fiberColors.find(
			(c) => c.name_de?.toLowerCase() === lowerName || c.name_en?.toLowerCase() === lowerName
		);

		return color?.[targetField] || colorName;
	}

	/**
	 * Get fibers for a specific cable
	 * @param cableUuid - UUID of the cable
	 */
	getFibersForCable(cableUuid: string): Fiber[] {
		return this.fibers[cableUuid] || [];
	}

	/**
	 * Get loading state for a specific cable's fibers
	 * @param cableUuid - UUID of the cable
	 */
	isLoadingFibers(cableUuid: string): boolean {
		return this.loadingFibers[cableUuid] || false;
	}

	/**
	 * Get error state for a specific cable's fibers
	 * @param cableUuid - UUID of the cable
	 */
	getFibersError(cableUuid: string): string | null {
		return this.errorFibers[cableUuid] || null;
	}

	/**
	 * Reset all state
	 */
	reset(): void {
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
	cleanup(): void {
		this.reset();
	}
}
