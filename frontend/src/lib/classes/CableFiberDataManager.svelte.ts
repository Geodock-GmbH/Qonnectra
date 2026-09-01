import type { ComponentPlacement, FiberColor } from '$lib/server/nodeData';

import { logToBackendClient } from '$lib/utils/logToBackendClient';
import {
	getAddressesForNode,
	getCablesAtNode,
	getFiberColors,
	getFibersForCable as getFibersForCableQuery,
	getFiberStatusOptions,
	getFiberUsageInNode,
	getUsedResidentialUnits,
	updateFiberStatus as updateFiberStatusCommand
} from '$lib/remote/network-schema/fibers.remote';

export interface Cable {
	uuid: string;
	name?: string;
	capacity?: number;
	direction?: string;
	fiber_count?: number;
}

export interface Fiber {
	uuid: string;
	bundle_number: number;
	bundle_color: string;
	fiber_number_in_bundle?: number;
	fiber_number_absolute?: number;
	fiber_color?: string;
	color?: string;
	fiber_status_id?: number | null;
	fiber_status?: FiberStatusOption | null;
}

export interface FiberBundle {
	bundleNumber: number;
	bundleColor: string;
	fibers: Fiber[];
}

export interface ResidentialUnit {
	uuid: string;
	id_residential_unit?: string;
	external_id_1?: string;
	external_id_2?: string;
	floor?: string;
	side?: string;
}

export interface NodeAddress {
	uuid: string;
	street: string;
	housenumber: string | number;
	house_number_suffix?: string;
	residential_units?: ResidentialUnit[];
}

interface FiberStatusOption {
	id: number;
	fiber_status: string;
	name?: string;
}

/**
 * Manager for cable and fiber data fetching and caching.
 * Handles lazy loading of fibers per cable and fiber color lookup.
 */
export class CableFiberDataManager {
	nodeUuid: string | null = $state(null);

	cables: Cable[] = $state([]);

	fiberColors: FiberColor[] = $state([]);

	fibersCache: Map<string, Fiber[]> = $state(new Map());

	loadingFibers: Set<string> = $state(new Set());

	loading: boolean = $state(true);

	usedFiberUuids: Set<string> = $state(new Set());

	fiberComponentMap: Map<string, ComponentPlacement> = $state.raw(new Map());

	loadingFiberUsage: boolean = $state(false);

	addresses: NodeAddress[] = $state([]);

	loadingAddresses: boolean = $state(false);

	usedResidentialUnitUuids: Set<string> = $state(new Set());

	residentialUnitComponentMap: Map<string, ComponentPlacement> = $state.raw(new Map());

	loadingResidentialUnitUsage: boolean = $state(false);

	fiberStatusOptions: FiberStatusOption[] = $state([]);

	loadingFiberStatusOptions: boolean = $state(false);

	/**
	 * @param nodeUuid - Initial node UUID
	 */
	constructor(nodeUuid: string | null = null) {
		this.nodeUuid = nodeUuid;
	}

	/**
	 * Color lookup map derived from fiberColors
	 */
	get colorMap(): Map<string, string> {
		const map = new Map<string, string>();
		for (const color of this.fiberColors) {
			map.set(color.name_de, color.hex_code);
			map.set(color.name_en, color.hex_code);
		}
		return map;
	}

	/**
	 * Set the node UUID and reset state
	 * @param uuid
	 */
	setNodeUuid(uuid: string): void {
		this.nodeUuid = uuid;
		this.cables = [];
		this.fibersCache = new Map();
		this.usedFiberUuids = new Set();
		this.fiberComponentMap = new Map();
		this.addresses = [];
		this.usedResidentialUnitUuids = new Set();
		this.residentialUnitComponentMap = new Map();
	}

