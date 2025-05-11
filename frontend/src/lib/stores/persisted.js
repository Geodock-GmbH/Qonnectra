import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export function persisted(key, initial) {
	// start with a normal writable
	const store = writable(initial, (set) => {
		if (!browser) return;

		// on init: load from localStorage (if present)
		const json = localStorage.getItem(key);
		if (json !== null) {
			try {
				set(JSON.parse(json));
			} catch {
				// malformed JSON? ignore
			}
		}

		// subscribe -> write back to localStorage
		const unsub = store.subscribe((current) => {
			localStorage.setItem(key, JSON.stringify(current));
		});

		return unsub;
	});

	return store;
}
