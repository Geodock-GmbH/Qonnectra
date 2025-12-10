<script>
	import { getContext } from 'svelte';
	import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
	import { IconPlus } from '@tabler/icons-svelte';
	import { deserialize } from '$app/forms';

	import { m } from '$lib/paraglide/messages';

	import GenericCombobox from '$lib/components/GenericCombobox.svelte';
	import { globalToaster } from '$lib/stores/toaster';

	let {
		projectId,
		openPipeModal = $bindable(false),
		isHidden = false,
		onPipeCreate = (data) => {}
	} = $props();

	// Get attribute options from context (no more prop drilling)
	const attributes = getContext('attributeOptions') || {
		conduitTypes: [],
		statuses: [],
		networkLevels: [],
		companies: [],
		flags: []
	};

	let selectedConduitName = $state('');
	let selectedOuterConduit = $state('');
	let selectedConduitType = $state([]);
	let selectedStatus = $state([]);
	let selectedNetworkLevel = $state([]);
	let selectedOwner = $state([]);
	let selectedConstructor = $state([]);
	let selectedManufacturer = $state([]);
	let selectedDate = $state('');
	let selectedFlag = $state([]);

	async function handleSubmit(event) {
		event.preventDefault();
		const formData = new FormData(event.target);
		const formProps = Object.fromEntries(formData.entries());

		// Build form data for server action
		const actionFormData = new FormData();
		actionFormData.append('name', formProps.pipe_name);
		if (projectId?.[0]) actionFormData.append('project_id', projectId[0]);
		if (selectedConduitType?.[0]) actionFormData.append('conduit_type_id', selectedConduitType[0]);
		if (selectedStatus?.[0]) actionFormData.append('status_id', selectedStatus[0]);
		if (selectedNetworkLevel?.[0])
			actionFormData.append('network_level_id', selectedNetworkLevel[0]);
		if (selectedOwner?.[0]) actionFormData.append('owner_id', selectedOwner[0]);
		if (selectedConstructor?.[0]) actionFormData.append('constructor_id', selectedConstructor[0]);
		if (selectedManufacturer?.[0])
			actionFormData.append('manufacturer_id', selectedManufacturer[0]);
		if (selectedFlag?.[0]) actionFormData.append('flag_id', selectedFlag[0]);
		if (formProps.date) actionFormData.append('date', formProps.date);
		if (formProps.outer_conduit) actionFormData.append('outer_conduit', formProps.outer_conduit);

		try {
			const response = await fetch('?/createConduit', {
				method: 'POST',
				body: actionFormData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				globalToaster.error({
					title: m.common_error(),
					description: result.data?.message || m.message_error_creating_conduit()
				});
				return;
			}

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_creating_conduit()
			});
			openPipeModal = false;
			onPipeCreate(result.data?.conduit);
			clearParameters();
		} catch (error) {
			console.error('Error creating conduit:', error);
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_creating_conduit()
			});
		}
	}

	function clearParameters() {
		selectedConduitName = '';
		selectedOuterConduit = '';
		selectedDate = '';
		selectedConduitType = [];
		selectedStatus = [];
		selectedNetworkLevel = [];
		selectedOwner = [];
		selectedConstructor = [];
		selectedManufacturer = [];
		selectedFlag = [];
	}
</script>

<Dialog
	bind:open={openPipeModal}
	onOpenChange={(e) => (openPipeModal = e.open)}
	closeOnInteractOutside={true}
	closeOnEscape={true}
	onInteractOutside={() => {
		clearParameters();
	}}
	onEscapeKeyDown={() => {
		clearParameters();
	}}
