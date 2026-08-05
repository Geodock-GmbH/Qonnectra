<script>
	let {
		slotRows = [],
		loading = false,
		loadingStructures = false,
		isMobile = false,
		readonly = false,
		onStructureSelect = () => {},
		onStructureDelete = () => {}
	} = $props();
</script>

<div
	data-testid="slot-grid"
	data-loading={loading}
	data-loading-structures={loadingStructures}
	data-mobile={isMobile}
	data-readonly={readonly}
	data-rows={slotRows.length}
>
	<button data-testid="grid-select" onclick={() => onStructureSelect(slotRows[0]?.structure)}>
		select
	</button>
	<button data-testid="grid-delete" onclick={() => onStructureDelete('struct-to-delete')}>
		delete
	</button>
</div>
