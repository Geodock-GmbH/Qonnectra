<script lang="ts" module>
	let created = 0;
</script>

<script lang="ts">
	import type { PipeBranchNodeRef } from './savedCanvas';

	// Stands in for the canvas: shows the project and node it was given and
	// numbers its instances, so tests can tell a fresh canvas from a reused one.
	let { projectId, node = null }: { projectId: string; node?: PipeBranchNodeRef | null } = $props();

	const instance = ++created;
</script>

<p data-testid="pipe-branch-canvas" data-instance={instance}>
	canvas for {projectId || 'no project'}{node ? ` / ${node.name}` : ''}
</p>
