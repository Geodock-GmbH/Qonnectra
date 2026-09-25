<script lang="ts">
	let props: {
		nodeUuid?: string;
		cableId?: string;
		initialSlotConfigUuid?: string | null;
		onViewStructure?: (uuid: string) => void;
	} = $props();

	// Like the real panel contents, the stub reads its feature once, so a new
	// feature only shows after the content is mounted again.
	// svelte-ignore state_referenced_locally
	const featureId = props.nodeUuid ?? props.cableId;
</script>

<p>content for {featureId}</p>
{#if props.initialSlotConfigUuid}
	<p>starts on {props.initialSlotConfigUuid}</p>
{/if}
{#if props.onViewStructure}
	<button type="button" onclick={() => props.onViewStructure?.('slot-9')}>view structure</button>
{/if}
