import { error } from '@sveltejs/kit';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { globalToaster } from '$lib/stores/toaster';
import { generateAddressPdf } from '$lib/utils/addressPdf';
import BoundaryFixture from '$lib/test-utils/Boundary.fixture.svelte';

import PostCompactionExport from './PostCompactionExport.svelte';

const getAddress = vi.fn();
const getAddressLinks = vi.fn();
const getAddressFiberConnections = vi.fn();
const updateAddress = vi.fn();
const getStatusDevelopmentOptions = vi.fn();
const getResidentialUnits = vi.fn();

vi.mock('$lib/remote/address/addresses.remote', () => ({
	getAddress: (...args: unknown[]) => getAddress(...args),
	getAddressLinks: (...args: unknown[]) => getAddressLinks(...args),
	getAddressFiberConnections: (...args: unknown[]) => getAddressFiberConnections(...args),
	updateAddress: (...args: unknown[]) => updateAddress(...args)
}));

vi.mock('$lib/remote/address/attribute-options.remote', () => ({
	getStatusDevelopmentOptions: (...args: unknown[]) => getStatusDevelopmentOptions(...args)
}));

vi.mock('$lib/remote/address/residential-units.remote', () => ({
	getResidentialUnits: (...args: unknown[]) => getResidentialUnits(...args)
}));

vi.mock('$app/state', () => ({
	page: {
		data: {
			srid: 25832,
			proj4Def: '+proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs'
		},
		params: {},
		url: new URL('http://localhost/')
	}
}));

vi.mock('$lib/utils/addressPdf', () => ({
	generateAddressPdf: vi.fn()
}));

vi.mock('$lib/utils/mapCapture', () => ({
	captureMapCanvases: vi.fn(() => 'data:image/png;base64,map'),
	getVisibleWMSAttributions: vi.fn(() => ['© WMS'])
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => () => `${prop}`
		}
	)
}));

vi.mock('$lib/stores/toaster', () => ({
	globalToaster: {
		success: vi.fn(),
		error: vi.fn()
	}
}));

vi.mock('$lib/utils/logToBackendClient', () => ({
	logToBackendClient: vi.fn().mockResolvedValue(undefined)
}));

const address = {
	uuid: 'addr-1',
	id_address: 'ABC1234',
	id_address_2: null,
	street: 'Main St',
	housenumber: 12,
	house_number_suffix: '',
	zip_code: '10115',
	city: 'Berlin',
	district: '',
	status_development: { id: 3, status: 'Planned' },
	flag: null,
	project: { id: 1, project: 'Demo' },
	geom_3857: { type: 'Point', coordinates: [1001875.417139, 6800125.454397] }
};

const unit = { uuid: 'ru-1', id_residential_unit: 'RU-001', floor: null, side: 'left' };

/**
 * Builds a Kit HttpError the way a remote function's `error()` call does.
 */
function httpError(status: number, message: string): unknown {
	try {
		error(status, message);
	} catch (e) {
		return e;
	}
	return null;
}

function renderExport() {
	return render(BoundaryFixture, {
		props: {
			component: PostCompactionExport,
			props: { uuid: 'addr-1', projectId: '7', mapContainer: document.createElement('div') }
		}
	});
}

/**
 * Picks a development status the way a user does: the combobox opens from
 * its trigger button, not from a click into the input.
 */
async function pickStatus(user: ReturnType<typeof userEvent.setup>, label: string) {
	const trigger = document.querySelector('[data-scope="combobox"][data-part="trigger"]');
	expect(trigger).toBeInstanceOf(HTMLElement);
	await user.click(trigger as HTMLElement);
	await user.click(await screen.findByRole('option', { name: label }));
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
	await user.click(await screen.findByRole('button', { name: 'pc_export' }));
	return screen.findByRole('button', { name: 'pc_export_go' });
}

beforeEach(() => {
	vi.spyOn(console, 'error').mockImplementation(() => {});
	getAddress.mockResolvedValue(address);
	getStatusDevelopmentOptions.mockResolvedValue([
		{ value: 3, label: 'Planned' },
		{ value: 5, label: 'Built' }
	]);
	getAddressLinks.mockResolvedValue({ nodes: [], microducts: [{ uuid: 'md-1', number: 1 }] });
	getResidentialUnits.mockResolvedValue([unit]);
	getAddressFiberConnections.mockResolvedValue({ 'ru-1': [{ cable_name: 'K-Nord' }] });
});

