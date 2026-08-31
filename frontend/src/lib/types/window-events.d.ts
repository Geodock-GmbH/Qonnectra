/**
 * Ambient typings for the app's custom `window` events.
 *
 * Augmenting `WindowEventMap` lets `window.addEventListener('updateCablePath', h)`
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
		updateCablePath: CustomEvent<{
			edgeId: string;
			waypoints: unknown[];
			temporary: boolean;
			save: boolean;
		}>;
		updateCableHandles: CustomEvent<{
			cableId: string;
			handleStart: unknown;
			handleEnd: unknown;
		}>;
		updateCableLabelData: CustomEvent<{
			edgeId: string;
			labelData: unknown;
		}>;
		/**
		 * Dispatched with two distinct payloads: an affected-node broadcast from
		 * NetworkSchemaState, and an edge-reconnection detail from the handle config.
		 */
		cableConnectionChanged: CustomEvent<
			| { nodeIds: string[] }
			| {
					cableId: string;
					side: 'start' | 'end';
					oldNodeId?: string;
					newNodeId: string;
					handlePosition?: string;
			  }
		>;
	}
}

export {};
