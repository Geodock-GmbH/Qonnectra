import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export function session(key, initial) {
	// start with a normal writable
	const store = writable(initial, (set) => {
		if (!browser) return;

		// on init: load from sessionStorage (if present)
		const json = sessionStorage.getItem(key);
		if (json !== null) {
			try {
				set(JSON.parse(json));
			} catch {
				// malformed JSON? ignore
			}
		}

		// subscribe -> write back to sessionStorage
		const unsub = store.subscribe((current) => {
			sessionStorage.setItem(key, JSON.stringify(current));
		});

		return unsub;
	});

	return store;
}
