<script lang="ts">
	import type { AttributeOptions, NodeDrawerProps } from '$lib/types/attributeCardTypes';
	import { getContext } from 'svelte';
	import { page } from '$app/stores';

	import { m } from '$lib/paraglide/messages';

	import MessageBox from '$lib/components/MessageBox.svelte';
	import { drawerStore } from '$lib/stores/drawer';
	import { globalToaster } from '$lib/stores/toaster';
	import { logToBackendClient } from '$lib/utils/logToBackendClient';
	import { tooltip } from '$lib/utils/tooltip';
	import {
		deleteNode as deleteNodeCommand,
		getNodeDependencies
	} from '$lib/remote/network-schema/nodes.remote';

	import NodeAttributeForm from './NodeAttributeForm.svelte';

	const attributes = getContext<AttributeOptions>('attributeOptions') || {
		nodeTypes: [],
		statuses: [],
		networkLevels: [],
		companies: [],
		flags: [],
		excludedNodeTypeIds: [],
		parentNodeOptions: []
	};

	const isChildView = $derived($page.url.pathname.includes('/node/'));

	let node = $derived($drawerStore.props as NodeDrawerProps | undefined);
	let id = $derived(node?.id || '');
	const projectId = $derived($page.params.projectId as string | undefined);

	let {
		onLabelUpdate,
		onNodeDelete
	}: { onLabelUpdate?: (name: string) => void; onNodeDelete?: (id: string) => void } = $props();

	let deleteMessageBox = $state<ReturnType<typeof MessageBox> | null>(null);
	let cableBlockedMessageBox = $state<ReturnType<typeof MessageBox> | null>(null);

	// The dependency query re-runs whenever the node id changes; its reactive
	// `.current` lets the form render immediately while the flags settle. Empty
	// while loading (or between nodes) so nothing is spuriously locked.
	const dependencies = $derived(id ? getNodeDependencies({ nodeId: id, projectId }) : undefined);
	const isCheckingDependencies = $derived(dependencies?.loading ?? false);
	const hasConnectedCables = $derived(dependencies?.current?.hasCables ?? false);
	const hasChildren = $derived(dependencies?.current?.hasChildren ?? false);
	const hasChildrenWithCables = $derived(dependencies?.current?.hasChildrenWithCables ?? false);
	const pendingDeleteCableCount = $derived(dependencies?.current?.cables.length ?? 0);
	const pendingDeleteStructureCount = $derived(dependencies?.current?.structures.length ?? 0);

	/** Disabled when node has both children and cables, as changing type would break the hierarchy. */
	const nodeTypeDisabled = $derived(isCheckingDependencies || (hasChildren && hasConnectedCables));
	/** Disabled when in child view and node already has cables, to prevent re-parenting a wired node. */
	const parentNodeDisabled = $derived(
		isChildView && (isCheckingDependencies || hasConnectedCables)
	);

	function confirmDelete() {
		if (!id) return;
		if (hasConnectedCables) {
			cableBlockedMessageBox?.open();
			return;
		}
		deleteMessageBox?.open();
	}

	async function handleDelete() {
		if (!id) return;

		try {
			await deleteNodeCommand(id);

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_deleting_node?.() || 'Node deleted successfully'
			});
			drawerStore.close();
			onNodeDelete?.(id);
		} catch (error) {
			console.error('Error deleting node:', error);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error deleting node',
				extraData: {
					from: 'CableDiagramNodeAttributeCard.handleDelete',
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined
				}
			});
			globalToaster.error({
				title: m.common_error(),
				description:
					(error instanceof Error ? error.message : null) ||
					m.message_error_deleting_node?.() ||
					'Failed to delete node'
			});
		}
	}

	let deleteMessage = $derived.by(() => {
		const parts: string[] = [];
		if (pendingDeleteCableCount > 0) {
			parts.push(`${pendingDeleteCableCount} ${m.form_cables?.() || 'cables'}`);
		}
		if (pendingDeleteStructureCount > 0) {
			parts.push(`${pendingDeleteStructureCount} ${m.form_components?.() || 'components'}`);
		}

		if (parts.length > 0) {
			return `${m.message_confirm_delete_node?.() || 'Are you sure you want to delete this node?'} ${parts.join(', ')} ${m.common_will_be_deleted?.() || 'will be deleted'}.`;
		}
		return m.message_confirm_delete_node?.() || 'Are you sure you want to delete this node?';
	});
</script>

<!-- Node form (keyed so a different node remounts and re-initialises fields) -->
{#key id}
	{#if node}
		<NodeAttributeForm
			{node}
			{attributes}
			{nodeTypeDisabled}
			{parentNodeDisabled}
			{isCheckingDependencies}
			{onLabelUpdate}
		/>
	{/if}
{/key}

<!-- Update buttons -->
<div
	class="sticky bottom-0 mt-6 mr-4 flex flex-col items-end justify-end gap-3 bg-surface-50-950 pb-2 pt-4"
>
	<button type="submit" form="node-form" class="btn preset-filled-primary-500 w-full">
		{m.action_save()}
	</button>
	<button
		type="button"
		onclick={confirmDelete}
		disabled={isCheckingDependencies || hasConnectedCables || hasChildrenWithCables}
		{@attach tooltip(
			hasChildrenWithCables
				? m.message_cannot_delete_node_children_have_cables?.() ||
						'Cannot delete: child nodes have cables'
				: m.message_cannot_delete_node_has_cables(),
			{ disabled: !hasConnectedCables && !hasChildrenWithCables }
		)}
		class="btn preset-filled-error-500 w-full disabled:opacity-50 disabled:cursor-not-allowed"
	>
		{m.action_delete_node?.() || 'Delete Node'}
	</button>
</div>

<!-- Delete confirmation modal -->
<MessageBox
	bind:this={deleteMessageBox}
	heading={m.common_confirm()}
	message={deleteMessage}
	showAcceptButton={true}
	acceptText={m.common_delete()}
	onAccept={handleDelete}
/>

<!-- Cable blocked modal - shown when cables are connected to node -->
<MessageBox
	bind:this={cableBlockedMessageBox}
	heading={m.common_warning()}
	message={m.message_cannot_delete_node_has_cables()}
	showAcceptButton={false}
/>
