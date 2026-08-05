import { get } from 'svelte/store';
import { render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { selectedProject } from '$lib/stores/store';
import { globalToaster } from '$lib/stores/toaster';

import ProjectCombobox from './ProjectCombobox.svelte';

vi.mock('$app/environment', () => ({
	browser: true
}));

vi.mock('$app/navigation', () => ({
	goto: vi.fn()
}));

const pageStore = vi.hoisted(() => {
	type PageValue = { params: Record<string, string>; url: URL };
	let value: PageValue = { params: {}, url: new URL('http://localhost/dashboard') };
	const subscribers = new Set<(value: PageValue) => void>();
	return {
		set(next: PageValue) {
			value = next;
			subscribers.forEach((run) => run(value));
		},
		subscribe(run: (value: PageValue) => void) {
			subscribers.add(run);
			run(value);
			return () => subscribers.delete(run);
		}
	};
});

vi.mock('$app/stores', () => ({
	page: pageStore
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
	{ label: 'Ausbau Nord', value: '7' },
	{ label: 'Ausbau Süd', value: '8' }
];

beforeEach(() => {
	selectedProject.set('7');
	pageStore.set({ params: {}, url: new URL('http://localhost/dashboard') });
	vi.mocked(globalToaster.error).mockClear();
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

	test('should render the combobox with the selected project', () => {
		render(ProjectCombobox, { projects });

		expect(screen.getByRole('combobox')).toBeInTheDocument();
	});

	test('should sync the selected project from the URL parameter', async () => {
		render(ProjectCombobox, { projects });

		pageStore.set({ params: { projectId: '8' }, url: new URL('http://localhost/map/8') });
		await Promise.resolve();

		expect(get(selectedProject)).toBe('8');
	});
});
