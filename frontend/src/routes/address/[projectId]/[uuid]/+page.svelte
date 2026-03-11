<script>
	import { deserialize } from '$app/forms';
	import { goto } from '$app/navigation';
	import {
		IconArrowLeft,
		IconBuilding,
		IconDeviceFloppy,
		IconDownload,
		IconFolder,
		IconHome,
		IconLink,
		IconMapPin,
		IconRefresh,
		IconTrash
	} from '@tabler/icons-svelte';

	import 'ol/ol.css';

	import { onMount } from 'svelte';
	import proj4 from 'proj4';

	import { m } from '$lib/paraglide/messages';

	import FileExplorer from '$lib/components/FileExplorer.svelte';
	import FileUpload from '$lib/components/FileUpload.svelte';
	import Map from '$lib/components/Map.svelte';
	import MessageBox from '$lib/components/MessageBox.svelte';
	import { globalToaster } from '$lib/stores/toaster';
	import { generateAddressPdf } from '$lib/utils/addressPdf.js';
	import { tooltip } from '$lib/utils/tooltip.js';

	import ResidentialUnitsSection from './ResidentialUnitsSection.svelte';

	let { data } = $props();

	let isSaving = $state(false);
	let isDeleting = $state(false);
	let isRegenerating = $state(false);
	let isDownloading = $state(false);
	let includeResidentialUnits = $state(false);

	const address = $derived(data.address);
	const projectId = $derived(data.projectId);
	const addressError = $derived(data.addressError);
	const statusDevelopments = $derived(data.statusDevelopments);
	const flags = $derived(data.flags);
	const geom = $derived(data.address?.geom || null);
	const geom3857 = $derived(data.address?.geom_3857 || null);
	const geom4326 = $derived(data.address?.geom_3857 || null);
	const featureId = $derived(address?.uuid);
	const linkedNodes = $derived(data.linkedNodes || []);
	const linkedMicroducts = $derived(data.linkedMicroducts || []);
	const isLinkedToNode = $derived(linkedNodes.length > 0);
	const residentialUnits = $derived(data.residentialUnits || []);
	const residentialUnitTypes = $derived(data.residentialUnitTypes || []);
	const residentialUnitStatuses = $derived(data.residentialUnitStatuses || []);

	/**
	 * Get the initial address from the data
	 * @returns {Object} The initial address
	 */
	function getInitialAddress() {
		return data.address;
	}
	const initialAddress = getInitialAddress();
	let id_address = $state(initialAddress?.id_address || '');
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
	let mapContainerEl = $state(null);

	let derivedIdAddress = $derived(id_address);

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
	 * Convert the geometry from 3857 to 4326
	 * @returns {String} The converted geometry
	 */
	function convert3857To4326() {
		if (!geom3857 || !geom3857.coordinates) return null;
		const coords4326 = proj4('EPSG:3857', 'EPSG:4326', geom3857.coordinates);
		return `${coords4326[1].toFixed(6)}, ${coords4326[0].toFixed(6)}`;
	}

	function convert3857ToDefault() {
		if (!geom3857 || !geom3857.coordinates) return null;
		const coordsDefault = proj4('EPSG:3857', 'EPSG:25832', geom3857.coordinates);
		return `${coordsDefault[0].toFixed(6)}, ${coordsDefault[1].toFixed(6)}`;
	}

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
		if (derivedIdAddress) formData.append('id_address', derivedIdAddress.toString());

		try {
			const response = await fetch('?/updateAddress', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'success') {
				const updated = result.data?.address;
				if (updated?.id_address != null) {
					id_address = updated.id_address;
				}
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
	 * Handle the regenerate ID action
	 */
	async function handleRegenerateId() {
		isRegenerating = true;
		const formData = new FormData();

		try {
			const response = await fetch('?/regenerateId', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'success') {
				id_address = result.data.id_address;
				globalToaster.success({
					title: m.title_success(),
					description: m.message_success_regenerating_id()
				});
			} else {
				globalToaster.error({
					title: m.common_error(),
					description: result.data?.message || m.message_error_regenerating_id()
				});
			}
		} catch (error) {
			console.error('Error regenerating address ID:', error);
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_regenerating_id()
			});
		} finally {
			isRegenerating = false;
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
	 * Handle the PDF download action
	 */
	async function handleDownloadPdf() {
		isDownloading = true;
		try {
			let mapImage = null;
			if (mapContainerEl) {
				const canvas = mapContainerEl.querySelector('canvas');
				if (canvas) {
					mapImage = canvas.toDataURL('image/png');
				}
			}

			const addressData = {
				...address,
				coords25832: convert3857ToDefault(),
				coords4326: convert3857To4326()
			};

			generateAddressPdf({
				address: addressData,
				residentialUnits,
				mapImage,
				includeResidentialUnits,
				labels: {
					sectionAddressInformation: m.section_address_information(),
					sectionClassification: m.section_classification(),
					sectionLocation: m.section_location(),
					idAddress: m.form_id_address({ count: 1 }),
					street: m.form_street(),
					housenumber: m.form_housenumber(),
					zipCode: m.form_zip_code(),
					city: m.form_city(),
					district: m.form_district(),
					statusDevelopment: m.form_status_development(),
					flag: m.form_flag(),
					project: m.form_project({ count: 1 }),
					residentialUnit: m.section_residential_units(),
					sectionIdentification: m.form_id_residential_unit(),
					sectionUnitLocation: m.section_location(),
					sectionResident: m.from_resident(),
					unitId: m.table_residential_unit_id(),
					unitType: m.table_residential_unit_type(),
					unitStatus: m.table_residential_unit_status(),
					floor: m.table_floor(),
					side: m.table_side(),
					buildingSection: m.form_building_section(),
					externalId1: m.form_external_id_1(),
					externalId2: m.form_external_id_2(),
					residentName: m.form_resident_name(),
					residentRecordedDate: m.form_resident_recorded_date(),
					readyForService: m.form_ready_for_service()
				}
			});

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_downloading_pdf()
			});
		} catch (error) {
			console.error('Error generating PDF:', error);
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_downloading_pdf()
			});
		} finally {
			isDownloading = false;
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

<div class="max-w-6xl mx-auto space-y-6">
	<!-- Header -->
	<div class="card p-4 flex items-center justify-between gap-4">
		<div class="flex items-center gap-4 min-w-0">
			<button
				onclick={goBack}
				class="btn preset-tonal-primary inline-flex items-center gap-2 shrink-0"
			>
				<IconArrowLeft class="size-4 shrink-0" />
				<span>{m.common_back()}</span>
			</button>
			<div class="flex items-center gap-3 min-w-0">
				<div class="size-10 rounded-lg bg-primary-500/15 flex items-center justify-center shrink-0">
					<IconHome class="size-5 text-primary-500" />
				</div>
				<div class="min-w-0">
					<h1 class="text-2xl font-bold truncate">
						{street}
						{housenumber}{house_number_suffix}
					</h1>
					<p class="text-sm text-surface-900-100">
						{zip_code}
						{city}{district ? ` · ${district}` : ''}
					</p>
				</div>
			</div>
		</div>
		<div class="flex items-center gap-2 shrink-0">
			<button
				onclick={openDeleteConfirm}
				class="btn preset-filled-error-500 inline-flex items-center gap-2"
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
			<div class="lg:col-span-3 card p-6 space-y-6">
				<!-- Section: Address Information -->
				<div class="flex items-center gap-3">
					<div class="w-1 h-6 rounded-full bg-primary-500"></div>
					<IconHome class="size-5 text-primary-500" />
					<h2 class="text-lg font-semibold">{m.section_address_information()}</h2>
				</div>

				<div class="space-y-4">
					<!-- ID Row -->
					<div class="flex items-end gap-3">
						<label class="label flex-1">
							<span class="label-text text-sm text-surface-900-100"
								>{m.form_id_address({ count: 1 })}</span
							>
							<input
								type="text"
								class="input"
								maxlength="7"
								name="id_address"
								bind:value={derivedIdAddress}
							/>
						</label>
						<button
							onclick={handleRegenerateId}
							class="btn preset-tonal-primary inline-flex items-center gap-2"
							disabled={isRegenerating}
						>
							{#if isRegenerating}
								<span>{m.common_loading()}</span>
							{:else}
								<IconRefresh class="size-4 shrink-0" />
								<span class="hidden sm:inline">{m.action_regenerate_id()}</span>
							{/if}
						</button>
					</div>

					<label class="label">
						<span class="label-text text-sm text-surface-900-100"
							>{m.form_street()} <span class="text-error-400">*</span></span
						>
						<input type="text" class="input" name="street" bind:value={street} />
					</label>

					<div class="grid grid-cols-2 gap-4">
						<label class="label">
							<span class="label-text text-sm text-surface-900-100"
								>{m.form_housenumber()} <span class="text-error-400">*</span></span
							>
							<input type="number" class="input" name="housenumber" bind:value={housenumber} />
						</label>
						<label class="label">
							<span class="label-text text-sm text-surface-900-100"
								>{m.form_house_number_suffix()}</span
							>
							<input
								type="text"
								class="input"
								name="house_number_suffix"
								bind:value={house_number_suffix}
							/>
						</label>
					</div>

					<div class="grid grid-cols-2 gap-4">
						<label class="label">
							<span class="label-text text-sm text-surface-900-100"
								>{m.form_zip_code()} <span class="text-error-400">*</span></span
							>
							<input type="text" class="input" name="zip_code" bind:value={zip_code} />
						</label>
						<label class="label">
							<span class="label-text text-sm text-surface-900-100"
								>{m.form_city()} <span class="text-error-400">*</span></span
							>
							<input type="text" class="input" name="city" bind:value={city} />
						</label>
					</div>

					<label class="label">
						<span class="label-text text-sm text-surface-900-100">{m.form_district()}</span>
						<input type="text" class="input" name="district" bind:value={district} />
					</label>

					<!-- Divider -->
					<div class="border-t border-surface-200-800"></div>

					<!-- Classification Fields -->
					<div class="flex items-center gap-3 pt-1">
						<div class="w-1 h-6 rounded-full bg-tertiary-500"></div>
						<IconBuilding class="size-5 text-tertiary-500" />
						<h2 class="text-lg font-semibold">{m.section_classification()}</h2>
					</div>

					<label class="label">
						<span class="label-text text-sm text-surface-900-100"
							>{m.form_status_development()}</span
						>
						<select class="select" name="status_development_id" bind:value={status_development_id}>
							<option value="">-</option>
							{#each statusDevelopments as option (option.value)}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select>
					</label>

					<label class="label">
						<span class="label-text text-sm text-surface-900-100"
							>{m.form_flag()} <span class="text-error-400">*</span></span
						>
						<select class="select" name="flag_id" bind:value={flag_id}>
							<option value="">-</option>
							{#each flags as option (option.value)}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select>
					</label>

					<label class="label">
						<span class="label-text text-sm text-surface-900-100"
							>{m.form_project({ count: 1 })} <span class="text-error-400">*</span></span
						>
						<input
							type="text"
							class="input bg-surface-50-950 cursor-default opacity-60"
							name="project"
							bind:value={project}
							readonly
						/>
					</label>
				</div>
			</div>

			<!-- Right: Mini Map -->
			<div class="lg:col-span-2 card p-6 space-y-4">
				<div class="flex items-center gap-3">
					<div class="w-1 h-6 rounded-full bg-info-500"></div>
					<IconMapPin class="size-5 text-info-500" />
					<h2 class="text-lg font-semibold">{m.section_location()}</h2>
				</div>

				{#if geom3857?.coordinates && mapReady && addressMarkerLayer}
					<div
						bind:this={mapContainerEl}
						class="h-64 md:h-80 rounded-lg overflow-hidden border border-surface-200-800"
					>
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
							<IconMapPin class="size-12 mx-auto mb-2 opacity-30" />
							<p class="text-sm font-medium text-surface-900-100">
								{m.message_no_location_data()}
							</p>
						</div>
					</div>
				{/if}

				<!-- Coordinates display -->
				{#if geom3857?.coordinates}
					<div
						class="flex items-start gap-2 text-xs text-surface-900-100 bg-surface-50-950 rounded px-3 py-2 flex-col"
					>
						<div class="flex items-center gap-2">
							<IconMapPin class="size-3.5 shrink-0" />
							<span class="font-mono">
								{convert3857ToDefault()}
							</span>
						</div>
						<div class="flex items-center gap-2">
							<IconMapPin class="size-3.5 shrink-0" />
							<span
								class="font-mono"
								{@attach tooltip(m.tooltip_coords_4326(), { position: 'bottom' })}
							>
								{convert3857To4326()}
							</span>
						</div>
					</div>
				{/if}

				<!-- PDF Download -->
				<div class="border-t border-surface-200-800 pt-4 flex items-center gap-4">
					<button
						onclick={handleDownloadPdf}
						class="btn preset-tonal-primary inline-flex items-center gap-2"
						disabled={isDownloading}
					>
						{#if isDownloading}
							<span>{m.common_loading()}</span>
						{:else}
							<IconDownload class="size-4 shrink-0" />
							<span>{m.action_download_pdf()}</span>
						{/if}
					</button>
					<label class="flex items-center gap-2 text-sm cursor-pointer select-none">
						<input type="checkbox" class="checkbox" bind:checked={includeResidentialUnits} />
						<span class="text-surface-900-100">{m.pdf_include_residential_units()}</span>
					</label>
				</div>
			</div>
		</div>

		<!-- Microduct Connections -->
		<div class="card p-6 space-y-4">
			<div class="flex items-center gap-3">
				<div class="w-1 h-6 rounded-full bg-warning-500"></div>
				<IconLink class="size-5 text-warning-500" />
				<h2 class="text-lg font-semibold">{m.section_microduct_connections()}</h2>
				{#if linkedMicroducts.length > 0}
					<span class="badge preset-tonal-primary text-xs ml-auto">{linkedMicroducts.length}</span>
				{/if}
			</div>

			{#if linkedMicroducts.length > 0}
				<div class="overflow-x-auto">
					<table class="table">
						<thead>
							<tr>
								<th class="text-xs font-medium text-surface-900-100 uppercase tracking-wider"
									>{m.table_node()}</th
								>
								<th class="text-xs font-medium text-surface-900-100 uppercase tracking-wider"
									>{m.table_conduit_name()}</th
								>
								<th class="text-xs font-medium text-surface-900-100 uppercase tracking-wider"
									>{m.table_conduit_type()}</th
								>
								<th class="text-xs font-medium text-surface-900-100 uppercase tracking-wider"
									>{m.table_microduct_number()}</th
								>
								<th class="text-xs font-medium text-surface-900-100 uppercase tracking-wider"
									>{m.table_color()}</th
								>
							</tr>
						</thead>
						<tbody>
							{#each linkedMicroducts as md (md.uuid)}
								<tr class="hover:preset-tonal-primary transition-colors">
									<td class="font-medium">{md.nodeName}</td>
									<td>{md.conduitName}</td>
									<td>{md.conduitType}</td>
									<td>
										<span
											class="inline-flex items-center justify-center size-7 rounded-md bg-surface-200-800 text-xs font-mono font-medium"
										>
											{md.number}
										</span>
									</td>
									<td>
										<span class="inline-flex items-center gap-2">
											<span
												class="size-3 rounded-full border border-surface-300-700"
												style="background-color: {md.colorHex || '#64748b'}"
											></span>
											{md.color}
										</span>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<div class="rounded-lg border border-dashed border-surface-300-700 p-8 text-center">
					<IconLink class="size-10 mx-auto mb-3 text-warning-500 opacity-40" />
					<p class="text-sm font-medium text-surface-900-100">
						{m.message_no_microducts_linked()}
					</p>
				</div>
			{/if}
		</div>

		<!-- Bottom Row: Files + Residential Units -->
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<!-- Files -->
			<div class="card p-6 space-y-4">
				<div class="flex items-center gap-3">
					<div class="w-1 h-6 rounded-full bg-success-500"></div>
					<IconFolder class="size-5 text-success-500" />
					<h2 class="text-lg font-semibold">{m.form_attachments()}</h2>
				</div>

				{#if featureId}
					<FileUpload featureType="address" {featureId} onUploadComplete={handleUploadComplete} />
					<FileExplorer bind:this={fileExplorer} featureType="address" {featureId} />
				{/if}
			</div>

			<!-- Residential Units -->
			<ResidentialUnitsSection
				{residentialUnits}
				{residentialUnitTypes}
				{residentialUnitStatuses}
				{projectId}
				addressUuid={address.uuid}
			/>
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
