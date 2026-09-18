import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { globalToaster } from '$lib/stores/toaster';
import { getConduitList, importConduits } from '$lib/remote/conduit/conduits.remote';
import { commandResult, httpError } from '$lib/test-utils/remote-stubs';

import ConduitImportControls from './ConduitImportControls.svelte';

vi.mock('$app/environment', () => ({
	browser: true
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => (params?: { count?: number }) =>
				params?.count !== undefined ? `${prop}:${params.count}` : `${prop}`
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

type EnhanceCallback = (form: {
	submit: () => Promise<boolean> & { updates: (...updates: unknown[]) => Promise<boolean> };
	result: { createdCount: number; message: string; warnings: string[] } | undefined;
	fields: { allIssues: () => { message: string }[] | undefined };
}) => Promise<void>;

/**
 * The enhance callback the component registered on the remote form.
 */
function enhanceCallback(): EnhanceCallback {
	const call = vi.mocked(importConduits.enhance).mock.calls.at(-1);
	if (!call) throw new Error('enhance was not called');
	return call[0] as unknown as EnhanceCallback;
}

const fetchMock = vi.fn();

beforeEach(() => {
	vi.stubGlobal('fetch', fetchMock);
	window.URL.createObjectURL = vi.fn(() => 'blob:template');
	window.URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
	vi.unstubAllGlobals();
	fetchMock.mockReset();
	vi.mocked(importConduits.enhance).mockClear();
	vi.mocked(globalToaster.success).mockClear();
	vi.mocked(globalToaster.error).mockClear();
	vi.mocked(globalToaster.warning).mockClear();
});

describe('ConduitImportControls', () => {
	test('should render the import and template buttons on the remote form', () => {
		render(ConduitImportControls);

		expect(screen.getByText('action_import_conduit_xlsx')).toBeInTheDocument();
		expect(screen.getByText('form_template')).toBeInTheDocument();
		const form = document.querySelector('form') as HTMLFormElement;
		expect(form.getAttribute('enctype')).toBe('multipart/form-data');
		expect(form.getAttribute('method')).toBe('POST');
		expect(importConduits.enhance).toHaveBeenCalled();
	});

	test('should refresh the conduit list and toast the summary after an accepted import', async () => {
		render(ConduitImportControls);
		const updates = vi.fn().mockResolvedValue(true);

		await enhanceCallback()({
			submit: () => Object.assign(Promise.resolve(true), { updates }),
			result: { createdCount: 5, message: 'Import successful', warnings: ['Row 2 skipped'] },
			fields: { allIssues: () => undefined }
		});

		expect(updates).toHaveBeenCalledWith(getConduitList);
		expect(globalToaster.warning).toHaveBeenCalledWith(
			expect.objectContaining({ description: 'Row 2 skipped' })
		);
		expect(globalToaster.success).toHaveBeenCalledWith(
			expect.objectContaining({ description: 'Import successful' })
		);
		expect(globalToaster.error).not.toHaveBeenCalled();
	});

	test('should toast the form issues when the file is rejected before upload', async () => {
		render(ConduitImportControls);

		await enhanceCallback()({
			submit: () => commandResult(false),
			result: undefined,
			fields: {
				allIssues: () => [{ message: 'Invalid file format. Please upload an .xlsx file.' }]
			}
		});

		expect(globalToaster.error).toHaveBeenCalledWith(
			expect.objectContaining({
				description: 'Invalid file format. Please upload an .xlsx file.'
			})
		);
		expect(globalToaster.success).not.toHaveBeenCalled();
	});

	test('should toast the backend row errors when the import is rejected', async () => {
		render(ConduitImportControls);
		const rejected = Promise.reject(httpError(400, 'Row 1: Invalid data'));
		rejected.catch(() => undefined);

		await enhanceCallback()({
			submit: () => Object.assign(rejected, { updates: () => rejected }),
			result: undefined,
			fields: { allIssues: () => undefined }
		});

		expect(globalToaster.error).toHaveBeenCalledWith(
			expect.objectContaining({ description: 'Row 1: Invalid data' })
		);
	});

	test('should download the template and toast on click', async () => {
		const user = userEvent.setup();
		fetchMock.mockResolvedValue({ blob: () => Promise.resolve(new Blob(['x'])) });
		const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
		render(ConduitImportControls);

		await user.click(screen.getByText('form_template'));

		await vi.waitFor(() => expect(globalToaster.success).toHaveBeenCalled());
		expect(fetchMock).toHaveBeenCalledWith('/conduit/download');
		expect(clickSpy).toHaveBeenCalled();
		clickSpy.mockRestore();
	});
});
