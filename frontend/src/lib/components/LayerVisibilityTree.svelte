<script>
	import { Switch } from '@skeletonlabs/skeleton-svelte';
	import { IconChevronDown, IconChevronUp, IconEye, IconEyeOff } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	let { layers = [], osmLayer = null, onLayerVisibilityChanged = () => {} } = $props();

	let layerVisibility = $state(new Map());

	let isCollapsed = $state(false);

	$effect(() => {
		const newVisibility = new Map();

		// Add OSM layer if provided
		if (osmLayer) {
			newVisibility.set('osm-base-layer', {
				layer: osmLayer,
				visible: osmLayer.getVisible(),
				name: m.common_osm()
			});
		}

		layers.forEach((layer, index) => {
			const layerId = layer.get('layerId');
			const layerName = layer.get('layerName');

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

			layerInfo.layer.setVisible(newVisible);

			layerVisibility.set(layerId, {
				...layerInfo,
				visible: newVisible
			});

			layerVisibility = new Map(layerVisibility);

			onLayerVisibilityChanged({
				layerId,
				visible: newVisible,
				layer: layerInfo.layer
			});
		}
	}

	function toggleCollapse() {
		isCollapsed = !isCollapsed;
	}
</script>

<!-- LayerVisibilityTree -->
<div
	class="w-full max-w-sm md:w-64 p-3 md:p-2 border-1 border-surface-200-800 bg-surface-50-950 rounded-md shadow-lg md:shadow"
>
	<!-- Header with collapse functionality for mobile -->
	<div class="flex items-center justify-between md:mb-2">
		<p class="text-sm font-medium text-surface-contrast-100-900">{m.form_layer_visibility()}</p>

		<!-- Mobile collapse button -->
		<button
			class="md:hidden p-1 rounded hover:bg-surface-100-800 transition-colors"
			onclick={toggleCollapse}
			aria-label={isCollapsed ? 'Expand layers' : 'Collapse layers'}
		>
			{#if isCollapsed}
				<IconChevronDown size="20" class="text-surface-600" />
			{:else}
				<IconChevronUp size="20" class="text-surface-600" />
			{/if}
		</button>
	</div>

	<!-- Layer list - hidden on mobile when collapsed -->
	<div class="space-y-3 md:space-y-2 {isCollapsed ? 'hidden md:block' : ''}">
		{#each Array.from(layerVisibility.entries()) as [layerId, layerInfo]}
			<div
				class="flex items-center justify-between p-2 md:p-0 rounded-md hover:bg-surface-100-800 transition-colors"
			>
				<div class="flex items-center gap-3 md:gap-2 flex-1 min-w-0">
					{#if layerInfo.visible}
						<IconEye size="18" class="text-primary-500 flex-shrink-0" />
					{:else}
						<IconEyeOff size="18" class="text-surface-400 flex-shrink-0" />
					{/if}
					<span class="text-sm md:text-xs px-2 md:px-0 text-surface-contrast-100-900 truncate">
						{layerInfo.name}
					</span>
				</div>

				<Switch
					name="layer-visibility-{layerId}"
					size="sm"
					checked={layerInfo.visible}
					onCheckedChange={() => toggleLayerVisibility(layerId)}
					class="flex-shrink-0"
				>
					<Switch.Control>
						<Switch.Thumb />
					</Switch.Control>
					<Switch.HiddenInput />
				</Switch>
			</div>
		{/each}

		{#if layerVisibility.size === 0}
			<p class="text-sm md:text-xs text-surface-400 italic text-center py-2">
				{m.form_no_layers_available()}
			</p>
		{/if}
	</div>
</div>
