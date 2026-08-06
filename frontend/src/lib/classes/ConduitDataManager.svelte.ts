import { deserialize } from '$app/forms';

import { logToBackendClient } from '$lib/utils/logToBackendClient';

interface ConduitType {
	conduit_type?: string;
}

interface Conduit {
	name?: string;
	uuid?: string;
	conduit_type?: ConduitType;
}

interface PipeItem {
	uuid?: string;
	id?: string;
	conduit?: Conduit;
}

interface PipeEntry {
	id: string;
	title: string;
	description: string;
	data: PipeItem;
	pipeUuid: string;
}

export interface Microduct {
	uuid: string;
	name?: string;
	number?: number;
	color?: string;
	hex_code?: string;
	microduct_status?: { id: number; microduct_status: string } | null;
	uuid_node?: {
		properties?: {
			uuid_address?: {
				properties?: {
					street?: string;
					housenumber?: string;
					house_number_suffix?: string;
					zip_code?: string;
					city?: string;
				};
			};
		};
	};
	cable_connection?: { name?: string; type?: string };
	props?: Record<string, unknown>;
}

interface StatusOption {
	id: number;
	microduct_status: string;
}

/**
 * Manages conduit/pipe data fetching and state for trench features
 * Can be used in both Map drawer (display-only) and house-connections (with actions)
 */
export class ConduitDataManager {
	pipesInTrench: PipeEntry[] = $state([]);
	loading: boolean = $state(false);
	error: string | null = $state(null);

	microducts: Record<string, Microduct[]> = $state({});
	loadingMicroducts: Record<string, boolean> = $state({});
	errorMicroducts: Record<string, string | null> = $state({});

	trenchUuidsByConduit: Record<string, string[]> = $state({});

	statusOptions: StatusOption[] = $state([]);
	loadingStatusOptions: boolean = $state(false);

	/**
	 * Fetch all conduits/pipes in a trench
	 * @param featureId - UUID of the trench
	 */
	async fetchPipesInTrench(featureId: string): Promise<void> {
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
				this.error = (result.data?.error as string | null) || 'Failed to fetch pipes';
				this.pipesInTrench = [];
				return;
			}

			if (result.type === 'error') {
				this.error = result.error?.message || 'An error occurred';
				this.pipesInTrench = [];
				return;
			}