	/**
	 * Fetch cables at the current node
	 */
	async fetchCables(): Promise<void> {
		if (!this.nodeUuid) return;

		this.loading = true;
		try {
			// Remote queries are cached per argument, so a plain re-call after a
			// mutation returns the stale cached value — refresh() forces a fetch.
			const cablesQuery = getCablesAtNode(this.nodeUuid);
			await cablesQuery.refresh();
			this.cables = cablesQuery.current ?? [];
		} catch (err) {
			console.error('Error fetching cables:', err);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error fetching cables',
				extraData: {
					from: 'CableFiberDataManager.fetchCables',
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Fetch fiber usage for the current node
	 * Returns a set of fiber UUIDs that are connected in this node
	 */
	async fetchFiberUsage(): Promise<void> {
		if (!this.nodeUuid) return;

		this.loadingFiberUsage = true;
		try {
			// Remote queries are cached per argument, so a plain re-call after a
			// mutation returns the stale cached value — refresh() forces a fetch.
			const usageQuery = getFiberUsageInNode(this.nodeUuid);
			await usageQuery.refresh();
			const data = usageQuery.current ?? { usedFiberUuids: [], fiberComponentMap: {} };
			this.usedFiberUuids = new Set(data.usedFiberUuids);
			this.fiberComponentMap = new Map(Object.entries(data.fiberComponentMap));
		} catch (err) {
			console.error('Error fetching fiber usage:', err);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error fetching fiber usage',
				extraData: {
					from: 'CableFiberDataManager.fetchFiberUsage',
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
		} finally {
			this.loadingFiberUsage = false;
		}
	}

	/**
	 * Check if a fiber is used (connected) in this node
	 * @param fiberUuid
	 */
	isFiberUsed(fiberUuid: string): boolean {
		return this.usedFiberUuids.has(fiberUuid);
	}

	/**
	 * Get component placement info for a fiber
	 * @param fiberUuid
	 */
	getFiberComponentInfo(fiberUuid: string): ComponentPlacement | null {
		return this.fiberComponentMap.get(fiberUuid) || null;
	}

	/**
	 * Check if all fibers in a bundle are used in this node
	 * @param bundleFibers - Array of fiber objects
	 */
	isBundleFullyUsed(bundleFibers: Fiber[]): boolean {
		if (!bundleFibers || bundleFibers.length === 0) return false;
		return bundleFibers.every((fiber) => this.usedFiberUuids.has(fiber.uuid));
	}

	/**
	 * Fetch addresses with residential units for the current node
	 */
	async fetchAddresses(): Promise<void> {
		if (!this.nodeUuid) return;

		this.loadingAddresses = true;
		try {
			this.addresses = await getAddressesForNode(this.nodeUuid);
		} catch (err) {
			console.error('Error fetching addresses:', err);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error fetching addresses',
				extraData: {
					from: 'CableFiberDataManager.fetchAddresses',
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
		} finally {
			this.loadingAddresses = false;
		}
	}

	/**
	 * Fetch residential unit usage for the current node
	 */
	async fetchResidentialUnitUsage(): Promise<void> {
		if (!this.nodeUuid) return;

		this.loadingResidentialUnitUsage = true;
		try {
			// Remote queries are cached per argument, so a plain re-call after a
			// mutation returns the stale cached value — refresh() forces a fetch.
			const usageQuery = getUsedResidentialUnits(this.nodeUuid);
			await usageQuery.refresh();
			const data = usageQuery.current ?? {
				usedResidentialUnitUuids: [],
				residentialUnitComponentMap: {}
			};
			this.usedResidentialUnitUuids = new Set(data.usedResidentialUnitUuids);
			this.residentialUnitComponentMap = new Map(Object.entries(data.residentialUnitComponentMap));
		} catch (err) {
			console.error('Error fetching residential unit usage:', err);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error fetching residential unit usage',
				extraData: {
					from: 'CableFiberDataManager.fetchResidentialUnitUsage',
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
		} finally {
			this.loadingResidentialUnitUsage = false;
		}
	}

	/**
	 * Check if a residential unit is used (connected) in this node
	 * @param uuid
	 */
	isResidentialUnitUsed(uuid: string): boolean {
		return this.usedResidentialUnitUuids.has(uuid);
	}

	/**
	 * Get component placement info for a residential unit
	 * @param uuid
	 */
	getResidentialUnitComponentInfo(uuid: string): ComponentPlacement | null {
		return this.residentialUnitComponentMap.get(uuid) || null;
	}

	/**
	 * Get display name for a residential unit
	 * @param ru - Residential unit object
	 */
	getResidentialUnitDisplayName(ru: ResidentialUnit): string {
		let main = ru.id_residential_unit || 'Unit';

		if (ru.external_id_1) {
			main += ` (${ru.external_id_1})`;
		} else if (ru.external_id_2) {
			main += ` (${ru.external_id_2})`;
		} else if (ru.floor != null || ru.side) {
			const parts: string[] = [];
			if (ru.floor != null) {
				const f = Number(ru.floor);
				if (f === 0) parts.push('EG');
				else if (f < 0) parts.push(`${Math.abs(f)}. UG`);
				else parts.push(`${f}. OG`);
			}
			if (ru.side) parts.push(ru.side);
			if (parts.length) main += ` (${parts.join(' ')})`;
		}

		return main;
	}

	/**
	 * Get display string for an address
	 * @param address
	 */
	getAddressDisplay(address: NodeAddress): string {
		let display = address.street + ' ' + address.housenumber;
		if (address.house_number_suffix) {
			display += address.house_number_suffix;
		}
		return display;
	}

	/**
	 * Get a compact display label for component placement info
	 * @param info
	 */
	getComponentDisplayLabel(info: ComponentPlacement | null): string | null {
		if (!info) return null;
		let label = `${info.component_type} · TPU ${info.slot_start}`;
		if (info.side) label += ` · Seite ${info.side}`;
		return label;
	}

	/**
	 * Fetch fiber colors (singleton - only fetches once)
	 */
	async fetchFiberColors(): Promise<void> {
		if (this.fiberColors.length > 0) return;

		try {
			this.fiberColors = await getFiberColors();
		} catch (err) {
			console.error('Error fetching fiber colors:', err);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error fetching fiber colors',
				extraData: {
					from: 'CableFiberDataManager.fetchFiberColors',
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
		}
	}

	/**
	 * Fetch fibers for a cable (lazy loading with cache)
	 * @param cableUuid
	 */
	async fetchFibersForCable(cableUuid: string): Promise<void> {
		if (this.fibersCache.has(cableUuid) || this.loadingFibers.has(cableUuid)) return;

		this.loadingFibers.add(cableUuid);
		this.loadingFibers = new Set(this.loadingFibers);

		try {
			const fibers = await getFibersForCableQuery(cableUuid);
			this.fibersCache.set(cableUuid, fibers);
			this.fibersCache = new Map(this.fibersCache);
		} catch (err) {
			console.error('Error fetching fibers:', err);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error fetching fibers',
				extraData: {
					from: 'CableFiberDataManager.fetchFibersForCable',
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
		} finally {
			this.loadingFibers.delete(cableUuid);
			this.loadingFibers = new Set(this.loadingFibers);
		}
	}

	/**
	 * Get fibers for a cable from cache
	 * @param cableUuid
	 */
	getFibersForCable(cableUuid: string): Fiber[] {
		return this.fibersCache.get(cableUuid) || [];
	}

	/**
	 * Get cached fibers for a cable, or null if not cached
	 * Used for synchronous operations like drag start
	 * @param cableUuid
	 */
	getCachedFibersForCable(cableUuid: string): Fiber[] | null {
		return this.fibersCache.get(cableUuid) || null;
	}

	/**
	 * Check if fibers are loading for a cable
	 * @param cableUuid
	 */
	isLoadingFibers(cableUuid: string): boolean {
		return this.loadingFibers.has(cableUuid);
	}

	/**
	 * Group fibers by bundle number
	 * @param fibers
	 */
	groupFibersByBundle(fibers: Fiber[]): FiberBundle[] {
		const groups = new Map<number, FiberBundle>();
		for (const fiber of fibers) {
			const bundleKey = fiber.bundle_number;
			if (!groups.has(bundleKey)) {
				groups.set(bundleKey, {
					bundleNumber: fiber.bundle_number,
					bundleColor: fiber.bundle_color,
					fibers: []
				});
			}
			groups.get(bundleKey)!.fibers.push(fiber);
		}
		return Array.from(groups.values()).sort((a, b) => a.bundleNumber - b.bundleNumber);
	}

	/**
	 * Get color hex code from color name
	 * @param colorName
	 */
	getColorHex(colorName?: string): string {
		return (colorName && this.colorMap.get(colorName)) || '#999999';
	}

	/**
	 * Clear the fibers cache (for refresh)
	 */
	clearFibersCache(): void {
		this.fibersCache = new Map();
	}

	/**
	 * Get all fibers for a cable, fetching if necessary
	 * @param cableUuid
	 */
	async getAllFibersForCable(cableUuid: string): Promise<Fiber[]> {
		if (this.fibersCache.has(cableUuid)) {
			return this.fibersCache.get(cableUuid) as Fiber[];
		}

		await this.fetchFibersForCable(cableUuid);
		return this.fibersCache.get(cableUuid) || [];
	}

	/**
	 * Fetch fiber status options (singleton - only fetches once)
	 */
	async fetchFiberStatusOptions(): Promise<void> {
		if (this.fiberStatusOptions.length > 0 || this.loadingFiberStatusOptions) return;

		this.loadingFiberStatusOptions = true;
		try {
			this.fiberStatusOptions = await getFiberStatusOptions();
		} catch (err) {
			console.error('Error fetching fiber status options:', err);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error fetching fiber status options',
				extraData: {
					from: 'CableFiberDataManager.fetchFiberStatusOptions',
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
		} finally {
			this.loadingFiberStatusOptions = false;
		}
	}

	/**
	 * Update fiber status
	 * @param fiberUuid
	 * @param statusId
	 */
	async updateFiberStatus(fiberUuid: string, statusId: number | null): Promise<Fiber | null> {
		try {
			return await updateFiberStatusCommand({ fiberUuid, statusId });
		} catch (err) {
			console.error('Error updating fiber status:', err);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error updating fiber status',
				extraData: {
					from: 'CableFiberDataManager.updateFiberStatus',
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
			return null;
		}
	}

	/**
	 * Update a fiber in the cache after status change
	 * @param cableUuid
	 * @param updatedFiber
	 */
	updateFiberInCache(cableUuid: string, updatedFiber: Fiber): void {
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
	cleanup(): void {
		this.nodeUuid = null;
		this.cables = [];
		this.fiberColors = [];
		this.fibersCache = new Map();
		this.loadingFibers = new Set();
		this.loading = false;
		this.usedFiberUuids = new Set();
		this.fiberComponentMap = new Map();
		this.loadingFiberUsage = false;
		this.addresses = [];
		this.loadingAddresses = false;
		this.usedResidentialUnitUuids = new Set();
		this.residentialUnitComponentMap = new Map();
		this.loadingResidentialUnitUsage = false;
		this.fiberStatusOptions = [];
		this.loadingFiberStatusOptions = false;
	}
}
