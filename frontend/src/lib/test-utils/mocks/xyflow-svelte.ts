export { default as SvelteFlow } from './SvelteFlow.svelte';
export { default as Background } from './Background.svelte';
export { default as Controls } from './Controls.svelte';
export { default as Panel } from './Panel.svelte';

/** Mirror of the real `ConnectionMode` enum's runtime values. */
export const ConnectionMode = { Strict: 'strict', Loose: 'loose' } as const;
