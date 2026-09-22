<script lang="ts">
	import { page } from '$app/state';
	import { IconLoader2 } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import QueryBoundary from '$lib/components/QueryBoundary.svelte';
	import { queryString, setQuery } from '$lib/utils/urlState';

	import AddressSearch from './AddressSearch.svelte';
	import SelectedAddress from './SelectedAddress.svelte';

	let { projectId }: { projectId: string } = $props();

	/** Identifiers are uuids; anything else in the URL reads as no address. */
	const ADDRESS_ID = /^[A-Za-z0-9-]{1,64}$/;

	// `?address=<uuid>` is the workspace: present shows that address, absent
	// the search. The search text itself is input, not a place, so it stays local.
	const selectedUuid = $derived.by(() => {
		const raw = queryString(page.url, 'address');
		return ADDRESS_ID.test(raw) ? raw : null;
	});

	/**
	 * Opens an address: a place the back button returns from.
	 * @param uuid - The picked address.
	 */
	function select(uuid: string) {
		void setQuery({ address: uuid }, { push: true });
	}

	/** Returns to the search by rewriting the entry, so back never reopens the address. */
	function clear() {
		void setQuery({ address: null });
	}
</script>

{#snippet addressLoading()}
	<div class="flex items-center justify-center py-12" role="status">
		<IconLoader2 size={28} class="text-primary-500 animate-spin" />
		<span class="sr-only">{m.common_loading()}</span>
	</div>
{/snippet}

{#if selectedUuid}
	<QueryBoundary pending={addressLoading}>
		<SelectedAddress uuid={selectedUuid} {projectId} onclear={clear} />
	</QueryBoundary>
{:else}
	<AddressSearch {projectId} onselect={select} />
{/if}
