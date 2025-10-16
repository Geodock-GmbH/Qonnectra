<script>
	// Components
	import Tabs from '$lib/components/Tabs.svelte';
	import { Tabs as SkeletonTabs } from '@skeletonlabs/skeleton-svelte';
	import FeatureAttributeCard from '$lib/components/FeatureAttributeCard.svelte';
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

	let group = $state('attributes');

	const tabItems = $derived(() => {
		const baseTabs = [{ value: 'attributes', label: m.common_attributes() }];
		return baseTabs;
	});
</script>

<Tabs tabs={tabItems()} bind:value={group}>
	<SkeletonTabs.Content value="attributes">
		<FeatureAttributeCard properties={featureData} {featureType} {alias} />
	</SkeletonTabs.Content>
</Tabs>
