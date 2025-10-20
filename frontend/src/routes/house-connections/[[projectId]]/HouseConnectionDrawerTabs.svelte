<script>
	// Components
	import Tabs from '$lib/components/Tabs.svelte';
	import { Tabs as SkeletonTabs } from '@skeletonlabs/skeleton-svelte';
	import HouseConnectionAccordion from './HouseConnectionAccordion.svelte';
	// Paraglide
	import { m } from '$lib/paraglide/messages';

	/**
	 * @typedef {Object} Props
	 * @property {Object} featureData - Feature properties from MVT
	 * @property {string} featureType - Type of feature ('trench', 'address', 'node')
	 * @property {string} featureId - UUID of the feature
	 * @property {Object} alias - Field name alias mapping (English -> Localized)
	 */

	/** @type {Props} */
	let { featureData = {}, featureType = 'trench', featureId = '', alias = {} } = $props();

	let activeTab = $state('details');

	const tabItems = $derived([{ value: 'details', label: m.common_overview() }]);
</script>

<Tabs tabs={tabItems} bind:activeTab>
	<SkeletonTabs.Content value="details">
		<div>
			<HouseConnectionAccordion />
		</div>
	</SkeletonTabs.Content>
</Tabs>
