<script>
	import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
	import { IconPlus } from '@tabler/icons-svelte';
	import { PUBLIC_API_URL } from '$env/static/public';

	import { m } from '$lib/paraglide/messages';

	import GenericCombobox from '$lib/components/GenericCombobox.svelte';
	import { globalToaster } from '$lib/stores/toaster';

	let {
		projectId,
		openPipeModal = $bindable(false),
		isHidden = false,
		editMode = false,
		pipeData = null,
		rowClickedSignal = $bindable(false),
		onPipeUpdate = (data) => {},
		conduitTypes = [],
		statuses = [],
		networkLevels = [],
		companies = [],
		flags = []
	} = $props();

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

	async function loadSelectOptions(editMode) {
		if (!editMode) {
			return;
		}
		try {
			let editData;
			const editUrl = `${PUBLIC_API_URL}conduit/${pipeData.value}/`;
			const editRes = await fetch(editUrl, { credentials: 'include' });
			if (!editRes.ok) throw new Error(`Failed to fetch ${editRes.url} (status ${editRes.status})`);
			editData = await editRes.json();

			selectedConduitName = editData.name;
			selectedOuterConduit = editData.outer_conduit;
			selectedDate = editData.date;
			selectedConduitType = [editData.conduit_type ? editData.conduit_type.id : ''];
			selectedStatus = [editData.status ? editData.status.id : ''];
			selectedNetworkLevel = [editData.network_level ? editData.network_level.id : ''];
			selectedOwner = [editData.owner ? editData.owner.id : ''];
			selectedConstructor = [editData.constructor ? editData.constructor.id : ''];
			selectedManufacturer = [editData.manufacturer ? editData.manufacturer.id : ''];
			selectedFlag = [editData.flag ? editData.flag.id : ''];
		} catch (err) {
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_fetching_select_options()
			});
			console.error(err);
		}
	}

	async function handleSubmit(event) {
		event.preventDefault();
		const formData = new FormData(event.target);
		const formProps = Object.fromEntries(formData.entries());

		const body = {
			name: formProps.pipe_name,
			project_id: projectId?.[0] ?? null,
			conduit_type_id: selectedConduitType?.[0] ?? null,
			status_id: selectedStatus?.[0] ?? null,
			network_level_id: selectedNetworkLevel?.[0] ?? null,
			owner_id: selectedOwner?.[0] ?? null,
			constructor_id: selectedConstructor?.[0] ?? null,
			manufacturer_id: selectedManufacturer?.[0] ?? null,
			flag_id: selectedFlag?.[0] ?? null,
			date: formProps.date ? formProps.date : null,
			outer_conduit: formProps.outer_conduit ?? null
		};

		// Remove null values to avoid sending empty fields
		Object.keys(body).forEach((key) => {
			if (body[key] === null || body[key] === undefined || body[key] === '') {
				delete body[key];
			}
		});

		try {
			const url = editMode
				? `${PUBLIC_API_URL}conduit/${pipeData.value}/`
				: `${PUBLIC_API_URL}conduit/`;
			const response = await fetch(url, {
				method: editMode ? 'PUT' : 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-CSRFToken': document.cookie
						.split('; ')
						.find((row) => row.startsWith('csrftoken='))
						?.split('=')[1]
				},
				body: JSON.stringify(body),
				credentials: 'include'
			});
			if (response.ok) {
				const result = await response.json();
				globalToaster.success({
					title: m.title_success(),
					description: editMode
						? m.message_success_updating_conduit()
						: m.message_success_creating_conduit()
				});
				openPipeModal = false;
				onPipeUpdate(result);
			} else {
				const errorData = await response.json();
				console.error('Error submitting form:', errorData);
				globalToaster.error({
					title: m.common_error(),
					description: editMode
						? m.message_error_updating_conduit()
						: m.message_error_duplicate_conduit()
				});
			}
		} catch (error) {
			console.error('Error submitting form:', error);
			globalToaster.error({
				title: m.common_error(),
				description: editMode
					? m.message_error_updating_conduit()
					: m.message_error_creating_conduit()
			});
		}
	}

	async function clearParameters() {
		editMode = false;
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

	$effect(async () => {
		if (rowClickedSignal) {
			editMode = true;
			await loadSelectOptions(editMode);
			openPipeModal = true;
			rowClickedSignal = false;
		}
	});
</script>

<Dialog
	bind:open={openPipeModal}
	onOpenChange={(e) => (openPipeModal = e.open)}
	closeOnInteractOutside={true}
	closeOnEscape={true}
	onInteractOutside={async () => {
		await clearParameters();
	}}
	onEscapeKeyDown={async () => {
		await clearParameters();
	}}
>
	<Dialog.Trigger
		class="btn preset-filled-primary-500 {isHidden ? 'hidden' : ''}"
		onclick={() => loadSelectOptions(editMode)}
	>
		<IconPlus size={18} />
		<span class="hidden sm:inline">{m.action_add_conduit()}</span>
	</Dialog.Trigger>

	<Portal>
		<Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-50-950/50 backdrop-blur-sm" />

		<Dialog.Positioner class="fixed inset-0 z-50 flex items-center justify-center">
			<Dialog.Content class="card bg-surface-100-900 p-4 space-y-4 shadow-xl max-w-screen-sm ">
				<Dialog.Title class="flex justify-between">
					<h2 class="h3">{m.common_attributes()}</h2>
				</Dialog.Title>

				<form
					id="pipe-form"
					class="space-y-4 grid grid-cols-2 gap-4"
					onsubmit={async (e) => {
						await handleSubmit(e);
						await clearParameters();
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
							value={selectedConduitName ?? ''}
						/>
					</label>
					<label for="pipe_type" class="label">
						<span class="label-text">{m.form_conduit_type()}</span>
						<GenericCombobox
							data={conduitTypes}
							bind:value={selectedConduitType}
							defaultValue={selectedConduitType}
							onValueChange={(e) => (selectedConduitType = e.value)}
						/>
					</label>
					<label class="label">
						<span class="label-text">{m.form_outer_conduit()}</span>
						<textarea name="outer_conduit" id="outer_conduit" class="textarea" placeholder=""
						></textarea>
					</label>
					<label for="status" class="label">
						<span class="label-text">{m.form_status()}</span>
						<GenericCombobox
							data={statuses}
							bind:value={selectedStatus}
							defaultValue={selectedStatus}
							onValueChange={(e) => (selectedStatus = e.value)}
						/>
					</label>
					<label for="network_level" class="label">
						<span class="label-text">{m.form_network_level()}</span>
						<GenericCombobox
							data={networkLevels}
							bind:value={selectedNetworkLevel}
							defaultValue={selectedNetworkLevel}
							onValueChange={(e) => (selectedNetworkLevel = e.value)}
						/>
					</label>
					<label for="owner" class="label">
						<span class="label-text">{m.form_owner()}</span>
						<GenericCombobox
							data={companies}
							bind:value={selectedOwner}
							defaultValue={selectedOwner}
							onValueChange={(e) => (selectedOwner = e.value)}
						/>
					</label>
					<label for="constructor" class="label">
						<span class="label-text">{m.form_constructor()}</span>
						<GenericCombobox
							data={companies}
							bind:value={selectedConstructor}
							defaultValue={selectedConstructor}
							onValueChange={(e) => (selectedConstructor = e.value)}
						/>
					</label>
					<label for="manufacturer" class="label">
						<span class="label-text">{m.form_manufacturer()}</span>
						<GenericCombobox
							data={companies}
							bind:value={selectedManufacturer}
							defaultValue={selectedManufacturer}
							onValueChange={(e) => (selectedManufacturer = e.value)}
						/>
					</label>
					<label for="date" class="label">
						<span class="label-text">{m.common_date()}</span>
						<input type="date" name="date" id="date" class="input" value={selectedDate} />
					</label>
					<label for="flag" class="label">
						<span class="label-text">{m.form_flag()}</span>
						<GenericCombobox
							data={flags}
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
