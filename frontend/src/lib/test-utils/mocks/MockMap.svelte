<script lang="ts">
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
	}: {
		layers?: any;
		nodeTypes?: any;
		surfaces?: any;
		constructionTypes?: any;
		areaTypes?: any;
		projectId?: any;
		onready?: any;
		searchPanelProps?: any;
		className?: any;
		[key: string]: any;
	} = $props();
</script>

<div data-testid="map" class={className} {...props}></div>
