<script lang="ts">
	import MicroductsDisplayTable from '$lib/components/MicroductsDisplayTable.svelte';
	import { getMicroducts } from '$lib/remote/conduit/microducts.remote';

	let { conduitUuid }: { conduitUuid: string } = $props();

	const microducts = $derived(await getMicroducts(conduitUuid));
</script>

<MicroductsDisplayTable {microducts} showStatus={true} />
