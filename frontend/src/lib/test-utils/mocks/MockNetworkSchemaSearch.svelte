<script lang="ts">
	let {
		searchManager,
		schemaState,
		...props
	}: { searchManager?: any; schemaState?: any; [key: string]: any } = $props();
</script>

<div data-testid="network-schema-search" {...props}>Network Schema Search</div>
