<script>
	// Skeleton
	import { Combobox, Modal, Toaster, createToaster } from '@skeletonlabs/skeleton-svelte';
	// Tabler
	import { IconPlus } from '@tabler/icons-svelte';

	// Paraglide
	import { m } from '$lib/paraglide/messages';
	// Svelte
	import { PUBLIC_API_URL } from '$env/static/public';

	// Toast
	const toaster = createToaster({
		placement: 'bottom-end'
	});

	let {
		projectId,
		openPipeModal,
		small = false,
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
			toaster.error({
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
				toaster.success({
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
				toaster.error({
					title: m.common_error(),
					description: editMode
						? m.message_error_updating_conduit()
						: m.message_error_duplicate_conduit()
				});
			}
		} catch (error) {
			console.error('Error submitting form:', error);
			toaster.error({
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

<Toaster {toaster}></Toaster>

<Modal
	open={openPipeModal}
	onclick={() => loadSelectOptions(editMode)}
	onOpenChange={(e) => (openPipeModal = e.open)}
	triggerBase={small ? 'btn-icon preset-filled-primary-500' : 'btn preset-filled-primary-500'}
	contentBase="card bg-surface-100-900 p-4 space-y-4 shadow-xl max-w-screen-sm"
	backdropClasses="backdrop-blur-sm"
	classes={isHidden ? 'hidden' : ''}
	onPointerDownOutside={async (e) => {
		await clearParameters();
	}}
	onInteractOutside={async (e) => {
		await clearParameters();
	}}
	onEscapeKeyDown={async (e) => {
		await clearParameters();
	}}
>
	{#snippet trigger()}
		{#if small}
			<IconPlus size={18} />
		{:else}
			{m.action_add_conduit()}
		{/if}
	{/snippet}
	{#snippet content()}
		<header class="flex justify-between">
			<h2 class="h3">{m.common_attributes()}</h2>
		</header>
		<form
			id="pipe-form"
			class="mx-auto w-full max-w-md space-y-4 grid grid-cols-2 gap-4"
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
				<Combobox
					name="pipe_type"
					class="select"
					id="pipe_type"
					data={conduitTypes}
					zIndex="10"
					required
					value={selectedConduitType}
					onValueChange={(e) => (selectedConduitType = e.value)}
					defaultValue={selectedConduitType}
					contentBase="max-h-60 overflow-auto"
				/>
			</label>
			<label class="label">
				<span class="label-text">{m.form_outer_conduit()}</span>
				<textarea name="outer_conduit" id="outer_conduit" class="textarea" placeholder=""
				></textarea>
			</label>
			<label for="status" class="label">
				<span class="label-text">{m.form_status()}</span>
				<Combobox
					name="status"
					class="select"
					id="status"
					data={statuses}
					zIndex="10"
					value={selectedStatus}
					onValueChange={(e) => (selectedStatus = e.value)}
					defaultValue={selectedStatus}
					contentBase="max-h-60 overflow-auto"
				/>
			</label>
			<label for="network_level" class="label">
				<span class="label-text">{m.form_network_level()}</span>
				<Combobox
					name="network_level"
					class="select"
					id="network_level"
					data={networkLevels}
					zIndex="10"
					value={selectedNetworkLevel}
					onValueChange={(e) => (selectedNetworkLevel = e.value)}
					defaultValue={selectedNetworkLevel}
				/>
			</label>
			<label for="owner" class="label">
				<span class="label-text">{m.form_owner()}</span>
				<Combobox
					name="owner"
					class="select"
					id="owner"
					data={companies}
					zIndex="10"
					value={selectedOwner}
					onValueChange={(e) => (selectedOwner = e.value)}
					defaultValue={selectedOwner}
				/>
			</label>
			<label for="constructor" class="label">
				<span class="label-text">{m.form_constructor()}</span>
				<Combobox
					name="constructor"
					class="select"
					id="constructor"
					data={companies}
					zIndex="10"
					value={selectedConstructor}
					onValueChange={(e) => (selectedConstructor = e.value)}
					contentBase="max-h-60 overflow-auto"
					defaultValue={selectedConstructor}
				/>
			</label>
			<label for="manufacturer" class="label">
				<span class="label-text">{m.form_manufacturer()}</span>

				<Combobox
					name="manufacturer"
					class="select"
					id="manufacturer"
					data={companies}
					zIndex="10"
					value={selectedManufacturer}
					onValueChange={(e) => (selectedManufacturer = e.value)}
					contentBase="max-h-60 overflow-auto"
					defaultValue={selectedManufacturer}
				/>
			</label>
			<label for="date" class="label">
				<span class="label-text">{m.common_date()}</span>
				<input type="date" name="date" id="date" class="input" value={selectedDate} />
			</label>
			<label for="flag" class="label">
				<span class="label-text">{m.form_flag()}</span>
				<Combobox
					name="flag"
					class="select"
					id="flag"
					data={flags}
					zIndex="10"
					value={selectedFlag}
					required
					onValueChange={(e) => (selectedFlag = e.value)}
					contentBase="max-h-60 overflow-auto"
					defaultValue={selectedFlag}
				/>
			</label>
		</form>

		<footer class="flex justify-end gap-4">
			<button type="submit" class="btn preset-filled" form="pipe-form">
				{m.common_confirm()}
			</button>
		</footer>
	{/snippet}
</Modal>
