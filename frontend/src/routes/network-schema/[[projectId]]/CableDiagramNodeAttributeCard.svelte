<script>
	import { getContext } from 'svelte';
	import { deserialize } from '$app/forms';

	import { m } from '$lib/paraglide/messages';

	import GenericCombobox from '$lib/components/GenericCombobox.svelte';
	import { drawerStore } from '$lib/stores/drawer';
	import { globalToaster } from '$lib/stores/toaster';

	const attributes = getContext('attributeOptions') || {
		nodeTypes: [],
		statuses: [],
		networkLevels: [],
		companies: [],
		flags: []
	};

	let node = $derived($drawerStore.props);
	let id = $derived(node?.id || '');
	let nodeName = $derived(node?.name || '');
	let nodeType = $derived([node?.node_type?.id]);
	let nodeStatus = $derived([node?.status?.id]);
	let nodeNetworkLevel = $derived([node?.network_level?.id]);
	let nodeOwner = $derived([node?.owner?.id]);
	let nodeConstructor = $derived([node?.constructor?.id]);
	let nodeManufacturer = $derived([node?.manufacturer?.id]);
	let nodeWarranty = $derived(node?.warranty || '');
	let nodeDate = $derived(node?.date || '');
	let nodeFlag = $derived([node?.flag?.id]);

	let { onLabelUpdate } = $props();

	$effect(() => {
		if (node) {
			nodeName = node.name || '';
			nodeType = [node.node_type?.id];
			nodeStatus = [node.status?.id];
			nodeNetworkLevel = [node.network_level?.id];
			nodeOwner = [node.owner?.id];
			nodeConstructor = [node.constructor?.id];
			nodeManufacturer = [node.manufacturer?.id];
			nodeWarranty = node.warranty || '';
			nodeDate = node.date || '';
			nodeFlag = [node.flag?.id];
		}
	});

	async function handleSubmit(event) {
		event.preventDefault();
		const formData = new FormData(event.target);
		formData.append('uuid', id);
		formData.append('node_type_id', nodeType?.[0] || '');
		formData.append('status_id', nodeStatus?.[0] || '');
		formData.append('network_level_id', nodeNetworkLevel?.[0] || '');
		formData.append('owner_id', nodeOwner?.[0] || '');
		formData.append('constructor_id', nodeConstructor?.[0] || '');
		formData.append('manufacturer_id', nodeManufacturer?.[0] || '');
		formData.append('flag_id', nodeFlag?.[0] || '');

		try {
			const response = await fetch('?/updateNode', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure') {
				globalToaster.error({
					title: m.common_error(),
					description: m.message_error_updating_cable()
				});
				return;
			}

			if (result.type === 'error') {
				const errorMessage = result.error?.message;
				globalToaster.error({
					title: m.common_error(),
					description: m.message_error_updating_cable()
				});
				return;
			}

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_updating_cable()
			});
			if (onLabelUpdate && nodeName) {
				onLabelUpdate(nodeName);
			}
		} catch (error) {
			console.error('Error updating node:', error);
			globalToaster.error({
				title: m.message_error_updating_cable()
			});
		}
	}
</script>

<!-- Node form -->
<form id="node-form" class="flex flex-col gap-4" onsubmit={handleSubmit}>
	<label class="label">
		<span class="label-text">{m.common_name()}</span>
		<input
			type="text"
			class="input"
			placeholder=""
			name="node_name"
			required
			value={nodeName}
			oninput={(e) => (nodeName = e.target.value)}
		/>
	</label>
	<label class="label">
		<span class="label-text">{m.form_node_type()}</span>
		<GenericCombobox
			data={attributes.nodeTypes}
			bind:value={nodeType}
			defaultValue={nodeType}
			onValueChange={(e) => (nodeType = e.value)}
		/>
	</label>
	<label class="label">
		<span class="label-text">{m.form_status()}</span>
		<GenericCombobox
			data={attributes.statuses}
			bind:value={nodeStatus}
			defaultValue={nodeStatus}
			onValueChange={(e) => (nodeStatus = e.value)}
		/>
	</label>
	<label class="label">
		<span class="label-text">{m.form_network_level()}</span>
		<GenericCombobox
			data={attributes.networkLevels}
			bind:value={nodeNetworkLevel}
			defaultValue={nodeNetworkLevel}
			onValueChange={(e) => (nodeNetworkLevel = e.value)}
		/>
	</label>
	<label class="label">
		<span class="label-text">{m.form_owner()}</span>
		<GenericCombobox
			data={attributes.companies}
			bind:value={nodeOwner}
			defaultValue={nodeOwner}
			onValueChange={(e) => (nodeOwner = e.value)}
		/>
	</label>
	<label class="label">
		<span class="label-text">{m.form_constructor()}</span>
		<GenericCombobox
			data={attributes.companies}
			bind:value={nodeConstructor}
			defaultValue={nodeConstructor}
			onValueChange={(e) => (nodeConstructor = e.value)}
		/>
	</label>
	<label class="label">
		<span class="label-text">{m.form_manufacturer()}</span>
		<GenericCombobox
			data={attributes.companies}
			bind:value={nodeManufacturer}
			defaultValue={nodeManufacturer}
			onValueChange={(e) => (nodeManufacturer = e.value)}
		/>
	</label>
	<label class="label">
		<span class="label-text">{m.form_warranty()}</span>
		<input
			type="date"
			class="input"
			name="warranty"
			value={nodeWarranty}
			oninput={(e) => (nodeWarranty = e.target.value)}
		/>
	</label>
	<label class="label">
		<span class="label-text">{m.common_date()}</span>
		<input
			type="date"
			class="input"
			name="date"
			value={nodeDate}
			oninput={(e) => (nodeDate = e.target.value)}
		/>
	</label>
	<label class="label">
		<span class="label-text">{m.form_flag()}</span>
		<GenericCombobox
			data={attributes.flags}
			bind:value={nodeFlag}
			defaultValue={nodeFlag}
			onValueChange={(e) => (nodeFlag = e.value)}
		/>
	</label>
</form>

<!-- Update buttons -->
<div class="mt-6 flex flex-col items-end justify-end gap-3">
	<button type="submit" form="node-form" class="btn preset-filled w-full">
		{m.action_save()}
	</button>
</div>
