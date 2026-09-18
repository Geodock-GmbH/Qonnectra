<script lang="ts">
	import type { FaultSimulationState } from './FaultSimulationState.svelte';
	import { untrack } from 'svelte';

	import FaultSimulationPopUp from './FaultSimulationPopUp.svelte';
	import { setFaultSimulationState } from './FaultSimulationState.svelte';

	let { simulation, ...rest }: { simulation: FaultSimulationState; [key: string]: unknown } =
		$props();

	setFaultSimulationState(untrack(() => simulation));
</script>

<FaultSimulationPopUp {...rest} />
