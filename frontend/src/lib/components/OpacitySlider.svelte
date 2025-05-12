<script>
	// Skeleton
	import { Slider } from '@skeletonlabs/skeleton-svelte';

	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// Svelte
	import { createEventDispatcher } from 'svelte';

	let { minOpacity = 0, maxOpacity = 1, stepOpacity = 0.01, opacity = 1 } = $props();

	const dispatch = createEventDispatcher();

	// Skeleton Slider expects value to be an array.
	// $derived will recompute sliderValue whenever 'opacity' prop changes.
	let sliderValue = $derived([opacity]);

	function handleSkeletonSliderChange(detail) {
		const newOpacityValue = detail.value[0];
		dispatch('change', newOpacityValue);
		// The parent (Map.svelte) is responsible for updating the 'opacity' prop based on this event.
		// When 'opacity' prop updates, 'sliderValue' will automatically update due to $derived.
	}
</script>

<div class="w-sm p-2 bg-surface-50-950 rounded-md shadow">
	<p class="text-sm text-surface-contrast-100-900">{m.opacity()}</p>
	<Slider
		name="opacity"
		value={sliderValue}
		min={minOpacity}
		max={maxOpacity}
		step={stepOpacity}
		onValueChange={handleSkeletonSliderChange}
		meterBg="bg-primary-500"
		thumbRingColor="ring-primary-500"
		height="h-2"
		thumbSize="size-4"
	/>
</div>
