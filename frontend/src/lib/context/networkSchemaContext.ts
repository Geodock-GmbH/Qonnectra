import type { NetworkSchemaState } from '$lib/classes/NetworkSchemaState.svelte';
import { createContext } from 'svelte';

/**
 * Typed Svelte context for the single `NetworkSchemaState` owner.
 * The whole schema-drawing subtree (pages, edges, nodes, handle config) reads
 * the live instance from here instead of prop-drilling or window CustomEvents.
 */
export const [getSchemaState, setSchemaState] = createContext<NetworkSchemaState>();
