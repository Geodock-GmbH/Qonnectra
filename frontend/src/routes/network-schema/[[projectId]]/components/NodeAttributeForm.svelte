<script lang="ts">
	import type {
		AttributeOptions,
		ComboboxOption,
		FkRef,
		NodeDrawerProps
	} from '$lib/types/attributeCardTypes';
	import { untrack } from 'svelte';

	import { m } from '$lib/paraglide/messages';

	import GenericCombobox from '$lib/components/GenericCombobox.svelte';
	import VirtualCombobox from '$lib/components/VirtualCombobox.svelte';
	import { globalToaster } from '$lib/stores/toaster';
	import { logToBackendClient } from '$lib/utils/logToBackendClient';
	import { tooltip } from '$lib/utils/tooltip';
	import { updateNode } from '$lib/remote/network-schema/nodes.remote';

	let {
		node,
		attributes,
		nodeTypeDisabled,
		parentNodeDisabled,
		isCheckingDependencies,
		onLabelUpdate
	}: {
		node: NodeDrawerProps;
		attributes: AttributeOptions;
		nodeTypeDisabled: boolean;
		parentNodeDisabled: boolean;
		isCheckingDependencies: boolean;
		onLabelUpdate?: (name: string) => void;
	} = $props();

	/**
	 * Build the editable field state from the node prop's current value. Read via
	 * `untrack` because it is intentionally a one-time initialisation: the parent
	 * remounts this component via `{#key id}` when a different node is opened, so
	 * there is no prop-to-state effect and the warning would be spurious.
	 */
	function initialFields(source: NodeDrawerProps) {
		const toOption = (ref: FkRef | null | undefined) => (ref?.id != null ? [String(ref.id)] : []);
		return {
			name: source.name || '',
			nodeType: toOption(source.node_type),
			status: toOption(source.status),
			networkLevel: toOption(source.network_level),
			owner: toOption(source.owner),
			constructor: toOption(source.constructor as FkRef | null | undefined),
			manufacturer: toOption(source.manufacturer),
			warranty: source.warranty || '',
			date: source.date || '',
			flag: toOption(source.flag),
			parentNode: source.parent_node?.uuid ?? ''
		};
	}

	const id = untrack(() => node.id || '');
	const initial = untrack(() => initialFields(node));

	let nodeName = $state(initial.name);
	let nodeType = $state<string[]>(initial.nodeType);
	let nodeStatus = $state<string[]>(initial.status);
	let nodeNetworkLevel = $state<string[]>(initial.networkLevel);
	let nodeOwner = $state<string[]>(initial.owner);
	let nodeConstructor = $state<string[]>(initial.constructor);
	let nodeManufacturer = $state<string[]>(initial.manufacturer);
	let nodeWarranty = $state(initial.warranty);
	let nodeDate = $state(initial.date);
	let nodeFlag = $state<string[]>(initial.flag);
	let nodeParentNode = $state(initial.parentNode);

	const availableNodes = $derived(
		(attributes.parentNodeOptions || []).filter((n: ComboboxOption) => n.value !== id)
	);

	/**
	 * Parse a single-select combobox value list into a number id, or undefined.
	 * @param value - The combobox value array.
	 */
	function toId(value: string[]): number | undefined {
		const raw = value?.[0];
		return raw ? parseInt(raw, 10) : undefined;
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();

		try {
			await updateNode({
				nodeId: id,
				name: nodeName || undefined,
				nodeTypeId: toId(nodeType),
				statusId: toId(nodeStatus),
				networkLevelId: toId(nodeNetworkLevel),
				ownerId: toId(nodeOwner),
				constructorId: toId(nodeConstructor),
				manufacturerId: toId(nodeManufacturer),
				flagId: toId(nodeFlag),
				warranty: nodeWarranty || undefined,
				date: nodeDate || undefined,
				parentNodeId: nodeParentNode || undefined
			});

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_updating_node()
			});
			if (onLabelUpdate && nodeName) {
				onLabelUpdate(nodeName);
			}
		} catch (error) {
			console.error('Error updating node:', error);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error updating node',
				extraData: {
					from: 'NodeAttributeForm.handleSubmit',
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined
				}
			});
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_updating_node()
			});
		}
	}
