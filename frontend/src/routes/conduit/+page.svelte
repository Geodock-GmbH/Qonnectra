<script>
	// Skeleton
	import { FileUpload } from '@skeletonlabs/skeleton-svelte';

	// Tabler
	import { IconUpload, IconPlus } from '@tabler/icons-svelte';

	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// Svelte
	import PipeTable from '$lib/components/PipeTable.svelte';
	import PipeModal from '$lib/components/PipeModal.svelte';
	import { selectedProject } from '$lib/stores/store';

	let openPipeModal = $state(false);
	let rowData = $state(null);
	let rowClickedSignal = $state(false);
</script>

<div class="flex justify-between items-center">
	<div class="flex justify-start">
		<nav class="btn-group preset-outlined-surface-200-800 flex-col p-2 md:flex-row">
			<PipeModal
				projectId={$selectedProject}
				{openPipeModal}
				pipeData={rowData}
				bind:rowClickedSignal
			/>
		</nav>
	</div>

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
</div>

<PipeTable projectId={$selectedProject} bind:rowData bind:rowClickedSignal />
