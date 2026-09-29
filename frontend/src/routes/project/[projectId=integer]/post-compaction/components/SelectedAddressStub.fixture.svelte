<script lang="ts">
	// Stands in for the selected address: shows which one and offers to clear it.
	let { uuid, onclear }: { uuid: string; projectId: string; onclear: () => void } = $props();
</script>

<p data-testid="selected-address">address {uuid}</p>
<button type="button" onclick={onclear}>clear</button>
