<script lang="ts">
	import type { FaultSimulationState } from './FaultSimulationState.svelte';
	import { untrack } from 'svelte';

	import DamageReport from './DamageReport.svelte';
	import { setFaultSimulationState } from './FaultSimulationState.svelte';

	let { simulation, projectId }: { simulation: FaultSimulationState; projectId: string } = $props();

	setFaultSimulationState(untrack(() => simulation));
</script>

<DamageReport {projectId} />
