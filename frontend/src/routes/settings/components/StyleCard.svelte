<script lang="ts">
	import type { Snippet } from 'svelte';

	import { m } from '$lib/paraglide/messages';

	let {
		name,
		color,
		colorInputName,
		oncolorchange,
		onreset,
		preview,
		children
	}: {
		name: string;
		color: string;
		colorInputName: string;
		oncolorchange: (color: string) => void;
		onreset: () => void;
		/** How the style looks on the map. */
		preview: Snippet;
		/** Controls beyond the color, e.g. size and shape. */
		children?: Snippet;
	} = $props();
</script>

<div
	class="card preset-filled-surface-100-900 relative group rounded-lg border border-surface-200-800 p-4 hover:border-surface-400-600 transition-colors"
>
	<div class="flex items-center justify-between mb-4">
		<h3 class="font-medium text-sm truncate pr-2">{name}</h3>
		<button
			type="button"
			class="text-xs hover:text-primary-500 opacity-0 group-hover:opacity-100 transition-opacity"
			onclick={onreset}
		>
			{m.common_reset()}
		</button>
	</div>

	<div class="flex items-center justify-center mb-4 py-3 bg-surface-100-800 rounded">
		{@render preview()}
	</div>

	<div class="space-y-3">
		<div class="flex items-center gap-3">
			<label class="relative cursor-pointer">
				<input
					type="color"
					name={colorInputName}
					value={color}
					onchange={(e) => oncolorchange(e.currentTarget.value)}
					class="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
				/>
				<span
					class="block w-8 h-8 rounded-md border-2 border-surface-200-700 hover:border-primary-500 transition-colors shadow-sm"
					style:background-color={color}
				></span>
			</label>
			<span class="text-xs flex-1">{m.settings_node_type_color()}</span>
			<span class="text-xs font-mono">{color}</span>
		</div>

		{@render children?.()}
	</div>
</div>
