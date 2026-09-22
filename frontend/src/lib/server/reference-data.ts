import type { ProjectOption } from '$lib/utils/rememberedProject';
import { API_URL } from '$env/static/private';

/** A flag as offered in filters: id as `value`, name as `label`. */
export interface FlagOption {
	label: string;
	value: string;
}

/** Data every authenticated page needs: flags, projects and the map projection. */
export interface ReferenceData {
	flags: FlagOption[];
	flagsError: string | null;
	projects: ProjectOption[];
	projectsError: string | null;
	srid: unknown;
	proj4Def: unknown;
}

/** What an unauthenticated request gets. */
export const EMPTY_REFERENCE_DATA: ReferenceData = {
	flags: [],
	flagsError: null,
	projects: [],
	projectsError: null,
	srid: null,
	proj4Def: null
};

type Fetch = typeof globalThis.fetch;
type Headers = Record<string, string>;

/**
 * Fetches a Django list endpoint and maps its rows. Unwraps paginated
 * responses (`results`) as well as bare arrays.
 * @param fetch - The request's fetch.
 * @param url - The endpoint URL.
 * @param headers - Auth headers.
 * @param mapRow - Maps one row to its option shape.
 * @param name - Human name for the error messages.
 * @returns The options, or an error message when the endpoint failed or its body was unusable.
 */
async function fetchOptions<T>(
	fetch: Fetch,
	url: string,
	headers: Headers,
	mapRow: (row: Record<string, unknown>) => T,
	name: string
): Promise<{ items: T[]; error: string | null }> {
	let response: Response;
	try {
		response = await fetch(url, { headers });
	} catch (error) {
		console.error(`Failed to load ${name}:`, error);
		return { items: [], error: `Failed to fetch ${name}` };
	}
	if (!response.ok) return { items: [], error: `Failed to fetch ${name}` };
	try {
		const data = await response.json();
		const rows: Record<string, unknown>[] = data.results || data;
		return { items: rows.map(mapRow), error: null };
	} catch (error) {
		console.error(`Failed to parse ${name} data:`, error);
		return { items: [], error: `Error parsing ${name} data` };
	}
}

/**
 * Fetches the projects the user may see.
 * @param fetch - The request's fetch.
 * @param headers - Auth headers.
 * @returns The projects, or an error message and an empty list.
 */
export async function fetchProjects(
	fetch: Fetch,
	headers: Headers
): Promise<{ projects: ProjectOption[]; projectsError: string | null }> {
	const { items, error } = await fetchOptions(
		fetch,
		`${API_URL}projects/?active=1`,
		headers,
		(row) => ({ label: String(row.project), value: String(row.id) }),
		'projects'
	);
	return { projects: items, projectsError: error };
}

/**
 * Fetches the flags used to filter project data.
 * @param fetch - The request's fetch.
 * @param headers - Auth headers.
 * @returns The flags, or an error message and an empty list.
 */
export async function fetchFlags(
	fetch: Fetch,
	headers: Headers
): Promise<{ flags: FlagOption[]; flagsError: string | null }> {
	const { items, error } = await fetchOptions(
		fetch,
		`${API_URL}flags/`,
		headers,
		(row) => ({ label: String(row.flag), value: String(row.id) }),
		'flags'
	);
	return { flags: items, flagsError: error };
}

/**
 * Fetches the map projection configuration.
 * @param fetch - The request's fetch.
 * @param headers - Auth headers.
 * @returns The SRID and proj4 definition, or nulls when unavailable.
 */
export async function fetchProjection(
	fetch: Fetch,
	headers: Headers
): Promise<{ srid: unknown; proj4Def: unknown }> {
	try {
		const response = await fetch(`${API_URL}config/`, { headers });
		if (!response.ok) return { srid: null, proj4Def: null };
		const config = await response.json();
		return { srid: config.srid ?? null, proj4Def: config.proj4 ?? null };
	} catch (error) {
		console.error('Failed to load config:', error);
		return { srid: null, proj4Def: null };
	}
}

/**
 * Loads flags, projects and the projection in parallel.
 * @param fetch - The request's fetch.
 * @param headers - Auth headers.
 * @returns The reference data with per-endpoint error messages.
 */
export async function loadReferenceData(fetch: Fetch, headers: Headers): Promise<ReferenceData> {
	const [flags, projects, projection] = await Promise.all([
		fetchFlags(fetch, headers),
		fetchProjects(fetch, headers),
		fetchProjection(fetch, headers)
	]);
	return { ...flags, ...projects, ...projection };
}
