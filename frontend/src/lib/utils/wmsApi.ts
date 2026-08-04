import { invalidateAll } from '$app/navigation';
import { PUBLIC_API_URL } from '$env/static/public';

export interface WMSLayer {
	/** Layer UUID. */
	id: string;
	/** Layer name (as defined in WMS service). */
	name: string;
	/** Human-readable layer title. */
	title: string;
	/** Whether the layer is enabled for display. */
	is_enabled: boolean;
	/** Display order. */
	sort_order: number;
	/** Minimum zoom level. */
	min_zoom?: number;
	/** Maximum zoom level. */
	max_zoom?: number;
	/** Layer opacity (0-1). */
	opacity?: number;
}

export interface WMSSource {
	/** Source UUID. */
	id: string;
	/** Human-readable source name. */
	name: string;
	/** WMS service URL. */
	url: string;
	/** Whether the source is active. */
	is_active: boolean;
	/** Associated project ID. */
	project: string;
	/** Layers from this source. */
	layers: WMSLayer[];
	/** ISO timestamp of creation. */
	created_at: string;
	/** ISO timestamp of last update. */
	updated_at: string;
}

/**
 * Fetches WMS sources and their layers for a project.
 * @throws If the request fails.
 */
export async function fetchWMSSources(projectId: string | number): Promise<WMSSource[]> {
	const url = `${PUBLIC_API_URL}wms-sources/?project=${projectId}`;
	const response = await fetch(url, { credentials: 'include' });

	if (response.status === 401) {
		await invalidateAll();
		const retry = await fetch(url, { credentials: 'include' });
		if (!retry.ok) {
			throw new Error(`Failed to fetch WMS sources: ${retry.statusText}`);
		}
		return retry.json();
	}

	if (!response.ok) {
		throw new Error(`Failed to fetch WMS sources: ${response.statusText}`);
	}

	return response.json();
}

/**
 * Triggers a GetCapabilities refresh for a WMS source, updating its layer list.
 * @throws If the request fails.
 */
export async function refreshWMSLayers(sourceId: string): Promise<WMSSource> {
	const response = await fetch(`${PUBLIC_API_URL}wms-sources/${sourceId}/refresh_layers/`, {
		method: 'POST',
		credentials: 'include'
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(errorData.error || `Failed to refresh WMS layers: ${response.statusText}`);
	}

	return response.json();
}

/** Constructs the WMS proxy URL for a source, optionally including an access token. */
export function getWMSProxyUrl(sourceId: string, token?: string): string {
	const baseUrl = `${PUBLIC_API_URL}wms-proxy/${sourceId}/`;
	if (token) {
		return `${baseUrl}?token=${encodeURIComponent(token)}`;
	}
	return baseUrl;
}

/**
 * Fetches a short-lived access token for WMS tile requests.
 * Browser image requests don't include cookies due to SameSite restrictions,
 * so this token is passed as a query parameter instead.
 * On 401, triggers a server-side token refresh and retries once.
 * @throws If the request fails.
 */
export async function fetchWMSAccessToken(): Promise<string> {
	const response = await fetch(`${PUBLIC_API_URL}wms-sources/access_token/`, {
		credentials: 'include'
	});

	if (response.status === 401) {
		await invalidateAll();
		const retry = await fetch(`${PUBLIC_API_URL}wms-sources/access_token/`, {
			credentials: 'include'
		});
		if (!retry.ok) {
			const error = new Error(`Failed to fetch WMS access token: ${retry.statusText}`);
			(error as { status?: number }).status = retry.status;
			throw error;
		}
		const data = await retry.json();
		return data.token;
	}

	if (!response.ok) {
		const error = new Error(`Failed to fetch WMS access token: ${response.statusText}`);
		(error as { status?: number }).status = response.status;
		throw error;
	}

	const data = await response.json();
	return data.token;
}
