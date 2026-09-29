<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ClassValue } from 'svelte/elements';

	interface Props {
		/** Nesting level; the root (0) has no connector to a parent. */
		depth: number;
		/** Last sibling: the parent's line stops at this branch's elbow. */
		isLastChild: boolean;
		/** Draws the line from this waypoint's marker down to its child branches. */
		hasChildren: boolean;
		/** Border and fill of the round marker. */
		markerClass: ClassValue;
		/** Extra classes for the whole branch, children included. */
		class?: ClassValue;
		/** The waypoint's own rows. */
		children: Snippet;
		/** The child branches, nested so each is indented by one step. */
		branches?: Snippet;
	}

	let {
		depth,
		isLastChild,
		hasChildren,
		markerClass,
		class: className,
		children,
		branches
	}: Props = $props();
</script>

<!--
	Each branch is nested in its parent's padding, so every level indents by
	--tree-pad. The marker sits 20px (marker plus gap) left of the text, so the
	parent's line always runs 14px left of a branch's own left edge.
-->
<div class={['relative pl-(--tree-pad) [--tree-pad:22px] sm:[--tree-pad:32px]', className]}>
	{#if depth > 0}
		<div
			class={['absolute top-0 -left-3.5 w-px bg-surface-300-700', isLastChild ? 'h-4' : 'h-full']}
		></div>
		<div
			class="absolute top-4 -left-3.5 h-px w-[calc(var(--tree-pad)-6px)] bg-surface-300-700"
		></div>
	{/if}

	<div
		class={[
			'absolute top-2.5 left-[calc(var(--tree-pad)-20px)] size-3 rounded-full border-2',
			markerClass
		]}
	></div>

	<div class="relative min-w-0 pb-4">
		{#if hasChildren}
			<div class="absolute top-5.5 bottom-0 -left-3.5 w-px bg-surface-300-700"></div>
		{/if}
		{@render children()}
	</div>

	{@render branches?.()}
</div>
