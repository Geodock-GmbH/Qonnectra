import type { TraceSearchType } from '$lib/remote/trace/trace-data';
import type { TraceSearchResult } from '$lib/types/trace';

import { m } from '$lib/paraglide/messages';

/**
 * Reads a type that the backend gives either by name or as a nested object.
 * @param value - The type name, or an object carrying it under `key`.
 * @param key - Property of the nested object holding the name.
 * @returns The type name, or `null` when there is none.
 */
function typeName(value: unknown, key: string): string | null {
	if (typeof value === 'string') return value || null;
	if (value && typeof value === 'object') {
		const name = (value as Record<string, unknown>)[key];
		return typeof name === 'string' && name ? name : null;
	}
	return null;
}

/**
 * Formats a search hit for the result list, falling back to the short uuid
 * when the hit carries no text at all.
 * @param type - Kind of entity that was searched.
 * @param result - The search hit.
 * @returns The human-readable label.
 */
export function searchResultLabel(type: TraceSearchType, result: TraceSearchResult): string {
	const shortUuid = result.uuid.slice(0, 8);

	if (type === 'address') {
		const parts: string[] = [];
		if (result.street) parts.push(result.street);
		if (result.housenumber) parts.push(`${result.housenumber}${result.house_number_suffix || ''}`);
		const locality = `${result.zip_code || ''} ${result.city || ''}`.trim();
		if (locality) parts.push(locality);
		return parts.join(', ') || shortUuid;
	}

	if (type === 'residential_unit') {
		const parts: string[] = [];
		if (result.id_residential_unit) parts.push(result.id_residential_unit);
		if (result.floor !== null && result.floor !== undefined) {
			parts.push(`${m.form_floor()} ${result.floor}`);
		}
		if (result.side) parts.push(result.side);
		return parts.join(' - ') || shortUuid;
	}

	return result.name || shortUuid;
}

/**
 * Picks the secondary line of a search hit.
 * @param type - Kind of entity that was searched.
 * @param result - The search hit.
 * @returns The subtitle, or `null` when the hit carries no detail.
 */
export function searchResultSubtitle(
	type: TraceSearchType,
	result: TraceSearchResult
): string | null {
	switch (type) {
		case 'address':
			return result.id_address || null;
		case 'node':
			return typeName(result.node_type, 'node_type');
		case 'cable':
			return typeName(result.cable_type, 'cable_type');
		case 'residential_unit':
			return result.address_street
				? `${result.address_street} ${result.address_housenumber ?? ''}`.trim()
				: null;
	}
}
