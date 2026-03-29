<script>
	let {
		layers,
		nodeTypes,
		surfaces,
		constructionTypes,
		areaTypes,
		projectId,
		onready,
		searchPanelProps,
		className,
		...props
	} = $props();
</script>

<div data-testid="map" class={className} {...props}></div>
