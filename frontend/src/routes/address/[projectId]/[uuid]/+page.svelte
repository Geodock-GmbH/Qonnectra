<script>
	import { deserialize } from '$app/forms';
	import { goto } from '$app/navigation';
	import { IconArrowLeft, IconTrash } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { globalToaster } from '$lib/stores/toaster';

	let { data } = $props();

	let isSaving = $state(false);
	let isDeleting = $state(false);
	let showDeleteConfirm = $state(false);

	// Derive values from data (reactive)
	const address = $derived(data.address);
	const projectId = $derived(data.projectId);
	const addressError = $derived(data.addressError);
	const statusDevelopments = $derived(data.statusDevelopments);
	const flags = $derived(data.flags);

	// Form values - initialize from address
	let street = $state(data.address?.street || '');
	let housenumber = $state(data.address?.housenumber ?? '');
	let house_number_suffix = $state(data.address?.house_number_suffix || '');
	let zip_code = $state(data.address?.zip_code || '');
	let city = $state(data.address?.city || '');
	let district = $state(data.address?.district || '');
	let status_development_id = $state(data.address?.status_development?.id || '');
	let flag_id = $state(data.address?.flag?.id || '');

	async function handleSave() {
		isSaving = true;
		const formData = new FormData();
		formData.append('street', street);
		formData.append('housenumber', housenumber.toString());
		formData.append('house_number_suffix', house_number_suffix);
		formData.append('zip_code', zip_code);
		formData.append('city', city);
		formData.append('district', district);
		if (status_development_id)
			formData.append('status_development_id', status_development_id.toString());
		if (flag_id) formData.append('flag_id', flag_id.toString());

		try {
			const response = await fetch('?/updateAddress', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'success') {
				globalToaster.success({
					title: m.title_success(),
					description: m.message_success_updating_address()
				});
			} else {
				globalToaster.error({
					title: m.common_error(),
					description: result.data?.message || m.message_error_updating_address()
				});
			}
		} catch (error) {
			console.error('Error updating address:', error);
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_updating_address()
			});
		} finally {
			isSaving = false;
		}
	}

	async function handleDelete() {
		isDeleting = true;
		const formData = new FormData();

		try {
			const response = await fetch('?/deleteAddress', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'redirect') {
				globalToaster.success({
					title: m.title_success(),
					description: m.message_success_deleting_address()
				});
				goto(result.location);
			} else if (result.type === 'failure') {
				globalToaster.error({
					title: m.common_error(),
					description: result.data?.message || m.message_error_deleting_address()
				});
			}
		} catch (error) {
			console.error('Error deleting address:', error);
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_deleting_address()
			});
		} finally {
			isDeleting = false;
			showDeleteConfirm = false;
		}
	}

	function goBack() {
		goto(`/address/${projectId}`);
	}
</script>

<svelte:head>
	<title>{street} {housenumber}{house_number_suffix} - {m.nav_address()}</title>
</svelte:head>

<div class="h-full overflow-auto p-4">
	<div class="max-w-2xl mx-auto">
		<!-- Header -->
		<div class="flex items-center gap-4 mb-6">
			<button onclick={goBack} class="btn preset-tonal">
				<IconArrowLeft class="size-4" />
				<span>{m.common_back()}</span>
			</button>
			<h1 class="text-2xl font-bold flex-1">
				{street}
				{housenumber}{house_number_suffix}
			</h1>
		</div>

		{#if addressError}
			<div class="card preset-filled-error-500 p-4">
				<p>{addressError}</p>
			</div>
		{:else if address}
			<div class="card p-6 space-y-4">
				<!-- Street -->
				<label class="label">
					<span class="label-text">{m.form_street()}</span>
					<input id="street" name="street" type="text" class="input" bind:value={street} />
				</label>

				<!-- Housenumber & Suffix -->
				<div class="grid grid-cols-2 gap-4">
					<label class="label">
						<span class="label-text">{m.form_housenumber()}</span>
						<input
							id="housenumber"
							name="housenumber"
							type="number"
							class="input"
							bind:value={housenumber}
						/>
					</label>
					<label class="label">
						<span class="label-text">{m.form_house_number_suffix()}</span>
						<input
							id="house_number_suffix"
							name="house_number_suffix"
							type="text"
							class="input"
							bind:value={house_number_suffix}
						/>
					</label>
				</div>

				<!-- Zip Code & City -->
				<div class="grid grid-cols-2 gap-4">
					<label class="label">
						<span class="label-text">{m.form_zip_code()}</span>
						<input id="zip_code" name="zip_code" type="text" class="input" bind:value={zip_code} />
					</label>
					<label class="label">
						<span class="label-text">{m.form_city()}</span>
						<input id="city" name="city" type="text" class="input" bind:value={city} />
					</label>
				</div>

				<!-- District -->
				<label class="label">
					<span class="label-text">{m.form_district()}</span>
					<input id="district" name="district" type="text" class="input" bind:value={district} />
				</label>

				<!-- Status Development -->
				<label class="label">
					<span class="label-text">{m.form_status_development()}</span>
					<select
						id="status_development_id"
						name="status_development_id"
						class="select"
						bind:value={status_development_id}
					>
						<option value="">-</option>
						{#each statusDevelopments as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</label>

				<!-- Flag -->
				<label class="label">
					<span class="label-text">{m.form_flag()}</span>
					<select id="flag_id" name="flag_id" class="select" bind:value={flag_id}>
						<option value="">-</option>
						{#each flags as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</label>

				<!-- Actions -->
				<div class="flex justify-between pt-4 border-t border-surface-200-800">
					<button
						onclick={() => (showDeleteConfirm = true)}
						class="btn preset-filled-error-500"
						disabled={isDeleting}
					>
						<IconTrash class="size-4" />
						<span>{m.action_delete()}</span>
					</button>

					<button onclick={handleSave} class="btn preset-filled-primary-500" disabled={isSaving}>
						{#if isSaving}
							<span>{m.common_loading()}</span>
						{:else}
							<span>{m.common_save()}</span>
						{/if}
					</button>
				</div>
			</div>

			<!-- Delete Confirmation -->
			{#if showDeleteConfirm}
				<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
					<div class="card p-6 max-w-md w-full mx-4">
						<h2 class="text-xl font-bold mb-4">{m.common_confirm_delete()}</h2>
						<p class="mb-6">{m.message_confirm_delete_address()}</p>
						<div class="flex justify-end gap-2">
							<button onclick={() => (showDeleteConfirm = false)} class="btn preset-tonal">
								{m.common_cancel()}
							</button>
							<button
								onclick={handleDelete}
								class="btn preset-filled-error-500"
								disabled={isDeleting}
							>
								{#if isDeleting}
									<span>{m.common_loading()}</span>
								{:else}
									<span>{m.action_delete()}</span>
								{/if}
							</button>
						</div>
					</div>
				</div>
			{/if}
		{/if}
	</div>
</div>
