import { query } from '$app/server';

import { fetchOptions } from '$lib/remote/shared/attribute-options';
import { djangoHeaders } from '$lib/remote/shared/remote-auth';

/**
 * Type-of-work options for the pipeline-record form.
 * @throws When the backend request fails.
 */
export const getTypeOfWorkOptions = query(async () =>
	fetchOptions('type-of-work/', 'name', djangoHeaders())
);

/**
 * Request-reason options for the pipeline-record form.
 * @throws When the backend request fails.
 */
export const getRequestReasonOptions = query(async () =>
	fetchOptions('request-reasons/', 'name', djangoHeaders())
);
