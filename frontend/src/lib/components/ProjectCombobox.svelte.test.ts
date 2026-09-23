import { goto } from '$app/navigation';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { globalToaster } from '$lib/stores/toaster';
import { pageStub } from '$lib/test-utils/pageStub';

import ProjectCombobox from './ProjectCombobox.svelte';

vi.mock('$app/environment', () => ({
	browser: true
}));

vi.mock('$app/navigation', () => ({
	goto: vi.fn()
}));

const appState = vi.hoisted(() => ({
	page: {
		route: { id: null as string | null },
		params: {} as Record<string, string>,
		url: new URL('http://localhost/trace')
	}
}));

vi.mock('$app/state', () => ({
	page: appState.page
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
		error: vi.fn()
	}
}));

const projects = [
	{ label: 'Ausbau Nord', value: '5' },
	{ label: 'Ausbau Süd', value: '9' }
];

/**
 * Puts the mocked page on a route.
 * @param routeId - The route id.
 * @param params - The route params.
 * @param url - The page URL.
 */
function setPage(routeId: string | null, params: Record<string, string>, url: string) {
	Object.assign(appState.page, pageStub({ routeId, params, url }));
}

/** Opens the picker and chooses the project with the given label. */
async function choose(label: string) {
	const user = userEvent.setup();
	await user.click(screen.getByRole('button'));
	await user.click(await screen.findByText(label));
}

beforeEach(() => {
	setPage(null, {}, 'http://localhost/trace');
	document.cookie = 'last-project=; path=/; max-age=0';
	vi.mocked(globalToaster.error).mockClear();
	vi.mocked(goto).mockClear();
});

describe('ProjectCombobox', () => {
	test('should show a pulsing placeholder while loading', () => {
		const { container } = render(ProjectCombobox, { loading: true, projects });

		expect(container.querySelector('.animate-pulse')).not.toBeNull();
	});

	test('should show the error and toast it', () => {
		render(ProjectCombobox, { projects: [], projectsError: 'Projekte nicht ladbar' });

		expect(screen.getByText('Projekte nicht ladbar')).toBeInTheDocument();
		expect(globalToaster.error).toHaveBeenCalledWith(
			expect.objectContaining({ description: 'Projekte nicht ladbar' })
		);
	});

	test('should warn when no projects exist', () => {
		render(ProjectCombobox, { projects: [] });

		expect(screen.getByText('message_error_fetching_projects_no_projects')).toBeInTheDocument();
	});

	test('should show the project named in the URL', () => {
		setPage(
			'/project/[projectId=integer]/map',
			{ projectId: '9' },
			'http://localhost/project/9/map'
		);
		render(ProjectCombobox, { projects });

		expect(screen.getByRole('combobox')).toHaveValue('Ausbau Süd');
	});

	test('should switch to the same page in the new project, dropping child identifiers', async () => {
		setPage(
			'/project/[projectId=integer]/address/[uuid]',
			{ projectId: '5', uuid: 'abc' },
			'http://localhost/project/5/address/abc?page=2'
		);
		render(ProjectCombobox, { projects });

		await choose('Ausbau Süd');

		expect(goto).toHaveBeenCalledWith('/project/9/address');
	});

	test('should keep the flag when switching project on the dashboard', async () => {
		setPage(
			'/project/[projectId=integer]/dashboard/[[flagId]]',
			{ projectId: '5', flagId: '3' },
			'http://localhost/project/5/dashboard/3'
		);
		render(ProjectCombobox, { projects });

		await choose('Ausbau Süd');

		expect(goto).toHaveBeenCalledWith('/project/9/dashboard/3');
	});

	test('should only remember the project on a global page, without navigating', async () => {
		setPage('/trace', {}, 'http://localhost/trace');
		render(ProjectCombobox, { projects });

		await choose('Ausbau Süd');

		expect(goto).not.toHaveBeenCalled();
		expect(document.cookie).toContain('last-project=9');
	});
});
