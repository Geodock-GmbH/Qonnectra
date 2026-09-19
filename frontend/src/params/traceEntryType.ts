import type { ParamMatcher } from '@sveltejs/kit';

import { traceEntryTypeFromSlug } from '$lib/utils/traceUtils';

/** Matches the entity types a trace can start from, e.g. `fiber` or `residential-unit`. */
export const match = ((param) => traceEntryTypeFromSlug(param) !== null) satisfies ParamMatcher;
