<script lang="ts">
	import type { ResidentialUnit } from '$lib/types';
	import type { ResidentialUnit as PdfResidentialUnit } from '$lib/utils/addressPdf';
	import { page } from '$app/state';
	import { Menu, Portal } from '@skeletonlabs/skeleton-svelte';
	import { IconChevronDown, IconDownload } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { globalToaster } from '$lib/stores/toaster';
	import { generateAddressPdf } from '$lib/utils/addressPdf';
	import { logToBackendClient } from '$lib/utils/logToBackendClient';
	import { captureMapCanvases, getVisibleWMSAttributions } from '$lib/utils/mapCapture';
	import { tooltip } from '$lib/utils/tooltip';
	import {
		getAddress,
		getAddressFiberConnections,
		getAddressLinks
	} from '$lib/remote/address/addresses.remote';
	import { getResidentialUnits } from '$lib/remote/address/residential-units.remote';

	let {
		uuid,
		projectId,
		mapContainer,
		coordsDefault,
		coords4326
	}: {
		uuid: string;
		projectId: string;
		mapContainer: HTMLElement | null;
		coordsDefault: string | null;
		coords4326: string | null;
	} = $props();

	let isDownloading = $state(false);
	let includeResidentialUnits = $state(false);

	/**
	 * Adapts an API residential unit to the PDF generator's shape, attaching
	 * its fiber connections and dropping nulls the generator does not expect.
	 * @param unit - The unit as returned by the backend.
	 * @param fiberConnections - Connections keyed by unit uuid.
	 */
	function toPdfUnit(
		unit: ResidentialUnit,
		fiberConnections: Awaited<ReturnType<typeof getAddressFiberConnections>>
	): PdfResidentialUnit {
		return {
			id_residential_unit: unit.id_residential_unit ?? undefined,
			external_id_1: unit.external_id_1 ?? undefined,
			external_id_2: unit.external_id_2 ?? undefined,
			residential_unit_type: unit.residential_unit_type ?? undefined,
			status: unit.status ?? undefined,
			floor: unit.floor ?? undefined,
			side: unit.side ?? undefined,
			building_section: unit.building_section ?? undefined,
			resident_name: unit.resident_name ?? undefined,
			resident_recorded_date: unit.resident_recorded_date ?? undefined,
			ready_for_service: unit.ready_for_service ?? undefined,
			fiberConnections: fiberConnections[unit.uuid] ?? []
		};
	}

	/**
	 * Generates and downloads the address PDF, optionally with residential
	 * units and their fiber connections.
	 */
	async function handleDownloadPdf() {
		isDownloading = true;
		try {
			const [address, residentialUnits, links] = await Promise.all([
				getAddress(uuid),
				getResidentialUnits(uuid),
				getAddressLinks(uuid)
			]);
			const fiberConnections =
				includeResidentialUnits && residentialUnits.length > 0
					? await getAddressFiberConnections(uuid)
					: {};

			generateAddressPdf({
				address: {
					...address,
					housenumber: address.housenumber == null ? '' : String(address.housenumber),
					status_development: address.status_development ?? undefined,
					flag: address.flag ?? undefined,
					project: address.project?.project ? { project: address.project.project } : undefined,
					coordsDefault: coordsDefault ?? undefined,
					coords4326: coords4326 ?? undefined,
					srid: page.data.srid
				},
				residentialUnits: residentialUnits.map((unit) => toPdfUnit(unit, fiberConnections)),
				mapImage: mapContainer ? captureMapCanvases(mapContainer) : null,
				includeResidentialUnits,
				linkedMicroducts: links.microducts,
				wmsAttributions: getVisibleWMSAttributions(projectId),
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
					residentialUnit: m.section_residential_units({ count: 2 }),
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
					readyForService: m.form_ready_for_service(),
					sectionMicroductConnections: m.section_microduct_connections(),
					tableParentNode: m.table_parent_node(),
					tableNode: m.table_node(),
					tableConduitName: m.table_conduit_name(),
					tableConduitType: m.table_conduit_type(),
					tableNumber: m.table_microduct_number(),
					tableColor: m.table_color(),
					sectionFiberConnections: m.section_fiber_connections(),
					tableCableName: m.table_cable_name(),
					tableFiberAbsolute: m.table_fiber_absolute(),
					tableBundle: m.table_bundle(),
					tableFiber: m.table_fiber()
				}
			});

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_downloading_pdf()
			});
		} catch (error) {
			console.error('Error generating PDF:', error);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error generating PDF',
				extraData: {
					from: 'AddressPdfDownload.handleDownloadPdf',
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined
				}
			});
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_downloading_pdf()
			});
		} finally {
			isDownloading = false;
		}
	}
</script>

<div class="inline-flex rounded-lg overflow-hidden">
	<button
		onclick={handleDownloadPdf}
		class="btn preset-tonal-primary rounded-none inline-flex items-center gap-2"
		disabled={isDownloading}
		{@attach tooltip(m.tooltip_download_address_pdf(), { delay: 1000 })}
	>
		{#if isDownloading}
			<span>{m.common_loading()}</span>
		{:else}
			<IconDownload class="size-4 shrink-0" />
			<span>{m.action_download_pdf()}</span>
		{/if}
	</button>
	<Menu>
		<Menu.Trigger
			class="btn preset-tonal-primary rounded-none border-l border-primary-500/30 px-2"
			disabled={isDownloading}
		>
			<IconChevronDown class="size-4" />
		</Menu.Trigger>
		<Portal>
			<Menu.Positioner>
				<Menu.Content class="card p-2 shadow-xl space-y-1 min-w-48">
					<label
						class="flex items-center gap-3 px-3 py-2 rounded-md hover:preset-tonal-primary cursor-pointer select-none transition-colors"
					>
						<input
							id="include-residential-units"
							name="include_residential_units"
							type="checkbox"
							class="checkbox"
							bind:checked={includeResidentialUnits}
						/>
						<span class="text-sm">{m.pdf_include_residential_units()}</span>
					</label>
				</Menu.Content>
			</Menu.Positioner>
		</Portal>
	</Menu>
</div>
