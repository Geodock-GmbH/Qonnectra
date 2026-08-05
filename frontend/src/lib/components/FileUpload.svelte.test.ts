import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { globalToaster } from '$lib/stores/toaster';
import { fetchContentTypes } from '$lib/utils/contentTypes';

import FileUpload from './FileUpload.svelte';

vi.mock('$env/static/public', () => ({
	PUBLIC_API_URL: 'http://mock-api.test/'
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
		error: vi.fn(),
		warning: vi.fn()
	}
}));

vi.mock('$lib/utils/contentTypes', () => ({
	fetchContentTypes: vi.fn(() => Promise.resolve({ cable: 12 })),
	getContentTypeId: vi.fn((type: string) => (type === 'cable' ? 12 : null))
}));

const fetchMock = vi.fn();

beforeEach(() => {
	vi.stubGlobal('fetch', fetchMock);
	fetchMock.mockResolvedValue({
		ok: true,
		json: () => Promise.resolve([])
	});
	vi.spyOn(console, 'error').mockImplementation(() => {});
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	fetchMock.mockReset();
	vi.mocked(fetchContentTypes).mockResolvedValue({ cable: 12 } as never);
	vi.mocked(globalToaster.error).mockClear();
});

describe('FileUpload', () => {
	test('should show the dropzone after content types load', async () => {
		render(FileUpload, { featureType: 'cable', featureId: 'cable-1' });

		expect(await screen.findByText('form_upload_files')).toBeInTheDocument();
		expect(screen.getByText('form_select_files_or_drag')).toBeInTheDocument();
		expect(screen.getByText(/form_max_file_size/)).toBeInTheDocument();
		expect(screen.getByText(/50 MB/)).toBeInTheDocument();
	});

	test('should load existing files for the feature', async () => {
		render(FileUpload, { featureType: 'cable', featureId: 'cable-1' });
		await screen.findByText('form_upload_files');

		expect(fetchMock).toHaveBeenCalledWith(
			'http://mock-api.test/feature-files/?object_id=cable-1',
			expect.objectContaining({ credentials: 'include' })
		);
	});

	test('should show an error with retry for unsupported feature types', async () => {
		render(FileUpload, { featureType: 'spaceship', featureId: 'x-1' });

		expect(await screen.findByText(/Invalid feature type: spaceship/)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
	});

	test('should retry loading content types on click', async () => {
		const user = userEvent.setup();
		render(FileUpload, { featureType: 'spaceship', featureId: 'x-1' });
		await screen.findByRole('button', { name: 'Retry' });
		const callsBefore = vi.mocked(fetchContentTypes).mock.calls.length;

		await user.click(screen.getByRole('button', { name: 'Retry' }));

		expect(vi.mocked(fetchContentTypes).mock.calls.length).toBeGreaterThan(callsBefore);
	});

	test('should toast an error when loading files fails', async () => {
		fetchMock.mockResolvedValue({ ok: false, status: 500 });

		render(FileUpload, { featureType: 'cable', featureId: 'cable-1' });
		await screen.findByText('form_upload_files');

		await vi.waitFor(() => expect(globalToaster.error).toHaveBeenCalled());
	});
});
