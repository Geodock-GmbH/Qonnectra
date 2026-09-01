/**
 * Ambient typings for the app's custom `window` events.
 *
 * Augmenting `WindowEventMap` lets `window.addEventListener('micropipeLinkageChanged', h)`
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
				result: import('../../routes/fault-simulation/[[projectId]]/exportCsv').FaultSimulationResult
			): void;
			reset(): void;
		};
	}

	interface WindowEventMap {
		micropipeLinkageChanged: CustomEvent<{
			cableId: string;
			connections: import('$lib/classes/NetworkSchemaState.svelte').MicropipeConnection[];
		}>;
		/**
		 * Broadcast of the node IDs affected by a cable create/delete so the fiber
		 * sidebar can refresh its cache.
		 */
		cableConnectionChanged: CustomEvent<{ nodeIds: string[] }>;
	}
}

export {};
