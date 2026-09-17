import type { ComboboxItem } from '$lib/types/attributeCardTypes';
import { query } from '$app/server';
import { API_URL } from '$env/static/private';

import { failFromResponse } from '$lib/remote/shared/backend-error';
import { djangoHeaders } from '$lib/remote/shared/remote-auth';

import { toOptions } from './address-data';

/**
 * Fetch an attribute list and map it to combobox options.
 * @param path - Backend path relative to `API_URL`.
 * @param labelKey - Row field holding the label.
 * @param headers - Django auth headers.
 */
async function fetchOptions(
	path: string,
	labelKey: string,
	headers: Record<string, string>
): Promise<ComboboxItem[]> {
	const response = await fetch(`${API_URL}${path}`, { headers });
	if (!response.ok) await failFromResponse(response, `Failed to fetch ${path}`);
	return toOptions(await response.json(), labelKey);
}

/**
 * Development status options for the address classification form.
 * @throws When the backend request fails.
 */
export const getStatusDevelopmentOptions = query(async () =>
	fetchOptions('attributes_status_development/', 'status', djangoHeaders())
);

/**
 * Flag options for the address classification form.
 * @throws When the backend request fails.
 */
export const getFlagOptions = query(async () => fetchOptions('flags/', 'flag', djangoHeaders()));

/**
 * Residential unit type options.
 * @throws When the backend request fails.
 */
export const getResidentialUnitTypeOptions = query(async () =>
	fetchOptions('attributes_residential_unit_type/', 'residential_unit_type', djangoHeaders())
);

/**
 * Residential unit status options.
 * @throws When the backend request fails.
 */
export const getResidentialUnitStatusOptions = query(async () =>
	fetchOptions('attributes_residential_unit_status/', 'status', djangoHeaders())
);
