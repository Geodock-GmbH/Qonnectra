import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { globalToaster } from '$lib/stores/toaster';

import FileExplorer from './FileExplorer.svelte';

vi.mock('$env/static/public', () => ({
	PUBLIC_API_URL: 'http://mock-api.test/'
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => (params?: Record<string, unknown>) =>
				params ? `${prop}:${Object.values(params).join(',')}` : `${prop}`
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

const fetchMock = vi.fn();

const files = [
	{
		uuid: 'file-1',
		file_name: 'Lageplan',
		file_type: 'pdf',
		file_path: '/projekt/dokumente/Lageplan.pdf',
		created_at: '2026-01-02T10:00:00Z'
	},
	{
		uuid: 'file-2',
		file_name: 'Baustelle',
		file_type: 'jpg',
		file_path: '/projekt/fotos/Baustelle.jpg',
		created_at: '2026-01-03T10:00:00Z'
	}
];

function mockFilesResponse(payload: unknown = files) {
	fetchMock.mockResolvedValue({
		ok: true,
		json: () => Promise.resolve(payload)
	});
}

beforeEach(() => {
	vi.stubGlobal('fetch', fetchMock);
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	fetchMock.mockReset();
	vi.mocked(globalToaster.error).mockClear();
});

describe('FileExplorer', () => {
	test('should load files for the feature and group them by category', async () => {
		mockFilesResponse();
		render(FileExplorer, { featureType: 'cable', featureId: 'cable-1' });

		expect(await screen.findByText('dokumente (1)')).toBeInTheDocument();
		expect(screen.getByText('fotos (1)')).toBeInTheDocument();
		expect(fetchMock).toHaveBeenCalledWith(
			'http://mock-api.test/feature-files/?object_id=cable-1&page_size=100',
			expect.objectContaining({ credentials: 'include' })
		);
	});

	test('should show the empty state when no files exist', async () => {
		mockFilesResponse([]);
		render(FileExplorer, { featureType: 'cable', featureId: 'cable-1' });

		expect(await screen.findByText('form_no_files_uploaded_yet')).toBeInTheDocument();
	});

	test('should show an error with retry and toast on load failure', async () => {
		fetchMock.mockResolvedValue({ ok: false, status: 500 });
		render(FileExplorer, { featureType: 'cable', featureId: 'cable-1' });

		expect(await screen.findByText(/form_error_loading_files/)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'action_refresh' })).toBeInTheDocument();
		expect(globalToaster.error).toHaveBeenCalled();
	});

	test('should filter files by the search query', async () => {
		mockFilesResponse();
		const user = userEvent.setup();
		render(FileExplorer, { featureType: 'cable', featureId: 'cable-1' });
		await screen.findByText('dokumente (1)');

		await user.type(screen.getByPlaceholderText('form_search_files'), 'Bau');

		expect(screen.queryByText('dokumente (1)')).not.toBeInTheDocument();
		expect(screen.getByText('fotos (1)')).toBeInTheDocument();
	});

	test('should show a hint when the search matches nothing', async () => {
		mockFilesResponse();
		const user = userEvent.setup();
		render(FileExplorer, { featureType: 'cable', featureId: 'cable-1' });
		await screen.findByText('dokumente (1)');

		await user.type(screen.getByPlaceholderText('form_search_files'), 'xyz');

		expect(screen.getByText('form_no_files_match_search:xyz')).toBeInTheDocument();
	});

	test('should reload files via the exported refresh method', async () => {
		mockFilesResponse();
		const { component } = render(FileExplorer, { featureType: 'cable', featureId: 'cable-1' });
		await screen.findByText('dokumente (1)');
		const callsBefore = fetchMock.mock.calls.length;

		component.refresh();

		await vi.waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore));
	});
});
