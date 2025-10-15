<script>
	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// Svelte
	import Drawer from '$lib/components/Drawer.svelte';
	import Map from '$lib/components/Map.svelte';
	/** @type {import('./$types').PageProps} */
	let { data } = $props();
</script>

<svelte:head>
	<title>{m.nav_house_connections()}</title>
</svelte:head>

<Map showSearchPanel={false} />

<Drawer />
