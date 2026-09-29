<script lang="ts">
	import { page } from '$app/state';
	import { Tabs as SkeletonTabs } from '@skeletonlabs/skeleton-svelte';

	import { m } from '$lib/paraglide/messages';

	import QueryBoundary from '$lib/components/QueryBoundary.svelte';
	import Tabs from '$lib/components/Tabs.svelte';
	import { displayProperties, featureTitle } from '$lib/map/featureDetails';
	import { queryEnum, setQuery } from '$lib/utils/urlState';
	import { routeProjectId } from '$lib/context/project';
	import { getFeatureDetails } from '$lib/remote/map/feature-search.remote';

	import HouseConnectionAccordion from './HouseConnectionAccordion.svelte';

	let {
		uuid,
		title = $bindable('')
	}: {
		/** The trench named in the URL. */
		uuid: string;
		/** The drawer header, reported up once the trench is known. */
		title?: string;
	} = $props();

	// The page re-keys this component per trench, so the lookup runs once per drawer.
	// svelte-ignore state_referenced_locally
	const trench = await getFeatureDetails({
		featureType: 'trench',
		featureUuid: uuid,
		projectId: routeProjectId()
	});
	title = featureTitle('trench', displayProperties('trench', trench.properties));

	const TAB_VALUES = ['details'] as const;

	const tabItems = [{ value: 'details', label: m.common_overview() }];

	// The tab lives in the URL; the default is never written.
	const activeTab = $derived(queryEnum(page.url, 'tab', TAB_VALUES, 'details'));
</script>

<Tabs tabs={tabItems} value={activeTab} onValueChange={(tab) => setQuery({ tab })}>
	<SkeletonTabs.Content value="details">
		<QueryBoundary>
			<HouseConnectionAccordion featureId={uuid} />
		</QueryBoundary>
	</SkeletonTabs.Content>
</Tabs>
