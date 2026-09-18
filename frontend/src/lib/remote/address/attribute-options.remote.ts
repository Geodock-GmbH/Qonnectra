import { query } from '$app/server';

import { fetchOptions } from '$lib/remote/shared/attribute-options';
import { djangoHeaders } from '$lib/remote/shared/remote-auth';

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
