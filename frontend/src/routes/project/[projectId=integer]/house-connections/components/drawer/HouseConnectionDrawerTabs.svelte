<script lang="ts">
	import { Tabs as SkeletonTabs } from '@skeletonlabs/skeleton-svelte';

	import { m } from '$lib/paraglide/messages';

	import QueryBoundary from '$lib/components/QueryBoundary.svelte';
	import Tabs from '$lib/components/Tabs.svelte';
	import { displayProperties, featureTitle } from '$lib/map/featureDetails';
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

	let activeTab = $state('details');

	const tabItems = [{ value: 'details', label: m.common_overview() }];
</script>

<Tabs tabs={tabItems} bind:value={activeTab}>
	<SkeletonTabs.Content value="details">
		<QueryBoundary>
			<HouseConnectionAccordion featureId={uuid} />
		</QueryBoundary>
	</SkeletonTabs.Content>
</Tabs>
