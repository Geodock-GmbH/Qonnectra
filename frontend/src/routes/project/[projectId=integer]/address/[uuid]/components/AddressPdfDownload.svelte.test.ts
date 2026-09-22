import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { globalToaster } from '$lib/stores/toaster';
import { generateAddressPdf } from '$lib/utils/addressPdf';

import AddressPdfDownload from './AddressPdfDownload.svelte';

const getAddress = vi.fn();
const getAddressLinks = vi.fn();
const getAddressFiberConnections = vi.fn();
const getResidentialUnits = vi.fn();

vi.mock('$lib/remote/address/addresses.remote', () => ({
	getAddress: (...args: unknown[]) => getAddress(...args),
	getAddressLinks: (...args: unknown[]) => getAddressLinks(...args),
	getAddressFiberConnections: (...args: unknown[]) => getAddressFiberConnections(...args)
}));

vi.mock('$lib/remote/address/residential-units.remote', () => ({
	getResidentialUnits: (...args: unknown[]) => getResidentialUnits(...args)
}));

vi.mock('$app/state', () => ({
	page: { data: { srid: 25832 }, params: {}, url: new URL('http://localhost/') }
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
	geom_3857: null
};

const unit = {
	uuid: 'ru-1',
	id_residential_unit: 'RU-001',
	floor: null,
	side: 'left',
	residential_unit_type: { id: 1, residential_unit_type: 'Apartment' },
	status: { id: 1, status: 'Active' }
};

function renderDownload() {
	return render(AddressPdfDownload, {
		props: {
			uuid: 'addr-1',
			projectId: 'proj-1',
			mapContainer: document.createElement('div'),
			coordsDefault: '400000, 5800000',
			coords4326: '52.5, 13.4'
		}
	});
}

beforeEach(() => {
	vi.spyOn(console, 'error').mockImplementation(() => {});
	getAddress.mockResolvedValue(address);
	getAddressLinks.mockResolvedValue({ nodes: [], microducts: [{ uuid: 'md-1', number: 1 }] });
	getResidentialUnits.mockResolvedValue([unit]);
	getAddressFiberConnections.mockResolvedValue({ 'ru-1': [{ cable_name: 'K-Nord' }] });
});

afterEach(() => {
	vi.restoreAllMocks();
	getAddress.mockReset();
	getAddressLinks.mockReset();
	getResidentialUnits.mockReset();
	getAddressFiberConnections.mockReset();
	vi.mocked(generateAddressPdf).mockReset();
	vi.mocked(globalToaster.success).mockClear();
	vi.mocked(globalToaster.error).mockClear();
});

describe('AddressPdfDownload', () => {
	test('should gather the queries and generate the PDF without fiber connections by default', async () => {
		const user = userEvent.setup();
		renderDownload();

		await user.click(screen.getByRole('button', { name: /action_download_pdf/ }));

		await vi.waitFor(() => expect(generateAddressPdf).toHaveBeenCalled());
		const call = vi.mocked(generateAddressPdf).mock.calls[0][0];
		expect(call.address).toEqual(
			expect.objectContaining({
				street: 'Main St',
				housenumber: '12',
				status_development: { id: 3, status: 'Planned' },
				flag: undefined,
				project: { project: 'Demo' },
				coordsDefault: '400000, 5800000',
				coords4326: '52.5, 13.4',
				srid: 25832
			})
		);
		expect(call.residentialUnits).toEqual([
			expect.objectContaining({
				id_residential_unit: 'RU-001',
				floor: undefined,
				side: 'left',
				fiberConnections: []
			})
		]);
		expect(call.linkedMicroducts).toEqual([{ uuid: 'md-1', number: 1 }]);
		expect(call.mapImage).toBe('data:image/png;base64,map');
		expect(call.wmsAttributions).toEqual(['© WMS']);
		expect(call.includeResidentialUnits).toBe(false);
		expect(getAddressFiberConnections).not.toHaveBeenCalled();
		expect(globalToaster.success).toHaveBeenCalled();
	});

	test('should show an error toast when the PDF generation fails', async () => {
		const user = userEvent.setup();
		vi.mocked(generateAddressPdf).mockImplementation(() => {
			throw new Error('jsPDF exploded');
		});
		renderDownload();

		await user.click(screen.getByRole('button', { name: /action_download_pdf/ }));

		await vi.waitFor(() =>
			expect(globalToaster.error).toHaveBeenCalledWith(
				expect.objectContaining({ description: 'message_error_downloading_pdf' })
			)
		);
	});
});
