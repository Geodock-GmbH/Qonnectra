<script>
	// Skeleton
	import { Slider } from '@skeletonlabs/skeleton-svelte';

	// Paraglide
	import { m } from '$lib/paraglide/messages';

	let {
		minOpacity = 0,
		maxOpacity = 1,
		stepOpacity = 0.01,
		opacity = 1,
		onChange = () => {}
	} = $props();

	// Skeleton Slider expects value to be an array.
	let sliderValue = $derived([opacity]);

	function handleSkeletonSliderChange(detail) {
		const newOpacityValue = detail.value[0];
		onChange(newOpacityValue);
	}
</script>

<!-- OpacitySlider -->
<div class="w-full sm:w-sm p-3 lg:p-4 bg-surface-50-950 rounded-md shadow">
	<p class="text-sm text-surface-contrast-100-900 mb-2">{m.common_opacity()}</p>
	<Slider
		name="opacity"
		value={sliderValue}
		min={minOpacity}
		max={maxOpacity}
		step={stepOpacity}
		onValueChange={handleSkeletonSliderChange}
		meterBg="bg-primary-500"
		thumbRingColor="ring-primary-500"
		height="h-3 sm:h-2"
		thumbSize="size-6 sm:size-4"
		class="touch-manipulation"
	/>
</div>
