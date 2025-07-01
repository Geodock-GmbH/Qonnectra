<script>
	// Skeleton
	import { Switch } from '@skeletonlabs/skeleton-svelte';

	// Tabler icons
	import { IconEye, IconEyeOff } from '@tabler/icons-svelte';

	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// Svelte
	import { createEventDispatcher } from 'svelte';

	let { layers = [], osmLayer = null } = $props();

	const dispatch = createEventDispatcher();

	// State to track visibility of each layer
	let layerVisibility = $state(new Map());

	// Initialize visibility state when layers change
	$effect(() => {
		const newVisibility = new Map();

		// Add OSM layer if provided
		if (osmLayer) {
			newVisibility.set('osm-base-layer', {
				layer: osmLayer,
				visible: osmLayer.getVisible(),
				name: m.osm()
			});
		}

		// Add other layers with generated names if they don't have custom names
		layers.forEach((layer, index) => {
			const layerId = layer.get('layerId');
			const layerName = layer.get('layerName');

			// Removes undefined layers like selection layer
			if (layerId && layerName) {
				newVisibility.set(layerId, {
					layer: layer,
					visible: layer.getVisible(),
					name: layerName
				});
			}
		});

		layerVisibility = newVisibility;
	});

	function toggleLayerVisibility(layerId) {
		const layerInfo = layerVisibility.get(layerId);
		if (layerInfo) {
			const newVisible = !layerInfo.visible;

			// Update the OpenLayers layer visibility
			layerInfo.layer.setVisible(newVisible);

			// Update our state
			layerVisibility.set(layerId, {
				...layerInfo,
				visible: newVisible
			});

			// Trigger reactivity
			layerVisibility = new Map(layerVisibility);

			// Dispatch event for parent components
			dispatch('layerVisibilityChanged', {
				layerId,
				visible: newVisible,
				layer: layerInfo.layer
			});
		}
	}
</script>

<div class="w-64 p-2 bg-surface-50-950 rounded-md shadow">
	<p class="text-sm text-surface-contrast-100-900 mb-2">Layer Visibility</p>

	<div class="space-y-2">
		{#each Array.from(layerVisibility.entries()) as [layerId, layerInfo]}
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					{#if layerInfo.visible}
						<IconEye size="16" class="text-primary-500" />
					{:else}
						<IconEyeOff size="16" class="text-surface-400" />
					{/if}
					<span class="text-xs text-surface-contrast-100-900 truncate">
						{layerInfo.name}
					</span>
				</div>

				<Switch
					name="layer-visibility-{layerId}"
					size="sm"
					checked={layerInfo.visible}
					onCheckedChange={() => toggleLayerVisibility(layerId)}
				/>
			</div>
		{/each}

		{#if layerVisibility.size === 0}
			<p class="text-xs text-surface-400 italic">No layers available</p>
		{/if}
	</div>
</div>
