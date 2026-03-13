import { writable } from 'svelte/store';
import { browser } from '$app/environment';

/**
 * Creates a writable store that syncs with sessionStorage.
 * On initialization, loads any existing value from sessionStorage. On every update,
 * writes the new value back to sessionStorage. Values are cleared when the browser tab closes.
 * @template T
 * @param {string} key - The sessionStorage key to use
 * @param {T} initial - The initial value if no session value exists
 * @returns {import('svelte/store').Writable<T>} A writable store that syncs with sessionStorage
 */
export function session(key, initial) {
	/** @type {import('svelte/store').Writable<T>} */
	const store = writable(initial, (set) => {
		if (!browser) return;

		const json = sessionStorage.getItem(key);
		if (json !== null) {
			try {
				set(JSON.parse(json));
			} catch {
				// Silently ignore malformed JSON to avoid breaking the app
			}
		}

		/** @type {import('svelte/store').Unsubscriber} */
		const unsub = store.subscribe((/** @type {T} */ current) => {
			sessionStorage.setItem(key, JSON.stringify(current));
		});

		return unsub;
	});

	return store;
}