</script>

<!-- Node form -->
<form id="node-form" class="flex flex-col gap-4 mr-4" onsubmit={handleSubmit}>
	<label class="label">
		<span class="text-sm">{m.common_name()}</span>
		<input
			id="node-name"
			type="text"
			class="input"
			placeholder=""
			name="node_name"
			required
			value={nodeName}
			oninput={(e) => (nodeName = (e.target as HTMLInputElement).value)}
		/>
	</label>
	<label
		class="label"
		{@attach tooltip(
			m.message_node_type_locked_has_children_and_cables?.() ||
				'Node type cannot be changed (has children and cables)',
			{ disabled: !nodeTypeDisabled || isCheckingDependencies }
		)}
	>
		<span class="text-sm">{m.form_node_type()}</span>
		<GenericCombobox
			data={attributes.nodeTypes}
			bind:value={nodeType}
			defaultValue={nodeType}
			onValueChange={(e) => (nodeType = e.value)}
			disabledValues={attributes.excludedNodeTypeIds}
			disabled={nodeTypeDisabled}
			renderInPlace={true}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_status()}</span>
		<GenericCombobox
			data={attributes.statuses}
			bind:value={nodeStatus}
			defaultValue={nodeStatus}
			onValueChange={(e) => (nodeStatus = e.value)}
			renderInPlace={true}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_network_level()}</span>
		<GenericCombobox
			data={attributes.networkLevels}
			bind:value={nodeNetworkLevel}
			defaultValue={nodeNetworkLevel}
			onValueChange={(e) => (nodeNetworkLevel = e.value)}
			renderInPlace={true}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_owner()}</span>
		<GenericCombobox
			data={attributes.companies}
			bind:value={nodeOwner}
			defaultValue={nodeOwner}
			onValueChange={(e) => (nodeOwner = e.value)}
			renderInPlace={true}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_constructor()}</span>
		<GenericCombobox
			data={attributes.companies}
			bind:value={nodeConstructor}
			defaultValue={nodeConstructor}
			onValueChange={(e) => (nodeConstructor = e.value)}
			renderInPlace={true}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_manufacturer()}</span>
		<GenericCombobox
			data={attributes.companies}
			bind:value={nodeManufacturer}
			defaultValue={nodeManufacturer}
			onValueChange={(e) => (nodeManufacturer = e.value)}
			renderInPlace={true}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_warranty()}</span>
		<input
			id="node-warranty"
			type="date"
			class="input"
			name="warranty"
			value={nodeWarranty}
			oninput={(e) => (nodeWarranty = (e.target as HTMLInputElement).value)}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.common_date()}</span>
		<input
			id="node-date"
			type="date"
			class="input"
			name="date"
			value={nodeDate}
			oninput={(e) => (nodeDate = (e.target as HTMLInputElement).value)}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_flag()}</span>
		<GenericCombobox
			data={attributes.flags}
			bind:value={nodeFlag}
			defaultValue={nodeFlag}
			onValueChange={(e) => (nodeFlag = e.value)}
			renderInPlace={true}
		/>
	</label>
	<label
		class="label"
		{@attach tooltip(
			m.message_parent_node_locked_has_cables?.() || 'Parent node cannot be changed (has cables)',
			{ disabled: !parentNodeDisabled || isCheckingDependencies }
		)}
	>
		<span class="text-sm">{m.form_parent_node_name()}</span>
		<VirtualCombobox
			data={availableNodes}
			bind:value={nodeParentNode}
			disabled={parentNodeDisabled}
			placeholder={m.form_parent_node_name()}
			renderInPlace={true}
		/>
	</label>
</form>
