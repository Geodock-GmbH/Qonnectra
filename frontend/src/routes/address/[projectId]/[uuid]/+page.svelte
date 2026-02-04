<script>
	import { deserialize } from '$app/forms';
	import { goto } from '$app/navigation';
	import {
		IconArrowLeft,
		IconDeviceFloppy,
		IconFolder,
		IconHome,
		IconLink,
		IconLock,
		IconMapPin,
		IconTrash,
		IconUsers
	} from '@tabler/icons-svelte';

	import 'ol/ol.css';

	import { onMount } from 'svelte';

	import { m } from '$lib/paraglide/messages';

	import FileExplorer from '$lib/components/FileExplorer.svelte';
	import FileUpload from '$lib/components/FileUpload.svelte';
	import Map from '$lib/components/Map.svelte';
	import MessageBox from '$lib/components/MessageBox.svelte';
	import { globalToaster } from '$lib/stores/toaster';
	import { tooltip } from '$lib/utils/tooltip.js';

	let { data } = $props();

	let isSaving = $state(false);
	let isDeleting = $state(false);

	const address = $derived(data.address);
	const projectId = $derived(data.projectId);
	const addressError = $derived(data.addressError);
	const statusDevelopments = $derived(data.statusDevelopments);
	const flags = $derived(data.flags);
	const geom3857 = $derived(data.address?.geom_3857 || null);
	const featureId = $derived(address?.uuid);
	const linkedNodes = $derived(data.linkedNodes || []);
	const linkedMicroducts = $derived(data.linkedMicroducts || []);
	const isLinkedToNode = $derived(linkedNodes.length > 0);

	/**
	 * Get the initial address from the data
	 * @returns {Object} The initial address
	 */
	function getInitialAddress() {
		return data.address;
	}
	const initialAddress = getInitialAddress();
	let street = $state(initialAddress?.street || '');
	let housenumber = $state(initialAddress?.housenumber ?? '');
	let house_number_suffix = $state(initialAddress?.house_number_suffix || '');
	let zip_code = $state(initialAddress?.zip_code || '');
	let city = $state(initialAddress?.city || '');
	let district = $state(initialAddress?.district || '');
	let status_development_id = $state(initialAddress?.status_development?.id || '');
	let flag_id = $state(initialAddress?.flag?.id || '');
	let project = $state(initialAddress?.project?.project || '');
	let deleteMessageBox = $state(null);
	let fileExplorer = $state(null);

	let addressMarkerLayer = $state(null);
	let mapCenter = $state(null);
	let mapReady = $state(false);

	onMount(async () => {
		if (!geom3857 || !geom3857.coordinates) return;
		const [
			{ default: VectorLayer },
			{ default: VectorSource },
			{ default: Feature },
			{ default: Point },
			{ default: Style },
			{ default: CircleStyle },
			{ default: Fill },
			{ default: Stroke }
		] = await Promise.all([
			import('ol/layer/Vector'),
			import('ol/source/Vector'),
			import('ol/Feature'),
			import('ol/geom/Point'),
			import('ol/style/Style'),
			import('ol/style/Circle'),
			import('ol/style/Fill'),
			import('ol/style/Stroke')
		]);

		const coords = geom3857.coordinates;
		mapCenter = coords;

		const pointFeature = new Feature({
			geometry: new Point(coords)
		});

		const markerStyle = new Style({
			image: new CircleStyle({
				radius: 8,
				fill: new Fill({ color: 'rgba(59, 130, 246, 0.8)' }),
				stroke: new Stroke({ color: '#1d4ed8', width: 2 })
			})
		});

		addressMarkerLayer = new VectorLayer({
			source: new VectorSource({
				features: [pointFeature]
			}),
			style: markerStyle,
			zIndex: 100
		});

		mapReady = true;
	});

	/**
	 * Handle the save action
	 */
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

	/**
	 * Handle the delete action
	 */
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
		}
	}

	/**
	 * Open the delete confirmation modal
	 */
	function openDeleteConfirm() {
		deleteMessageBox.open();
	}

	/**
	 * Handle the upload complete event
	 */
	function handleUploadComplete() {
		if (fileExplorer) {
			fileExplorer.refresh();
		}
	}

	/**
	 * Go back to the address list page
	 */
	function goBack() {
		goto(`/address/${projectId}`);
	}
</script>

<svelte:head>
	<title>{street} {housenumber}{house_number_suffix} - {m.nav_address()}</title>
</svelte:head>

