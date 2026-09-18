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

<!-- Reads the attribute lists like the real Map does, so a failed query surfaces. -->
<div data-testid="map" data-node-type-count={nodeTypes?.length} class={className} {...props}></div>
