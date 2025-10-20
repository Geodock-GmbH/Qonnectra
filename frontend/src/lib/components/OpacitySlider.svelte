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
	let sliderValue = $state([opacity]);

	function handleSkeletonSliderChange(detail) {
		const newOpacityValue = detail.value[0];
		sliderValue = [newOpacityValue];
		onChange(newOpacityValue);
	}

	// Update sliderValue when opacity prop changes
	$effect(() => {
		sliderValue = [opacity];
	});
</script>

<!-- OpacitySlider -->
<div class="preset-filled-surface-50-950 rounded-md shadow lg:min-w-[256px] p-3">
	<Slider
		value={sliderValue}
		min={minOpacity}
		max={maxOpacity}
		step={stepOpacity}
		onValueChange={handleSkeletonSliderChange}
		class="cursor-pointer"
	>
		<Slider.Label class="text-sm text-surface-contrast-100-900 mb-2">
			{m.common_opacity()}
		</Slider.Label>
		<Slider.Control>
			<Slider.Track class="h-3 sm:h-2">
				<Slider.Range class="bg-primary-500" />
			</Slider.Track>
			<Slider.Thumb index={0} class="size-6 sm:size-4 ring-primary-500 touch-manipulation">
				<Slider.HiddenInput name="opacity" />
			</Slider.Thumb>
		</Slider.Control>
	</Slider>
</div>
