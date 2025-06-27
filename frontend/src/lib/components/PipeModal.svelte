<script>
	// Skeleton
	import { Modal, Combobox, Toaster, createToaster } from '@skeletonlabs/skeleton-svelte';

	// Tabler
	import { IconPlus } from '@tabler/icons-svelte';

	// Paraglide
	import { m, name } from '$lib/paraglide/messages';

	// Svelte
	import { PUBLIC_API_URL } from '$env/static/public';
	import { selectedProject } from '$lib/stores/store';

	// Toast
	const toaster = createToaster({
		placement: 'bottom-end'
	});

	let { projectId, openPipeModal, small = false } = $props();

	let conduitTypes = $state([]);
	let selectedConduitType = $state();
	let statuses = $state([]);
	let selectedStatus = $state();
	let networkLevels = $state([]);
	let selectedNetworkLevel = $state();
	let companies = $state([]);
	let selectedOwner = $state();
	let selectedConstructor = $state();
	let selectedManufacturer = $state();
	let flags = $state([]);
	let selectedFlag = $state();

	const resources = [
		'attributes_conduit_type',
		'attributes_status',
		'attributes_network_level',
		'attributes_company',
		'flags'
	];

	async function loadSelectOptions() {
		try {
			// build full URLs
			const urls = resources.map((name) => `${PUBLIC_API_URL}${name}/`);

			// fetch all endpoints in parallel
			const responses = await Promise.all(
				urls.map((url) => fetch(url, { credentials: 'include' }))
			);

			// parse all JSON bodies in parallel
			const [
				parsedConduitTypes,
				parsedStatuses,
				parsedNetworkLevels,
				parsedCompanies,
				parsedFlags
			] = await Promise.all(
				responses.map((res, index) => {
					if (!res.ok) throw new Error(`Failed to fetch ${res.url} (status ${res.status})`);
					return res.json().then((data) =>
						data.map((item) => ({
							value: item.id,
							label:
								resources[index] === 'flags'
									? item.flag
									: resources[index] === 'attributes_conduit_type'
										? item.conduit_type
										: resources[index] === 'attributes_company'
											? item.company
											: resources[index] === 'attributes_status'
												? item.status
												: resources[index] === 'attributes_network_level'
													? item.network_level
													: item.id
						}))
					);
				})
			);

			conduitTypes = parsedConduitTypes;
			statuses = parsedStatuses;
			networkLevels = parsedNetworkLevels;
			companies = parsedCompanies;
			flags = parsedFlags;
		} catch (err) {
			toaster.create({
				type: 'error',
				title: m.error(),
				description: m.error_fetching_select_options()
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
			date: formProps.date ? formProps.date.replace(/-/g, '/') : null,
			outer_conduit: formProps.outer_conduit ?? null
		};

		// Remove null values to avoid sending empty fields
		Object.keys(body).forEach((key) => {
			if (body[key] === null || body[key] === undefined || body[key] === '') {
				delete body[key];
			}
		});

		try {
			const response = await fetch(`${PUBLIC_API_URL}conduit/`, {
				method: 'POST',
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
				toaster.create({
					type: 'success',
					title: m.title_login_success(),
					description: m.success_creating_conduit()
				});
				openPipeModal = false;
			} else {
				const errorData = await response.json();
				console.error('Error creating conduit:', errorData);
				toaster.create({
					type: 'error',
					title: m.error(),
					description: m.error_duplicate_conduit()
				});
			}
		} catch (error) {
			console.error('Error submitting form:', error);
			toaster.create({
				type: 'error',
				title: m.error(),
				description: m.error_creating_conduit()
			});
		}
	}
</script>

<Toaster {toaster}></Toaster>

<Modal
	open={openPipeModal}
	onclick={loadSelectOptions}
	onOpenChange={(e) => (openPipeModal = e.open)}
	triggerBase={small ? 'btn-icon preset-filled-primary-500' : 'btn preset-filled-primary-500'}
	contentBase="card bg-surface-100-900 p-4 space-y-4 shadow-xl max-w-screen-sm"
	backdropClasses="backdrop-blur-sm"
>
	{#snippet trigger()}
		{#if small}
			<IconPlus size={18} />
		{:else}
			{m.add_conduit()}
		{/if}
	{/snippet}
	{#snippet content()}
		<header class="flex justify-between">
			<h2 class="h3">{m.add_conduit()}</h2>
		</header>
		<form
			id="pipe-form"
			class="mx-auto w-full max-w-md space-y-4 grid grid-cols-2 gap-4"
			onsubmit={handleSubmit}
		>
			<label class="label">
				<span class="label-text">{m.name()}</span>
				<input type="text" class="input" placeholder="" name="pipe_name" required />
			</label>
			<label for="pipe_type" class="label">
				<span class="label-text">{m.conduit_type()}</span>
				<Combobox
					name="pipe_type"
					class="select"
					id="pipe_type"
					data={conduitTypes}
					zIndex="10"
					required
					bind:value={selectedConduitType}
					onValueChange={(e) => (selectedConduitType = e.value)}
				/>
			</label>
			<label class="label">
				<span class="label-text">{m.outer_conduit()}</span>
				<textarea name="outer_conduit" id="outer_conduit" class="textarea" placeholder=""
				></textarea>
			</label>
			<label for="status" class="label">
				<span class="label-text">{m.status()}</span>
				<Combobox
					name="status"
					class="select"
					id="status"
					data={statuses}
					zIndex="10"
					bind:value={selectedStatus}
					onValueChange={(e) => (selectedStatus = e.value)}
				/>
			</label>
			<label for="network_level" class="label">
				<span class="label-text">{m.network_level()}</span>
				<Combobox
					name="network_level"
					class="select"
					id="network_level"
					data={networkLevels}
					zIndex="10"
					bind:value={selectedNetworkLevel}
					onValueChange={(e) => (selectedNetworkLevel = e.value)}
				/>
			</label>
			<label for="owner" class="label">
				<span class="label-text">{m.owner()}</span>
				<Combobox
					name="owner"
					class="select"
					id="owner"
					data={companies}
					zIndex="10"
					bind:value={selectedOwner}
					onValueChange={(e) => (selectedOwner = e.value)}
				/>
			</label>
			<label for="constructor" class="label">
				<span class="label-text">{m.constructor()}</span>
				<Combobox
					name="constructor"
					class="select"
					id="constructor"
					data={companies}
					zIndex="10"
					bind:value={selectedConstructor}
					onValueChange={(e) => (selectedConstructor = e.value)}
				/>
			</label>
			<label for="manufacturer" class="label">
				<span class="label-text">{m.manufacturer()}</span>

				<Combobox
					name="manufacturer"
					class="select"
					id="manufacturer"
					data={companies}
					zIndex="10"
					bind:value={selectedManufacturer}
					onValueChange={(e) => (selectedManufacturer = e.value)}
				/>
			</label>
			<label for="date" class="label">
				<span class="label-text">{m.date()}</span>
				<input type="date" name="date" id="date" class="input" format="yyyy-MM-dd" />
			</label>
			<label for="flag" class="label">
				<span class="label-text">{m.flag()}</span>
				<Combobox
					name="flag"
					class="select"
					id="flag"
					data={flags}
					zIndex="10"
					bind:value={selectedFlag}
					required
					onValueChange={(e) => (selectedFlag = e.value)}
				/>
			</label>
		</form>

		<footer class="flex justify-end gap-4">
			<button type="button" class="btn preset-tonal" onclick={() => (openPipeModal = false)}>
				Cancel
			</button>
			<button type="submit" class="btn preset-filled" form="pipe-form"> Confirm </button>
		</footer>
	{/snippet}
</Modal>
