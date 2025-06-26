<script>
	// Paraglide
	import { m } from '$lib/paraglide/messages';
	// Svelte
	import PipeTable from '$lib/components/PipeTable.svelte';

	// Svelte
	import { selectedProject } from '$lib/stores/store';
</script>

<a href="/conduit/download" download class="btn preset-filled-primary-500">
	{m.download_template()}
</a>

<PipeTable projectId={$selectedProject} />