afterEach(() => {
	vi.restoreAllMocks();
	for (const mock of [
		getAddress,
		getAddressLinks,
		getAddressFiberConnections,
		updateAddress,
		getStatusDevelopmentOptions,
		getResidentialUnits
	]) {
		mock.mockReset();
	}
	vi.mocked(generateAddressPdf).mockReset();
	vi.mocked(globalToaster.success).mockClear();
	vi.mocked(globalToaster.error).mockClear();
});

describe('PostCompactionExport', () => {
	test('should export the address with units, fibers, microducts and the comment', async () => {
		const user = userEvent.setup();
		renderExport();

		const exportButton = await openDialog(user);
		await user.type(screen.getByPlaceholderText('pc_comment_placeholder'), 'Trench reopened');
		await user.click(exportButton);

		await vi.waitFor(() => expect(generateAddressPdf).toHaveBeenCalled());
		const call = vi.mocked(generateAddressPdf).mock.calls[0][0];
		expect(call.address).toEqual(
			expect.objectContaining({
				street: 'Main St',
				housenumber: '12',
				status_development: { id: 3, status: 'Planned' },
				coords4326: '52.000000, 9.000000',
				srid: 25832
			})
		);
		expect(call.address.coordsDefault).toMatch(/^500000\.0\d+, 5761038\./);
		expect(call.residentialUnits).toEqual([
			expect.objectContaining({
				id_residential_unit: 'RU-001',
				fiberConnections: [{ cable_name: 'K-Nord' }]
			})
		]);
		expect(call.includeResidentialUnits).toBe(true);
		expect(call.linkedMicroducts).toEqual([{ uuid: 'md-1', number: 1 }]);
		expect(call.mapImage).toBe('data:image/png;base64,map');
		expect(call.wmsAttributions).toEqual(['© WMS']);
		expect(call.commentText).toBe('Trench reopened');
		expect(updateAddress).not.toHaveBeenCalled();
		expect(getAddressFiberConnections).toHaveBeenCalledWith('addr-1');
	});

	test('should skip the fiber lookup for an address without residential units', async () => {
		const user = userEvent.setup();
		getResidentialUnits.mockResolvedValue([]);
		renderExport();

		await user.click(await openDialog(user));

		await vi.waitFor(() => expect(generateAddressPdf).toHaveBeenCalled());
		expect(vi.mocked(generateAddressPdf).mock.calls[0][0].includeResidentialUnits).toBe(false);
		expect(getAddressFiberConnections).not.toHaveBeenCalled();
	});

	test('should save a changed status as a number and export the updated address', async () => {
		const user = userEvent.setup();
		updateAddress.mockResolvedValue({
			...address,
			status_development: { id: 5, status: 'Built' }
		});
		renderExport();

		const exportButton = await openDialog(user);
		await pickStatus(user, 'Built');
		await user.click(exportButton);

		await vi.waitFor(() => expect(generateAddressPdf).toHaveBeenCalled());
		expect(updateAddress).toHaveBeenCalledWith({ uuid: 'addr-1', status_development_id: 5 });
		expect(vi.mocked(generateAddressPdf).mock.calls[0][0].address.status_development).toEqual({
			id: 5,
			status: 'Built'
		});
	});

	test('should not export when the status update is refused', async () => {
		const user = userEvent.setup();
		updateAddress.mockRejectedValue(httpError(400, 'Invalid status'));
		renderExport();

		const exportButton = await openDialog(user);
		await pickStatus(user, 'Built');
		await user.click(exportButton);

		await vi.waitFor(() =>
			expect(globalToaster.error).toHaveBeenCalledWith(
				expect.objectContaining({ description: 'Invalid status' })
			)
		);
		expect(generateAddressPdf).not.toHaveBeenCalled();
		expect(exportButton).toBeEnabled();
	});

	test('should show an error toast when the PDF generation fails', async () => {
		const user = userEvent.setup();
		vi.mocked(generateAddressPdf).mockImplementation(() => {
			throw new Error('jsPDF exploded');
		});
		renderExport();

		await user.click(await openDialog(user));

		await vi.waitFor(() =>
			expect(globalToaster.error).toHaveBeenCalledWith(
				expect.objectContaining({ description: 'message_error_downloading_pdf' })
			)
		);
	});
});
