<script>
	import { BaseEdge, getStraightPath } from '@xyflow/svelte';

	let { id, sourceX, sourceY, targetX, targetY } = $props();

	let [edgePath] = $derived(
		getStraightPath({
			sourceX,
			sourceY,
			targetX,
			targetY
		})
	);
</script>

<BaseEdge {id} path={edgePath} />
