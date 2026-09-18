<script lang="ts">
	import { m } from '$lib/paraglide/messages';

	import { selectedProject } from '$lib/stores/store';

	import PostCompactionWorkspace from './components/PostCompactionWorkspace.svelte';
</script>

<svelte:head>
	<title>{m.nav_post_compaction()}</title>
</svelte:head>

<div class="mx-auto max-w-4xl space-y-6">
	<div class="card p-4 sm:p-6">
		<div class="flex items-center gap-3 mb-4">
			<div>
				<h1 class="text-xl sm:text-2xl font-bold">{m.nav_post_compaction()}</h1>
				<p class="text-sm text-surface-600-400">{m.pc_description()}</p>
			</div>
		</div>

		<!-- Another project starts from an empty search. -->
		{#key $selectedProject}
			<PostCompactionWorkspace projectId={$selectedProject} />
		{/key}
	</div>
</div>
