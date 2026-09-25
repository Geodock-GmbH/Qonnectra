<script lang="ts">
	import type { SchemaFeatureKind } from './DrawerTabs.svelte';
	import type { Snippet } from 'svelte';

	import { m } from '$lib/paraglide/messages';

	import { SchemaPanelsState } from '$lib/classes/SchemaPanelsState.svelte';
	import FloatingPanel from '$lib/components/FloatingPanel.svelte';
	import NodeSlotConfigPanel from '$lib/components/node-structure/NodeSlotConfigPanel.svelte';
	import NodeStructurePanel from '$lib/components/node-structure/NodeStructurePanel.svelte';
	import { getSchemaState, setSchemaPanels } from '$lib/context/networkSchemaContext';

	import CableMicropipePanel from './CableMicropipePanel.svelte';

	interface SchemaPanelsProps {
		/** The feature kind the drawer shows; one host lives per kind. */
		kind: SchemaFeatureKind;
		/** The node or cable uuid the drawer shows. */
		id: string;
		/** The feature's name, as the drawer header shows it. */
		name: string;
		/** The drawer tabs, which open the panels through context. */
		children: Snippet;
	}

	let { kind, id, name, children }: SchemaPanelsProps = $props();

	const schemaState = getSchemaState();
	const panels = new SchemaPanelsState();
	setSchemaPanels(panels);
</script>

{@render children()}

<!-- An open panel follows the selection within its kind; its content is keyed by the feature, so it loads the one now selected. -->
{#if kind === 'node' && panels.slotConfigOpen}
	<FloatingPanel
		bind:open={panels.slotConfigOpen}
		title={m.title_slot_configuration()}
		storageKey="network-schema-slot-config"
		width={900}
		height={600}
		maxWidth={1920}
		maxHeight={1080}
	>
		{#key id}
			<NodeSlotConfigPanel
				nodeUuid={id}
				nodeName={name}
				onViewStructure={(slotConfigUuid) => panels.openStructure(id, slotConfigUuid)}
				bind:sharedSlotState={panels.sharedSlotState}
			/>
		{/key}
	</FloatingPanel>
{/if}

{#if kind === 'node' && panels.structureOpen}
	<FloatingPanel
		bind:open={panels.structureOpen}
		title={m.title_node_structure()}
		storageKey="network-schema-node-structure"
		width={900}
		height={600}
		minWidth={600}
		minHeight={400}
		maxWidth={1920}
		maxHeight={1080}
	>
		{#key id}
			<NodeStructurePanel
				nodeUuid={id}
				initialSlotConfigUuid={panels.structureStartFor(id)}
				bind:sharedSlotState={panels.sharedSlotState}
			/>
		{/key}
	</FloatingPanel>
{/if}

{#if kind === 'cable' && panels.micropipeOpen}
	<FloatingPanel
		bind:open={panels.micropipeOpen}
		title={m.title_cable_micropipe_linking()}
		storageKey="network-schema-micropipes"
		width={1200}
		height={700}
		minWidth={800}
		minHeight={500}
		maxWidth={1920}
		maxHeight={1080}
	>
		{#key id}
			<CableMicropipePanel
				cableId={id}
				cableName={name}
				onClose={() => (panels.micropipeOpen = false)}
				onLinkageChange={() => schemaState.refreshCable(id)}
			/>
		{/key}
	</FloatingPanel>
{/if}
