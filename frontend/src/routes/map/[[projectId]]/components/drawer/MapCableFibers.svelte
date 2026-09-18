<script lang="ts">
	import { getLocale } from '$lib/paraglide/runtime';

	import FibersDisplayTable from '$lib/components/FibersDisplayTable.svelte';
	import { fiberColorHex, fiberColorName } from '$lib/utils/fiberColors';
	import { getFiberColors, getFibersForCable } from '$lib/remote/network-schema/fibers.remote';

	import { traceFrom } from '../../../../trace/traceUtils';

	let { cableUuid }: { cableUuid: string } = $props();

	const fibersRequest = $derived(getFibersForCable(cableUuid));
	const colorsRequest = getFiberColors();

	const fibers = $derived(await fibersRequest);
	const colors = $derived(await colorsRequest);
</script>

<FibersDisplayTable
	{fibers}
	getColorHex={(color) => fiberColorHex(colors, color)}
	getColorName={(color) => fiberColorName(colors, color, getLocale())}
	onTraceFiber={(fiberUuid) => traceFrom('fiber', fiberUuid)}
/>
