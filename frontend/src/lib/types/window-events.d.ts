/**
 * Ambient typings for the app's custom `window` events.
 *
 * Augmenting `WindowEventMap` lets `window.addEventListener('cableConnectionChanged', h)`
 * infer `h`'s event as the matching `CustomEvent<Detail>` — no untyped window
 * cast and no loosely-typed handler needed. Keep each entry in sync with the
 * corresponding `window.dispatchEvent(new CustomEvent(...))` call site.
 */
declare global {
	/**
	 * Dev-only E2E hook exposed on `window` by the fault-simulation page so
	 * Playwright can drive it without going through the network.
	 */
	interface Window {
		__e2eFaultSim?: {
			injectResult(
				result: import('$lib/remote/fault-simulation/simulation-data').FaultSimulationResult
			): void;
			reset(): void;
		};
	}

	interface WindowEventMap {
		/**
		 * Broadcast of the node IDs affected by a cable create/delete so the fiber
		 * sidebar can refresh its cache.
		 */
		cableConnectionChanged: CustomEvent<{ nodeIds: string[] }>;
		/** A fiber splice was created or removed; fiber usage indicators are stale. */
		fiberSpliceChanged: CustomEvent<null>;
		/** A residential unit splice was created or removed; unit usage indicators are stale. */
		residentialUnitSpliceChanged: CustomEvent<null>;
	}
}

/**
 * The same events as `<svelte:window>` attributes. Svelte event attributes are
 * case sensitive, so `oncableConnectionChanged` listens to `cableConnectionChanged`.
 */
declare module 'svelte/elements' {
	interface SvelteWindowAttributes {
		oncableConnectionChanged?: (event: WindowEventMap['cableConnectionChanged']) => void;
		onfiberSpliceChanged?: (event: WindowEventMap['fiberSpliceChanged']) => void;
		onresidentialUnitSpliceChanged?: (
			event: WindowEventMap['residentialUnitSpliceChanged']
		) => void;
	}
}

export {};
