import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { globalToaster } from '$lib/stores/toaster';
import { getRememberedProject } from '$lib/context/rememberedProject.svelte';
import { httpError } from '$lib/test-utils/remote-stubs';

import Page from './+page.svelte';

const gotoMock = vi.fn();

vi.mock('$app/navigation', () => ({
	goto: (...args: unknown[]) => gotoMock(...args)
}));

vi.mock('$app/state', () => ({
	page: {
		data: {
			projects: [
				{ label: 'Fiber North', value: '1' },
				{ label: 'Fiber South', value: '2' }
			]
		}
	}
}));

// The remembered project is the form's default on this global page.
vi.mock('$lib/context/rememberedProject.svelte', async (importOriginal) => {
	const original = await importOriginal<typeof import('$lib/context/rememberedProject.svelte')>();
	const remembered = new original.RememberedProject('2');
	return { ...original, getRememberedProject: () => remembered };
});

const createPipelineRecord = vi.fn();

vi.mock('$lib/remote/pipeline-records/records.remote', () => ({
	createPipelineRecord: (...args: unknown[]) => createPipelineRecord(...args)
}));

vi.mock('$lib/components/GenericCombobox.svelte', async () => {
	const { default: MockGenericCombobox } =
		await import('$lib/test-utils/mocks/MockGenericCombobox.svelte');
	return { default: MockGenericCombobox };
});

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
	globalToaster: { success: vi.fn(), error: vi.fn() }
}));

const user = userEvent.setup();

beforeEach(() => {
	getRememberedProject().set('2');
	createPipelineRecord.mockResolvedValue({ uuid: 'rec-new' });
});

afterEach(() => {
	gotoMock.mockReset();
	createPipelineRecord.mockReset();
	vi.mocked(globalToaster.success).mockClear();
	vi.mocked(globalToaster.error).mockClear();
});

describe('new pipeline record page', () => {
	test('should show the active project as a read-only field', async () => {
		render(Page);

		const project = await screen.findByTestId('active-project');
		expect(project).toHaveValue('Fiber South');
		expect(project).toHaveAttribute('readonly');
	});

	test('should fall back to the first project when the remembered one is not active', async () => {
		getRememberedProject().set('99');
		render(Page);

		expect(await screen.findByTestId('active-project')).toHaveValue('Fiber North');
	});

	test('should follow the remembered project live, without a navigation', async () => {
		render(Page);
		expect(await screen.findByTestId('active-project')).toHaveValue('Fiber South');

		getRememberedProject().set('1');

		await vi.waitFor(() => expect(screen.getByTestId('active-project')).toHaveValue('Fiber North'));
		expect(gotoMock).not.toHaveBeenCalled();
	});

	test('should create the record in the active project and open its detail page', async () => {
		render(Page);
		await screen.findByTestId('active-project');

		await user.type(
			document.querySelector('input[name="organisation"]') as HTMLInputElement,
			'Acme'
		);
		await user.click(screen.getByRole('button', { name: /common_create/ }));

		expect(createPipelineRecord).toHaveBeenCalledWith({
			projectId: 2,
			typeOfWorkId: null,
			requestReasonId: null,
			organisation: 'Acme',
			name: '',
			tel: '',
			mobile: ''
		});
		await vi.waitFor(() => expect(gotoMock).toHaveBeenCalledWith('/pipeline-records/rec-new'));
		expect(globalToaster.success).toHaveBeenCalled();
	});

	test('should stay on the page and show the backend message when the create is rejected', async () => {
		createPipelineRecord.mockRejectedValue(httpError(400, 'project: Invalid pk.'));
		render(Page);
		await screen.findByTestId('active-project');

		await user.click(screen.getByRole('button', { name: /common_create/ }));

		await vi.waitFor(() =>
			expect(globalToaster.error).toHaveBeenCalledWith(
				expect.objectContaining({ description: 'project: Invalid pk.' })
			)
		);
		expect(gotoMock).not.toHaveBeenCalled();
	});
});