>
	<Dialog.Trigger class="btn preset-filled-primary-500 {isHidden ? 'hidden' : ''}">
		<IconPlus size={18} />
		<span class="hidden sm:inline">{m.action_add_conduit()}</span>
	</Dialog.Trigger>

	<Portal>
		<Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-50-950/50 backdrop-blur-sm" />

		<Dialog.Positioner class="fixed inset-0 z-50 flex items-center justify-center">
			<Dialog.Content class="card bg-surface-100-900 p-4 space-y-4 shadow-xl max-w-screen-sm ">
				<Dialog.Title class="flex justify-between">
					<h2 class="h3">{m.action_add_conduit()}</h2>
				</Dialog.Title>

				<form
					id="pipe-form"
					class="space-y-4 grid grid-cols-2 gap-4"
					onsubmit={async (e) => {
						await handleSubmit(e);
					}}
				>
					<label class="label">
						<span class="label-text">{m.common_name()}</span>
						<input
							type="text"
							class="input"
							placeholder=""
							name="pipe_name"
							required
							value={selectedConduitName}
							oninput={(e) => (selectedConduitName = e.target.value)}
						/>
					</label>
					<label for="pipe_type" class="label">
						<span class="label-text">{m.form_conduit_type()}</span>
						<GenericCombobox
							data={attributes.conduitTypes}
							bind:value={selectedConduitType}
							defaultValue={selectedConduitType}
							onValueChange={(e) => (selectedConduitType = e.value)}
						/>
					</label>
					<label class="label">
						<span class="label-text">{m.form_outer_conduit()}</span>
						<textarea
							name="outer_conduit"
							id="outer_conduit"
							class="textarea"
							placeholder=""
							value={selectedOuterConduit}
							oninput={(e) => (selectedOuterConduit = e.target.value)}
						></textarea>
					</label>
					<label for="status" class="label">
						<span class="label-text">{m.form_status()}</span>
						<GenericCombobox
							data={attributes.statuses}
							bind:value={selectedStatus}
							defaultValue={selectedStatus}
							onValueChange={(e) => (selectedStatus = e.value)}
						/>
					</label>
					<label for="network_level" class="label">
						<span class="label-text">{m.form_network_level()}</span>
						<GenericCombobox
							data={attributes.networkLevels}
							bind:value={selectedNetworkLevel}
							defaultValue={selectedNetworkLevel}
							onValueChange={(e) => (selectedNetworkLevel = e.value)}
						/>
					</label>
					<label for="owner" class="label">
						<span class="label-text">{m.form_owner()}</span>
						<GenericCombobox
							data={attributes.companies}
							bind:value={selectedOwner}
							defaultValue={selectedOwner}
							onValueChange={(e) => (selectedOwner = e.value)}
						/>
					</label>
					<label for="constructor" class="label">
						<span class="label-text">{m.form_constructor()}</span>
						<GenericCombobox
							data={attributes.companies}
							bind:value={selectedConstructor}
							defaultValue={selectedConstructor}
							onValueChange={(e) => (selectedConstructor = e.value)}
						/>
					</label>
					<label for="manufacturer" class="label">
						<span class="label-text">{m.form_manufacturer()}</span>
						<GenericCombobox
							data={attributes.companies}
							bind:value={selectedManufacturer}
							defaultValue={selectedManufacturer}
							onValueChange={(e) => (selectedManufacturer = e.value)}
						/>
					</label>
					<label for="date" class="label">
						<span class="label-text">{m.common_date()}</span>
						<input
							type="date"
							name="date"
							id="date"
							class="input"
							value={selectedDate}
							oninput={(e) => (selectedDate = e.target.value)}
						/>
					</label>
					<label for="flag" class="label">
						<span class="label-text">{m.form_flag()}</span>
						<GenericCombobox
							data={attributes.flags}
							bind:value={selectedFlag}
							defaultValue={selectedFlag}
							onValueChange={(e) => (selectedFlag = e.value)}
						/>
					</label>
				</form>

				<footer class="flex justify-end gap-4">
					<button type="submit" class="btn preset-filled" form="pipe-form">
						{m.common_confirm()}
					</button>
				</footer>
			</Dialog.Content>
		</Dialog.Positioner>
	</Portal>
</Dialog>