			if (result.type === 'success' && result.data) {
				const items = result.data as unknown as PipeItem[];
				this.pipesInTrench = items.map((item) => ({
					id: item.uuid || item.id || '',
					title: item.conduit?.name
						? `${item.conduit.name}${item.conduit.conduit_type?.conduit_type ? ` (${item.conduit.conduit_type.conduit_type})` : ''}`
						: `Conduit ${item.uuid?.slice(0, 8)}`,
					description: '',
					data: item,
					pipeUuid: item.conduit?.uuid || ''
				}));
			}
		} catch (err) {
			console.error('Error fetching pipes in trench:', err);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error fetching pipes in trench',
				extraData: {
					from: 'ConduitDataManager.fetchPipesInTrench',
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
			this.error = 'Failed to load pipes';
			this.pipesInTrench = [];
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Fetch microducts for a specific pipe
	 * @param pipeUuid - UUID of the conduit/pipe
	 * @param forceRefresh - Force refresh even if already loaded
	 */
	async fetchMicroducts(pipeUuid: string, forceRefresh: boolean = false): Promise<void> {
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
					[pipeUuid]: (result.data?.error as string) || 'Failed to fetch microducts'
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
				const data = result.data as unknown as Microduct[];
				this.microducts = { ...this.microducts, [pipeUuid]: data };
				this.errorMicroducts = { ...this.errorMicroducts, [pipeUuid]: null };
			}
		} catch (err) {
			console.error('Error fetching microducts:', err);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error fetching microducts',
				extraData: {
					from: 'ConduitDataManager.fetchMicroducts',
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
			this.errorMicroducts = { ...this.errorMicroducts, [pipeUuid]: 'Failed to load microducts' };
			this.microducts = { ...this.microducts, [pipeUuid]: [] };
		} finally {
			this.loadingMicroducts = { ...this.loadingMicroducts, [pipeUuid]: false };
		}
	}

	/**
	 * Force refresh microducts for a specific pipe
	 * @param pipeUuid - UUID of the conduit/pipe
	 */
	async refreshMicroducts(pipeUuid: string): Promise<void> {
		await this.fetchMicroducts(pipeUuid, true);
	}

	/**
	 * Update a specific microduct in the state without full reload
	 * @param pipeUuid - UUID of the pipe containing the microduct
	 * @param updatedMicroduct - The updated microduct object
	 */
	updateMicroductInState(pipeUuid: string, updatedMicroduct: Microduct): void {
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
	 * @param pipeUuid - UUID of the conduit/pipe
	 */
	getMicroductsForPipe(pipeUuid: string): Microduct[] {
		return this.microducts[pipeUuid] || [];
	}

	/**
	 * Get loading state for a specific pipe's microducts
	 * @param pipeUuid - UUID of the conduit/pipe
	 */
	isLoadingMicroducts(pipeUuid: string): boolean {
		return this.loadingMicroducts[pipeUuid] || false;
	}

	/**
	 * Get error state for a specific pipe's microducts
	 * @param pipeUuid - UUID of the conduit/pipe
	 */
	getMicroductsError(pipeUuid: string): string | null {
		return this.errorMicroducts[pipeUuid] || null;
	}

	/**
	 * Fetch trench UUIDs for a specific conduit
	 * @param conduitUuid - UUID of the conduit
	 */
	async fetchTrenchUuidsForConduit(conduitUuid: string): Promise<string[]> {
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
					(result.data as Record<string, unknown>)?.error
				);
				return [];
			}

			if (result.type === 'error') {
				console.error('Failed to fetch trench UUIDs:', result.error?.message);
				return [];
			}

			if (result.type === 'success' && result.data) {
				const data = result.data as { trenchUuids?: string[] };
				const trenchUuids = data.trenchUuids || [];
				this.trenchUuidsByConduit = { ...this.trenchUuidsByConduit, [conduitUuid]: trenchUuids };
				return trenchUuids;
			}

			return [];
		} catch (err) {
			console.error('Error fetching trench UUIDs for conduit:', err);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error fetching trench UUIDs for conduit',
				extraData: {
					from: 'ConduitDataManager.fetchTrenchUuidsForConduit',
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
			return [];
		}
	}

	/**
	 * Get cached trench UUIDs for a conduit
	 * @param conduitUuid - UUID of the conduit
	 */
	getTrenchUuidsForConduit(conduitUuid: string): string[] {
		return this.trenchUuidsByConduit[conduitUuid] || [];
	}

	/**
	 * Fetch available microduct status options
	 */
	async fetchStatusOptions(): Promise<void> {
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
				this.statusOptions = result.data as unknown as StatusOption[];
			}
		} catch (err) {
			console.error('Error fetching status options:', err);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error fetching status options',
				extraData: {
					from: 'ConduitDataManager.fetchStatusOptions',
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
		} finally {
			this.loadingStatusOptions = false;
		}
	}

	/**
	 * Update a microduct's status
	 * @param microductUuid - UUID of the microduct
	 * @param statusId - ID of the status or null for healthy
	 */
	async updateMicroductStatus(
		microductUuid: string,
		statusId: number | null
	): Promise<Microduct | null> {
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
				return result.data as unknown as Microduct;
			}

			return null;
		} catch (err) {
			console.error('Error updating microduct status:', err);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error updating microduct status',
				extraData: {
					from: 'ConduitDataManager.updateMicroductStatus',
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
			return null;
		}
	}

	/**
	 * Reset all state
	 */
	reset(): void {
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
	cleanup(): void {
		this.reset();
	}
}
