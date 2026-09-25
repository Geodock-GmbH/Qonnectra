import type { NetworkSchemaState } from '$lib/classes/NetworkSchemaState.svelte';
import type { SchemaPanelsState } from '$lib/classes/SchemaPanelsState.svelte';
import { createContext } from 'svelte';

/**
 * Typed Svelte context for the single `NetworkSchemaState` owner.
 * The whole schema-drawing subtree (pages, edges, nodes, handle config) reads
 * the live instance from here instead of prop-drilling or window CustomEvents.
 */
export const [getSchemaState, setSchemaState] = createContext<NetworkSchemaState>();

/**
 * Typed Svelte context for the drawer's floating panels: the drawer tabs open
 * them, the panel host renders them.
 */
export const [getSchemaPanels, setSchemaPanels] = createContext<SchemaPanelsState>();
