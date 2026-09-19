<script lang="ts">
	import { m } from '$lib/paraglide/messages';

	import { getNodeTypeDefault } from '$lib/map/styles';
	import { nodeTypeStyles } from '$lib/stores/store';
	import { getLayerStyleAttributes } from '$lib/remote/map/layers.remote';

	import SizeSlider from './SizeSlider.svelte';
	import StyleCard from './StyleCard.svelte';
	import StyleSection from './StyleSection.svelte';
	import {
		randomHexColor,
		randomSize,
		restyle,
		restyleAll,
		seedMissingStyles
	} from './styleRecords';

	type NodeShape = 'circle' | 'square';
	type NodeTypeStyle = { color: string; size: number; visible: boolean; shape: NodeShape };

	const SHAPES: { shape: NodeShape; title: () => string; class: string }[] = [
		{ shape: 'square', title: () => m.settings_shape_square(), class: 'rounded-sm' },
		{ shape: 'circle', title: () => m.settings_shape_circle(), class: 'rounded-full' }
	];

	const names = $derived((await getLayerStyleAttributes()).nodeTypes.map((type) => type.node_type));

	/**
	 * @param name - Node type name.
	 * @returns The type's built-in style.
	 */
	function defaultStyle(name: string): NodeTypeStyle {
		const { color, size, shape } = getNodeTypeDefault(name);
		return { color, size, shape, visible: true };
	}

	/**
	 * @param name - Node type name.
	 * @returns The stored style, completed with the built-in shape for styles saved without one.
	 */
	function styleOf(name: string): NodeTypeStyle {
		const stored = $nodeTypeStyles[name];
		if (!stored) return defaultStyle(name);
		return stored.shape ? stored : { ...stored, shape: getNodeTypeDefault(name).shape };
	}

	/**
	 * @param name - Node type name.
	 * @param change - The style properties to overwrite.
	 */
	function update(name: string, change: Partial<NodeTypeStyle>) {
		restyle(nodeTypeStyles, [name], () => ({ ...styleOf(name), ...change }));
	}

	/** Gives every node type a random color and size, keeping its shape. */
	function randomizeAll() {
		restyleAll(nodeTypeStyles, names, (name) => ({
			...styleOf(name),
			color: randomHexColor(),
			size: randomSize()
		}));
	}
</script>

<StyleSection
	title={m.settings_node_type_styles()}
	onrandomize={names.length > 0 ? randomizeAll : undefined}
	onreset={names.length > 0 ? () => restyleAll(nodeTypeStyles, names, defaultStyle) : undefined}
>
	{#if names.length === 0}
		<div class="mt-6 text-sm">{m.form_no_data_available()}</div>
	{:else}
		<div
			class="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
			{@attach () => seedMissingStyles(nodeTypeStyles, names, defaultStyle)}
		>
			{#each names as name (name)}
				{@const style = styleOf(name)}
				<StyleCard
					{name}
					color={style.color}
					colorInputName="color-node-type"
					oncolorchange={(color) => update(name, { color })}
					onreset={() => restyle(nodeTypeStyles, [name], defaultStyle)}
				>
					{#snippet preview()}
						<span
							class={[
								'shadow-sm transition-all',
								style.shape === 'circle' ? 'rounded-full' : 'rounded-sm'
							]}
							style:background-color={style.color}
							style:width="{style.size * 4}px"
							style:height="{style.size * 4}px"
						></span>
					{/snippet}

					<SizeSlider size={style.size} onsizechange={(size) => update(name, { size })} />

					<div class="flex items-center gap-3">
						<span class="text-xs w-16">{m.settings_node_type_shape()}</span>
						<div class="flex gap-2">
							{#each SHAPES as option (option.shape)}
								<button
									type="button"
									class={[
										'w-8 h-8 border-2 rounded-md flex items-center justify-center transition-colors',
										style.shape === option.shape
											? 'border-primary-500 bg-primary-500/10'
											: 'border-surface-300-700 hover:border-surface-400-600'
									]}
									onclick={() => update(name, { shape: option.shape })}
									title={option.title()}
									aria-pressed={style.shape === option.shape}
								>
									<span class={['w-4 h-4', option.class]} style:background-color={style.color}
									></span>
								</button>
							{/each}
						</div>
					</div>
				</StyleCard>
			{/each}
		</div>
	{/if}
</StyleSection>
