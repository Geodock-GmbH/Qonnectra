import { writable } from 'svelte/store';
import { browser } from '$app/environment';

/**
 * Creates a writable Svelte store that persists its value to localStorage.
 * On initialization, loads any existing value from localStorage. On every update,
 * writes the new value back to localStorage.
 * @template T
 * @param {string} key - The localStorage key to use for persistence
 * @param {T} initial - The initial value if no persisted value exists
 * @returns {import('svelte/store').Writable<T>} A writable store that syncs with localStorage
 */
export function persisted(key, initial) {
	/** @type {import('svelte/store').Writable<T>} */
	const store = writable(initial, (set) => {
		if (!browser) return;

		const json = localStorage.getItem(key);
		if (json !== null) {
			try {
				set(JSON.parse(json));
			} catch {
				// Silently ignore malformed JSON to avoid breaking the app
			}
		}

		/** @type {import('svelte/store').Unsubscriber} */
		const unsub = store.subscribe((/** @type {T} */ current) => {
			localStorage.setItem(key, JSON.stringify(current));
		});

		return unsub;
	});

	return store;
}
