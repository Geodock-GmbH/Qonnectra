import type { Writable } from 'svelte/store';
import { writable } from 'svelte/store';
import { browser } from '$app/environment';

/**
 * Creates a writable Svelte store that persists its value to localStorage.
 * On initialization, loads any existing value from localStorage. On every update,
 * writes the new value back to localStorage.
 */
export function persisted<T>(key: string, initial: T): Writable<T> {
	const store: Writable<T> = writable<T>(initial, (set) => {
		if (!browser) return;

		const json = localStorage.getItem(key);
		if (json !== null) {
			try {
				set(JSON.parse(json));
			} catch {
				// Silently ignore malformed JSON to avoid breaking the app
			}
		}

		const unsub = store.subscribe((current: T) => {
			localStorage.setItem(key, JSON.stringify(current));
		});

		return unsub;
	});

	return store;
}
