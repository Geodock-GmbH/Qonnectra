<script lang="ts">
	import { m } from '$lib/paraglide/messages';

	import FileExplorer from '$lib/components/FileExplorer.svelte';
	import FileUpload from '$lib/components/FileUpload.svelte';
	import QueryBoundary from '$lib/components/QueryBoundary.svelte';
	import Tabs from '$lib/components/Tabs.svelte';
	import { getConduit } from '$lib/remote/conduit/conduits.remote';

	import ConduitAttributeCard from './ConduitAttributeCard.svelte';
	import ConduitMicroductStatus from './ConduitMicroductStatus.svelte';

	let {
		uuid,
		title = $bindable('')
	}: {
		/** The conduit named in the URL. */
		uuid: string;
		/** The drawer header, reported up once the conduit is known. */
		title?: string;
	} = $props();

	// The page re-keys this component per uuid, so the conduit loads once per
	// drawer; the attribute card shares the same query.
	// svelte-ignore state_referenced_locally
	const conduit = await getConduit(uuid);
	title = conduit.name;

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

<Tabs tabs={tabItems} bind:value={group}>
	{#if group === 'attributes'}
		<QueryBoundary>
			<ConduitAttributeCard {uuid} onrename={(name) => (title = name)} />
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
			<FileUpload featureType="conduit" featureId={uuid} onUploadComplete={handleUploadComplete} />
			<FileExplorer bind:this={fileExplorer} featureType="conduit" featureId={uuid} />
		</div>
	{/if}
</Tabs>
