<script lang="ts">
	import type { SchemaFeatureKind } from './DrawerTabs.svelte';

	import QueryBoundary from '$lib/components/QueryBoundary.svelte';

	import DrawerTabs from './DrawerTabs.svelte';
	import SchemaPanels from './SchemaPanels.svelte';

	interface SchemaDrawerBodyProps {
		/** The feature kind named in the URL. */
		kind: SchemaFeatureKind;
		/** The node or cable uuid named in the URL. */
		id: string;
		/** The drawer header, reported up once the record is known and after a rename. */
		title?: string;
	}

	let { kind, id, title = $bindable('') }: SchemaDrawerBodyProps = $props();
</script>

<!-- The tabs start fresh per feature. The floating panels start fresh per kind, so they stay open while another feature of the same kind is selected. -->
{#key kind}
	<SchemaPanels {kind} {id} name={title}>
		{#key id}
			<QueryBoundary>
				<DrawerTabs {kind} {id} bind:title />
			</QueryBoundary>
		{/key}
	</SchemaPanels>
{/key}
