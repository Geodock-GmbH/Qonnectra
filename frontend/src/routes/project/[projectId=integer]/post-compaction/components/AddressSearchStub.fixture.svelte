<script lang="ts">
	// Stands in for the address search: offers one address to pick.
	let { projectId, onselect }: { projectId: string; onselect: (uuid: string) => void } = $props();
</script>

<p data-testid="address-search">search in {projectId}</p>
<button type="button" onclick={() => onselect('addr-1')}>pick addr-1</button>
