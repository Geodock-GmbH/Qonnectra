<script lang="ts">
	import { m } from '$lib/paraglide/messages';

	import { DEFAULT_ADDRESS_COLOR, DEFAULT_ADDRESS_SIZE } from '$lib/map/styles';
	import { addressStyle } from '$lib/stores/store';

	import SizeSlider from './SizeSlider.svelte';
	import StyleCard from './StyleCard.svelte';
	import StyleSection from './StyleSection.svelte';
	import { randomHexColor, randomSize } from './styleRecords';

	/** Restores the built-in address color and size. */
	function reset() {
		$addressStyle = { color: DEFAULT_ADDRESS_COLOR, size: DEFAULT_ADDRESS_SIZE };
	}

	/** Gives the address points a random color and size. */
	function randomize() {
		$addressStyle = { color: randomHexColor(), size: randomSize() };
	}
</script>

<StyleSection
	title={m.settings_address_style()}
	resetLabel={m.common_reset()}
	onrandomize={randomize}
	onreset={reset}
>
	<div class="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
		<StyleCard
			name={m.form_address_points()}
			color={$addressStyle.color}
			colorInputName="color-address"
			oncolorchange={(color) => ($addressStyle = { ...$addressStyle, color })}
			onreset={reset}
		>
			{#snippet preview()}
				<span
					class="rounded-full shadow-sm transition-all"
					style:background-color={$addressStyle.color}
					style:width="{$addressStyle.size * 4}px"
					style:height="{$addressStyle.size * 4}px"
				></span>
			{/snippet}

			<SizeSlider
				size={$addressStyle.size}
				onsizechange={(size) => ($addressStyle = { ...$addressStyle, size })}
			/>
		</StyleCard>
	</div>
</StyleSection>
