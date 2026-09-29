import { getContext, setContext } from 'svelte';
import { browser } from '$app/environment';

import { lastProjectCookie } from '$lib/utils/rememberedProject';

/**
 * Reactive holder of the remembered project for one render tree. The root
 * layout creates it from the validated cookie value the server read, the
 * project layout updates it whenever the URL names a project, and the
 * project picker updates it on a global page. Consumers read `id` reactively,
 * so a global page follows the picker live.
 */
export class RememberedProject {
	#id = $state<string | null>(null);

	/**
	 * @param initial - The validated id the server read, or null when none is remembered.
	 */
	constructor(initial: string | null) {
		this.#id = initial;
	}

	/** The remembered project id, or null when the user has none yet. */
	get id(): string | null {
		return this.#id;
	}

	/**
	 * Remembers a project and persists it for the next visit.
	 * @param id - A project id the user may see.
	 */
	set(id: string): void {
		if (this.#id === id) return;
		this.#id = id;
		if (browser) {
			document.cookie = lastProjectCookie(id, location.protocol === 'https:');
		}
	}
}

const KEY = Symbol('rememberedProject');

/**
 * Provides the remembered project to the component tree. Called once by the
 * root layout.
 * @param initial - The validated id the server read, or null.
 * @returns The holder, so the caller can use it too.
 */
export function setRememberedProject(initial: string | null): RememberedProject {
	return setContext(KEY, new RememberedProject(initial));
}

/**
 * Reads the remembered project holder. Outside the root layout (component
 * tests) it falls back to an empty holder.
 * @returns The holder provided by the root layout.
 */
export function getRememberedProject(): RememberedProject {
	return getContext<RememberedProject | undefined>(KEY) ?? new RememberedProject(null);
}
