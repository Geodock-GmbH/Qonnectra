import type { ParamMatcher } from '@sveltejs/kit';

/**
 * Matches a non-negative integer id, so `/project/abc/map` is a routing-level
 * 404 instead of a page that fails on a bad id.
 * @param param - The raw path segment.
 * @returns True for one or more digits and nothing else.
 */
export const match: ParamMatcher = (param) => /^\d+$/.test(param);
