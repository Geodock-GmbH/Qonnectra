import { query } from '$app/server';

import { fetchOptions } from '$lib/remote/shared/attribute-options';
import { djangoHeaders } from '$lib/remote/shared/remote-auth';

/**
 * Conduit type options for the conduit forms.
 * @returns The conduit type combobox options.
 * @throws When the backend request fails.
 */
export const getConduitTypeOptions = query(async () =>
	fetchOptions('attributes_conduit_type/', 'conduit_type', djangoHeaders())
);

/**
 * Construction status options for the conduit forms.
 * @returns The status combobox options.
 * @throws When the backend request fails.
 */
export const getStatusOptions = query(async () =>
	fetchOptions('attributes_status/', 'status', djangoHeaders())
);

/**
 * Network level options for the conduit forms.
 * @returns The network level combobox options.
 * @throws When the backend request fails.
 */
export const getNetworkLevelOptions = query(async () =>
	fetchOptions('attributes_network_level/', 'network_level', djangoHeaders())
);

/**
 * Company options, used for owner, constructor and manufacturer.
 * @returns The company combobox options.
 * @throws When the backend request fails.
 */
export const getCompanyOptions = query(async () =>
	fetchOptions('attributes_company/', 'company', djangoHeaders())
);

/**
 * Flag options for the conduit forms.
 * @returns The flag combobox options.
 * @throws When the backend request fails.
 */
export const getFlagOptions = query(async () => fetchOptions('flags/', 'flag', djangoHeaders()));
