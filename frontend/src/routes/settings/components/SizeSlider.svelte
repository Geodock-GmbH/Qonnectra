<script lang="ts">
	import { Slider } from '@skeletonlabs/skeleton-svelte';

	import { m } from '$lib/paraglide/messages';

	let { size, onsizechange }: { size: number; onsizechange: (size: number) => void } = $props();
</script>

<div class="flex items-center gap-3">
	<span class="text-xs w-16">{m.settings_node_type_size()}</span>
	<div class="flex-1">
		<Slider value={[size]} onValueChange={(e) => onsizechange(e.value[0])} max={30} min={3}>
			<Slider.Control>
				<Slider.Track>
					<Slider.Range class="bg-primary-500" />
				</Slider.Track>
				<Slider.Thumb index={0} class="ring-primary-500">
					<Slider.HiddenInput />
				</Slider.Thumb>
			</Slider.Control>
		</Slider>
	</div>
	<span class="text-xs font-mono w-4 text-right">{size}</span>
</div>
