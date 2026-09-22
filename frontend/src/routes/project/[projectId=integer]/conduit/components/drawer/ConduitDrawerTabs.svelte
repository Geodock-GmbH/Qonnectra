<script lang="ts">
	import { m } from '$lib/paraglide/messages';

	import FileExplorer from '$lib/components/FileExplorer.svelte';
	import FileUpload from '$lib/components/FileUpload.svelte';
	import QueryBoundary from '$lib/components/QueryBoundary.svelte';
	import Tabs from '$lib/components/Tabs.svelte';

	import ConduitAttributeCard from './ConduitAttributeCard.svelte';
	import ConduitMicroductStatus from './ConduitMicroductStatus.svelte';

	// The drawer store spreads an untyped props bag; only `uuid` is read here.
	let { uuid = '' }: { uuid?: string; [key: string]: unknown } = $props();

	let group = $state('attributes');

	const tabItems = [
		{ value: 'attributes', label: m.common_attributes() },
		{ value: 'status', label: m.form_status() },
		{ value: 'files', label: m.form_attachments() }
	];

	let fileExplorer = $state<ReturnType<typeof FileExplorer> | null>(null);

	function handleUploadComplete() {
		fileExplorer?.refresh();
	}
</script>

{#key uuid}
	<Tabs tabs={tabItems} bind:value={group}>
		{#if group === 'attributes'}
			<QueryBoundary>
				<ConduitAttributeCard {uuid} />
			</QueryBoundary>
		{/if}

		{#if group === 'status'}
			<div class="p-4">
				<QueryBoundary>
					<ConduitMicroductStatus conduitUuid={uuid} />
				</QueryBoundary>
			</div>
		{/if}

		{#if group === 'files'}
			<div class="space-y-4">
				<FileUpload
					featureType="conduit"
					featureId={uuid}
					onUploadComplete={handleUploadComplete}
				/>
				<FileExplorer bind:this={fileExplorer} featureType="conduit" featureId={uuid} />
			</div>
		{/if}
	</Tabs>
{/key}
