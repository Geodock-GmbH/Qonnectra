import type { Writable } from 'svelte/store';
import { writable } from 'svelte/store';
import { browser } from '$app/environment';

/**
 * Creates a writable store that syncs with sessionStorage.
 * On initialization, loads any existing value from sessionStorage. On every update,
 * writes the new value back to sessionStorage. Values are cleared when the browser tab closes.
 */
export function session<T>(key: string, initial: T): Writable<T> {
	const store: Writable<T> = writable<T>(initial, (set) => {
		if (!browser) return;

		const json = sessionStorage.getItem(key);
		if (json !== null) {
			try {
				set(JSON.parse(json));
			} catch {
				// Silently ignore malformed JSON to avoid breaking the app
			}
		}

		const unsub = store.subscribe((current: T) => {
			sessionStorage.setItem(key, JSON.stringify(current));
		});

		return unsub;
	});

	return store;
}
