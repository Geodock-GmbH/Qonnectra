<script>
	// Skeleton
	import { Pagination, Toaster, createToaster } from '@skeletonlabs/skeleton-svelte';

	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// Svelte
	import { PUBLIC_API_URL } from '$env/static/public';

	let { data } = $props();
</script>
