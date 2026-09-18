<script lang="ts" module>
	let created = 0;
</script>

<script lang="ts">
	// Stands in for the canvas: shows the project it was given and numbers its
	// instances, so tests can tell a fresh canvas from a reused one.
	let { projectId }: { projectId: string } = $props();

	const instance = ++created;
</script>

<p data-testid="pipe-branch-canvas" data-instance={instance}>
	canvas for {projectId || 'no project'}
</p>
