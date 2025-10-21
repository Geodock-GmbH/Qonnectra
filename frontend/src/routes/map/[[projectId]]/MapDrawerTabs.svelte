<script>
	import { Tabs as SkeletonTabs } from '@skeletonlabs/skeleton-svelte';

	import { m } from '$lib/paraglide/messages';

	import FeatureAttributeCard from '$lib/components/FeatureAttributeCard.svelte';
	import Tabs from '$lib/components/Tabs.svelte';

	/**
	 * @typedef {Object} Props
	 * @property {Object} featureData - Feature properties from MVT
	 * @property {string} featureType - Type of feature ('trench', 'address', 'node')
	 * @property {string} featureId - UUID of the feature
	 * @property {Object} alias - Field name alias mapping (English -> Localized)
	 */

	/** @type {Props} */
	let { featureData = {}, featureType = 'trench', featureId = '', alias = {} } = $props();

	let activeTab = $state('attributes');

	const tabItems = $derived([{ value: 'attributes', label: m.common_attributes() }]);
</script>

<Tabs tabs={tabItems} bind:activeTab>
	<SkeletonTabs.Content value="attributes">
		<FeatureAttributeCard properties={featureData} {featureType} {alias} />
	</SkeletonTabs.Content>
</Tabs>
