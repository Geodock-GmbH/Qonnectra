import type { ComboboxItem } from '$lib/types/attributeCardTypes';
import { API_URL } from '$env/static/private';

import { failFromResponse } from './backend-error';

/**
 * Maps a backend attribute list to combobox options.
 * @param items - Attribute rows with an `id`.
 * @param labelKey - The row field holding the display label.
 * @returns The combobox options.
 */
export function toOptions(items: Record<string, unknown>[], labelKey: string): ComboboxItem[] {
	return items.map((item) => ({
		value: item.id as number,
		label: String(item[labelKey] ?? '')
	}));
}

/**
 * Fetches an attribute list and maps it to combobox options.
 * @param path - Backend path relative to `API_URL`.
 * @param labelKey - Row field holding the label.
 * @param headers - Django auth headers.
 * @returns The fetched list mapped to combobox options.
 * @throws When the backend request fails.
 */
export async function fetchOptions(
	path: string,
	labelKey: string,
	headers: Record<string, string>
): Promise<ComboboxItem[]> {
	const response = await fetch(`${API_URL}${path}`, { headers });
	if (!response.ok) await failFromResponse(response, `Failed to fetch ${path}`);
	return toOptions(await response.json(), labelKey);
}
