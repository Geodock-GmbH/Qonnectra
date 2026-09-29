import type { AfterNavigate, NavigationTarget } from '@sveltejs/kit';
import { onDestroy } from 'svelte';

type Params = Record<string, string | undefined>;

/**
 * A stand-in for `afterNavigate` from `$app/navigation` in component tests.
 * Callbacks are collected so a test can replay a navigation with
 * `fireAfterNavigate`; like the real hook, a callback is dropped when the
 * registering component is destroyed.
 * @param callbacks - The shared list the test fires from.
 * @returns The `afterNavigate` replacement for the module mock.
 */
export function afterNavigateStub(callbacks: Array<(navigation: AfterNavigate) => void>) {
	return (callback: (navigation: AfterNavigate) => void) => {
		callbacks.push(callback);
		onDestroy(() => {
			const index = callbacks.indexOf(callback);
			if (index !== -1) callbacks.splice(index, 1);
		});
	};
}

/**
 * @param params - The route params of the target.
 * @returns A navigation target on an unnamed route.
 */
function target(params: Params): NavigationTarget {
	return { params, route: { id: null }, url: new URL('http://localhost/'), scroll: null };
}

/**
 * Replays a completed client-side navigation between two sets of route
 * params through every registered callback.
 * @param callbacks - The list handed to `afterNavigateStub`.
 * @param fromParams - The params before the navigation; null for the initial load.
 * @param toParams - The params after the navigation.
 */
export function fireAfterNavigate(
	callbacks: Array<(navigation: AfterNavigate) => void>,
	fromParams: Params | null,
	toParams: Params
): void {
	const navigation: AfterNavigate = {
		from: fromParams ? target(fromParams) : null,
		to: target(toParams),
		type: fromParams ? 'goto' : 'enter',
		willUnload: false,
		complete: Promise.resolve()
	};
	[...callbacks].forEach((callback) => callback(navigation));
}
