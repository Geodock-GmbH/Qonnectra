<script lang="ts">
	import type { NodeAssignmentManager } from '$lib/classes/NodeAssignmentManager.svelte.js';
	import { setContext } from 'svelte';
	import { Tabs as SkeletonTabs } from '@skeletonlabs/skeleton-svelte';

	import { m } from '$lib/paraglide/messages';

	import Tabs from '$lib/components/Tabs.svelte';

	import HouseConnectionAccordion from './HouseConnectionAccordion.svelte';

	interface Props {
		/** Feature properties from MVT */
		featureData?: Record<string, unknown>;
		/** Type of feature ('trench', 'address', 'node') */
		featureType?: string;
		/** UUID of the feature */
		featureId?: string;
		/** Field name alias mapping (English -> Localized) */
		alias?: Record<string, string>;
		/** NodeAssignmentManager instance */
		nodeAssignmentManager?: NodeAssignmentManager | null;
		/** Callback for highlight changes */
		onHighlightChange?: (conduitId: string, trenchUuids: string[], isOpen: boolean) => void;
	}

	let {
		featureData = {},
		featureType = 'trench',
		featureId = '',
		alias = {},
		nodeAssignmentManager = null,
		onHighlightChange
	}: Props = $props();

	// svelte-ignore state_referenced_locally
	if (nodeAssignmentManager) {
		setContext('nodeAssignmentManager', nodeAssignmentManager);
	}

	let activeTab = $state('details');

	const tabItems = $derived([{ value: 'details', label: m.common_overview() }]);
</script>

<Tabs tabs={tabItems} bind:value={activeTab}>
	<SkeletonTabs.Content value="details">
		<div>
			<HouseConnectionAccordion {onHighlightChange} />
		</div>
	</SkeletonTabs.Content>
</Tabs>
