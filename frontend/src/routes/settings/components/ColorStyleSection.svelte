<script lang="ts">
	import type { StyleStore } from './styleRecords';
	import type { LayerStyleAttributes } from '$lib/remote/map/layer-data';
	import { fromStore } from 'svelte/store';

	import { m } from '$lib/paraglide/messages';

	import { DEFAULT_AREA_COLOR, DEFAULT_TRENCH_COLOR } from '$lib/map/styles';
	import {
		areaTypeStyles,
		trenchConstructionTypeStyles,
		trenchSurfaceStyles
	} from '$lib/stores/store';
	import { getLayerStyleAttributes } from '$lib/remote/map/layers.remote';

	import StyleCard from './StyleCard.svelte';
	import StyleSection from './StyleSection.svelte';
	import { randomHexColor, restyle, restyleAll, seedMissingStyles } from './styleRecords';

	type ColorStyle = { color: string; visible: boolean };
	type ColorStyleKind = 'surface' | 'construction_type' | 'area_type';

	interface KindConfig {
		title: () => string;
		styles: StyleStore<ColorStyle>;
		names: (attributes: LayerStyleAttributes) => string[];
		defaultColor: string;
		colorInputName: string;
	}

	const KINDS: Record<ColorStyleKind, KindConfig> = {
		surface: {
			title: () => m.settings_surface_styles(),
			styles: trenchSurfaceStyles,
			names: (attributes) => attributes.surfaces.map((surface) => surface.surface),
			defaultColor: DEFAULT_TRENCH_COLOR,
			colorInputName: 'color-surface'
		},
		construction_type: {
			title: () => m.settings_construction_type_styles(),
			styles: trenchConstructionTypeStyles,
			names: (attributes) => attributes.constructionTypes.map((type) => type.construction_type),
			defaultColor: DEFAULT_TRENCH_COLOR,
			colorInputName: 'color-construction-type'
		},
		area_type: {
			title: () => m.settings_area_type_styles(),
			styles: areaTypeStyles,
			names: (attributes) => attributes.areaTypes.map((type) => type.area_type),
			defaultColor: DEFAULT_AREA_COLOR,
			colorInputName: 'color-area-type'
		}
	};

	let { kind }: { kind: ColorStyleKind } = $props();

	const config = $derived(KINDS[kind]);
	const stored = $derived(fromStore(config.styles));
	const names = $derived(config.names(await getLayerStyleAttributes()));

	const defaultStyle = (): ColorStyle => ({ color: config.defaultColor, visible: true });
	const randomStyle = (): ColorStyle => ({ color: randomHexColor(), visible: true });

	/**
	 * @param name - Attribute name.
	 * @param color - The picked color.
	 */
	function setColor(name: string, color: string) {
		restyle(config.styles, [name], () => ({ color, visible: true }));
	}
</script>

<StyleSection
	title={config.title()}
	onrandomize={names.length > 0 ? () => restyleAll(config.styles, names, randomStyle) : undefined}
	onreset={names.length > 0 ? () => restyleAll(config.styles, names, defaultStyle) : undefined}
>
	{#if names.length === 0}
		<div class="mt-6 text-sm">{m.form_no_data_available()}</div>
	{:else}
		<div
			class="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
			{@attach () => seedMissingStyles(config.styles, names, defaultStyle)}
		>
			{#each names as name (name)}
				{@const color = stored.current[name]?.color ?? config.defaultColor}
				<StyleCard
					{name}
					{color}
					colorInputName={config.colorInputName}
					oncolorchange={(picked) => setColor(name, picked)}
					onreset={() => restyle(config.styles, [name], defaultStyle)}
				>
					{#snippet preview()}
						{#if kind === 'area_type'}
							<span
								class="w-12 h-8 rounded shadow-sm transition-all border-2"
								style:background-color={color}
								style:border-color={color}
								style:opacity="0.3"
							></span>
						{:else}
							<span class="h-1 w-16 rounded shadow-sm transition-all" style:background-color={color}
							></span>
						{/if}
					{/snippet}
				</StyleCard>
			{/each}
		</div>
	{/if}
</StyleSection>
