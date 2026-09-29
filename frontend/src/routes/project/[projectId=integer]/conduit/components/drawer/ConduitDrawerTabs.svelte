<script lang="ts">
	import { page } from '$app/state';

	import { m } from '$lib/paraglide/messages';

	import FileExplorer from '$lib/components/FileExplorer.svelte';
	import FileUpload from '$lib/components/FileUpload.svelte';
	import QueryBoundary from '$lib/components/QueryBoundary.svelte';
	import Tabs from '$lib/components/Tabs.svelte';
	import { queryEnum, setQuery } from '$lib/utils/urlState';
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

	const TAB_VALUES = ['attributes', 'status', 'files'] as const;

	const tabItems = [
		{ value: 'attributes', label: m.common_attributes() },
		{ value: 'status', label: m.form_status() },
		{ value: 'files', label: m.form_attachments() }
	];

	// The tab lives in the URL; the default is never written.
	const group = $derived(queryEnum(page.url, 'tab', TAB_VALUES, 'attributes'));

	let fileExplorer = $state<ReturnType<typeof FileExplorer> | null>(null);

	function handleUploadComplete() {
		fileExplorer?.refresh();
	}
</script>

<Tabs tabs={tabItems} value={group} onValueChange={(tab) => setQuery({ tab })}>
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
