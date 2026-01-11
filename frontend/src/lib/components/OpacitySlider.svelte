<script>
	import { tooltip } from '$lib/utils/tooltip.js';
	import { Slider } from '@skeletonlabs/skeleton-svelte';

	import { m } from '$lib/paraglide/messages';

	let {
		minOpacity = 0,
		maxOpacity = 1,
		stepOpacity = 0.01,
		opacity = 1,
		onChange = () => {}
	} = $props();

	let sliderValue = $state([opacity]);

	function handleSkeletonSliderChange(detail) {
		const newOpacityValue = detail.value[0];
		sliderValue = [newOpacityValue];
		onChange(newOpacityValue);
	}

	$effect(() => {
		sliderValue = [opacity];
	});

	// Calculate percentage for display
	let displayPercentage = $derived(Math.round(sliderValue[0] * 100));
</script>

<!-- OpacitySlider -->
<div
	aria-label={m.tooltip_opacity_slider()}
	class="preset-filled-surface-50-950 rounded-lg border border-surface-200-800 shadow-md p-4 sm:p-3 w-full sm:min-w-[256px] sm:max-w-[280px]"
	{@attach tooltip(m.tooltip_opacity_slider(), { position: 'top', delay: 3000 })}
>
	<Slider
		value={sliderValue}
		min={minOpacity}
		max={maxOpacity}
		step={stepOpacity}
		onValueChange={handleSkeletonSliderChange}
		class="cursor-pointer touch-manipulation"
	>
		<div class="flex items-center justify-between mb-3 sm:mb-2">
			<Slider.Label class="text-sm font-medium text-surface-contrast-100-900">
				{m.common_opacity()}
			</Slider.Label>
			<span
				class="text-xs font-mono px-2 py-0.5 rounded bg-surface-200-800 text-surface-contrast-100-900"
			>
				{displayPercentage}%
			</span>
		</div>
		<Slider.Control>
			<Slider.Track class="h-2.5 sm:h-2 rounded-full bg-surface-200-800">
				<Slider.Range class="bg-primary-500 rounded-full" />
			</Slider.Track>
			<Slider.Thumb
				index={0}
				class="size-6 sm:size-4 ring-2 ring-primary-500 bg-white shadow-md touch-manipulation active:scale-110 transition-transform"
			>
				<Slider.HiddenInput name="opacity" />
			</Slider.Thumb>
		</Slider.Control>
	</Slider>
</div>
