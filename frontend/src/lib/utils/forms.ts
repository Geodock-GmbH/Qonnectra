import type { ActionResult } from '@sveltejs/kit';

/**
 * Read the `data` object from a deserialized SvelteKit form-action result
 * regardless of which result variant it is. `error` and `redirect` results
 * carry no `data`, so this returns `undefined` for them.
 *
 * ```ts
 * const result = deserialize(await response.text()) as ActionResult;
 * const address = actionData(result)?.address as Address | undefined;
 * ```
 */
export function actionData(result: ActionResult): Record<string, unknown> | undefined {
	return result.type === 'success' || result.type === 'failure' ? result.data : undefined;
}
