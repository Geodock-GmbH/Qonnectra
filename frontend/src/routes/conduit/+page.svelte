<script>
	// Skeleton
	import { FileUpload } from '@skeletonlabs/skeleton-svelte';

	// Tabler
	import { IconUpload } from '@tabler/icons-svelte';

	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// Svelte
	import PipeTable from '$lib/components/PipeTable.svelte';
	import { selectedProject } from '$lib/stores/store';
</script>

<div class="flex justify-end">
	<nav class="btn-group preset-outlined-surface-200-800 flex-col p-2 md:flex-row">
		<FileUpload
			name="example-button"
			accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
			onFileChange={console.log}
			maxFiles={1}
		>
			<button class="btn preset-filled-primary-500">
				<IconUpload class="size-4" />
				<span>{m.import_conduit_xlsx()}</span>
			</button>
		</FileUpload>
		<a href="/conduit/download" download class="btn preset-filled-primary-500">
			{m.download_template()}
		</a>
	</nav>
</div>

<PipeTable projectId={$selectedProject} />
