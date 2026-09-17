<script lang="ts">
	import type { Component } from 'svelte';

	// Components that `await` remote queries suspend into the nearest
	// `<svelte:boundary>`; this fixture supplies one so tests can render them
	// directly and assert on the pending / failed states. Component props are
	// contravariant, so `Component<never>` accepts any component; the spread
	// below is deliberately untyped since the fixture is generic.
	let { component, props }: { component: Component<never>; props: Record<string, unknown> } =
		$props();

	const Rendered = $derived(component as Component<Record<string, unknown>>);
</script>

<svelte:boundary>
	<Rendered {...props} />

	{#snippet pending()}
		<p data-testid="boundary-pending">pending</p>
	{/snippet}

	{#snippet failed(error)}
		<p data-testid="boundary-failed">
			{error instanceof Error ? error.message : String(error)}
		</p>
	{/snippet}
</svelte:boundary>