<div class="max-w-6xl mx-auto space-y-8">
	<!-- Header -->
	<div class="flex flex-col sm:flex-row items-start sm:items-center gap-4 px-6 sm:px-8">
		<button onclick={goBack} class="btn preset-tonal inline-flex items-center gap-2">
			<IconArrowLeft class="size-4 shrink-0" />
			<span>{m.common_back()}</span>
		</button>
		<div class="flex-1 min-w-0">
			<h1 class="text-2xl font-bold truncate">
				{street}
				{housenumber}{house_number_suffix}
			</h1>
			<p class="text-sm text-surface-500">{zip_code} {city}</p>
		</div>
		<div class="flex items-center gap-3 shrink-0">
			<button
				onclick={openDeleteConfirm}
				class="btn preset-tonal-error inline-flex items-center gap-2"
				disabled={isDeleting || isLinkedToNode}
				{@attach tooltip(m.message_address_linked_to_node(), { disabled: !isLinkedToNode })}
			>
				<IconTrash class="size-4 shrink-0" />
				<span class="hidden sm:inline">{m.action_delete()}</span>
			</button>
			<button
				onclick={handleSave}
				class="btn preset-filled-primary-500 inline-flex items-center gap-2"
				disabled={isSaving}
			>
				{#if isSaving}
					<span>{m.common_loading()}</span>
				{:else}
					<IconDeviceFloppy class="size-4 shrink-0" />
					<span>{m.common_save()}</span>
				{/if}
			</button>
		</div>
	</div>

	{#if addressError}
		<div class="card preset-filled-error-500 p-4">
			<p>{addressError}</p>
		</div>
	{:else if address}
		<!-- Top Row: Form + Map -->
		<div class="grid grid-cols-1 lg:grid-cols-5 gap-6">
			<!-- Left: Address Form -->
			<div class="lg:col-span-3 card p-6 sm:p-8 space-y-6">
				<!-- Section: Address Information -->
				<div class="flex items-center gap-2.5 pb-3 border-b border-surface-200-800">
					<IconHome class="size-5 text-primary-500" />
					<h2 class="text-xl font-semibold">{m.section_address_information()}</h2>
				</div>

				<div class="space-y-5">
					<label class="label">
						<span class="label-text text-sm text-surface-600-400"
							>{m.form_street()} <span class="text-error-400">*</span></span
						>
						<input type="text" class="input transition-colors" bind:value={street} />
					</label>

					<div class="grid grid-cols-2 gap-4">
						<label class="label">
							<span class="label-text text-sm text-surface-600-400"
								>{m.form_housenumber()} <span class="text-error-400">*</span></span
							>
							<input type="number" class="input transition-colors" bind:value={housenumber} />
						</label>
						<label class="label">
							<span class="label-text text-sm text-surface-600-400"
								>{m.form_house_number_suffix()}</span
							>
							<input type="text" class="input transition-colors" bind:value={house_number_suffix} />
						</label>
					</div>

					<div class="grid grid-cols-2 gap-4">
						<label class="label">
							<span class="label-text text-sm text-surface-600-400"
								>{m.form_zip_code()} <span class="text-error-400">*</span></span
							>
							<input type="text" class="input transition-colors" bind:value={zip_code} />
						</label>
						<label class="label">
							<span class="label-text text-sm text-surface-600-400"
								>{m.form_city()} <span class="text-error-400">*</span></span
							>
							<input type="text" class="input transition-colors" bind:value={city} />
						</label>
					</div>

					<label class="label">
						<span class="label-text text-sm text-surface-600-400">{m.form_district()}</span>
						<input type="text" class="input transition-colors" bind:value={district} />
					</label>

					<label class="label">
						<span class="label-text text-sm text-surface-600-400"
							>{m.form_status_development()}</span
						>
						<select class="select transition-colors" bind:value={status_development_id}>
							<option value="">-</option>
							{#each statusDevelopments as option (option.value)}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select>
					</label>

					<label class="label">
						<span class="label-text text-sm text-surface-600-400">{m.form_flag()}</span>
						<select class="select transition-colors" bind:value={flag_id}>
							<option value="">-</option>
							{#each flags as option (option.value)}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select>
					</label>

					<label class="label">
						<span class="label-text text-sm text-surface-600-400"
							>{m.form_project({ count: 1 })}</span
						>
						<input
							type="text"
							class="input bg-surface-50-950 cursor-default"
							bind:value={project}
							readonly
						/>
					</label>
				</div>
			</div>

			<!-- Right: Mini Map -->
			<div class="lg:col-span-2 card p-6 sm:p-8 space-y-4">
				<div class="flex items-center gap-2.5 pb-3 border-b border-surface-200-800">
					<IconMapPin class="size-5 text-primary-500" />
					<h2 class="text-xl font-semibold">{m.section_location()}</h2>
				</div>

				{#if geom3857?.coordinates && mapReady && addressMarkerLayer}
					<div class="space-y-2">
						<div class="h-64 md:h-80 rounded-lg overflow-hidden border border-surface-200-800">
							<Map
								variant="compact"
								layers={[addressMarkerLayer]}
								viewOptions={{
									center: mapCenter,
									zoom: 18
								}}
								showOpacitySlider={false}
								showLayerVisibilityTree={false}
								showSearchPanel={false}
							/>
						</div>
					</div>
				{:else if geom3857?.coordinates}
					<div
						class="h-64 md:h-80 rounded-lg border border-surface-200-800 flex items-center justify-center animate-pulse"
					>
						<p class="text-sm text-surface-400">{m.common_loading()}</p>
					</div>
				{:else}
					<div
						class="h-64 md:h-80 rounded-lg border border-dashed border-surface-300-700 flex items-center justify-center"
					>
						<div class="text-center text-surface-400">
							<IconMapPin class="size-16 mx-auto mb-3 opacity-30" />
							<p class="text-sm font-medium text-surface-500">{m.message_no_location_data()}</p>
						</div>
					</div>
				{/if}
			</div>
		</div>

		<!-- Microduct Connections -->
		<div class="card p-6 sm:p-8 space-y-6">
			<div class="flex items-center gap-2.5 pb-3 border-b border-surface-200-800">
				<IconLink class="size-5 text-primary-500" />
				<h2 class="text-xl font-semibold">{m.section_microduct_connections()}</h2>
				{#if linkedMicroducts.length > 0}
					<span class="badge preset-tonal-primary text-xs ml-auto">{linkedMicroducts.length}</span>
				{/if}
			</div>

			{#if linkedMicroducts.length > 0}
				<div class="overflow-x-auto -mx-2">
					<table class="table">
						<thead>
							<tr>
								<th class="text-xs font-medium text-surface-500 uppercase tracking-wider"
									>{m.table_node()}</th
								>
								<th class="text-xs font-medium text-surface-500 uppercase tracking-wider"
									>{m.table_conduit_name()}</th
								>
								<th class="text-xs font-medium text-surface-500 uppercase tracking-wider"
									>{m.table_conduit_type()}</th
								>
								<th class="text-xs font-medium text-surface-500 uppercase tracking-wider"
									>{m.table_microduct_number()}</th
								>
								<th class="text-xs font-medium text-surface-500 uppercase tracking-wider"
									>{m.table_color()}</th
								>
							</tr>
						</thead>
						<tbody>
							{#each linkedMicroducts as md (md.uuid)}
								<tr class="hover:preset-tonal-primary transition-colors">
									<td>{md.nodeName}</td>
									<td>{md.conduitName}</td>
									<td>{md.conduitType}</td>
									<td>{md.number}</td>
									<td>{md.color}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<div class="rounded-lg border border-dashed border-surface-300-700 p-10 text-center">
					<IconLink class="size-16 mx-auto mb-4 text-surface-300 opacity-40" />
					<p class="text-sm font-medium text-surface-500">{m.message_no_microducts_linked()}</p>
				</div>
			{/if}
		</div>

		<!-- Bottom Row: Files + Residential Units -->
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<!-- Files -->
			<div class="card p-6 sm:p-8 space-y-6">
				<div class="flex items-center gap-2.5 pb-3 border-b border-surface-200-800">
					<IconFolder class="size-5 text-primary-500" />
					<h2 class="text-xl font-semibold">{m.form_attachments()}</h2>
				</div>

				{#if featureId}
					<FileUpload featureType="address" {featureId} onUploadComplete={handleUploadComplete} />
					<FileExplorer bind:this={fileExplorer} featureType="address" {featureId} />
				{/if}
			</div>

			<!-- Residential Units -->
			<div class="card p-6 sm:p-8 space-y-6">
				<div class="flex items-center gap-2.5 pb-3 border-b border-surface-200-800">
					<IconUsers class="size-5 text-primary-500" />
					<h2 class="text-xl font-semibold">{m.section_residential_units()}</h2>
					<span class="badge preset-tonal-surface text-xs ml-auto">
						<IconLock class="size-3" />
						<span>{m.common_coming_soon()}</span>
					</span>
				</div>

				<div class="rounded-lg border border-dashed border-surface-300-700 p-10 text-center">
					<IconUsers class="size-16 mx-auto mb-4 text-surface-300 opacity-30" />
					<p class="text-sm font-medium text-surface-500">
						{m.message_residential_units_coming_soon()}
					</p>
					<p class="text-xs text-surface-400 mt-2">
						{m.message_residential_units_description()}
					</p>
				</div>
			</div>
		</div>
	{/if}
</div>

<!-- Delete Confirmation -->
<MessageBox
	bind:this={deleteMessageBox}
	heading={m.common_confirm_delete()}
	message={m.message_confirm_delete_address()}
	showAcceptButton={true}
	acceptText={m.action_delete()}
	closeText={m.common_cancel()}
	onAccept={handleDelete}
/>
