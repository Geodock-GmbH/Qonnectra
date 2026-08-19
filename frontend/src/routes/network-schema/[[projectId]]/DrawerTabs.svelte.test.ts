import { render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { drawerStore } from '$lib/stores/drawer';

import DrawerTabs from './DrawerTabs.svelte';

vi.mock('$app/environment', () => ({
	browser: true
}));

vi.mock('$app/forms', () => ({
	deserialize: vi.fn((text: string) => JSON.parse(text))
}));

vi.mock('$app/navigation', () => ({
	goto: vi.fn()
}));

const pageState = vi.hoisted(() => ({
	value: {
		url: new URL('http://localhost/network-schema/7'),
		params: { projectId: '7' },
		data: {}
	}
}));

vi.mock('$app/stores', () => ({
	page: {
		subscribe(run: (value: unknown) => void) {
			run(pageState.value);
			return () => {};
		}
	}
}));

vi.mock('$env/static/public', () => ({
	PUBLIC_API_URL: 'http://mock-api.test/'
}));

vi.mock('$env/dynamic/public', () => ({
	env: { PUBLIC_API_URL: 'http://mock-api.test/' }
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
	fetchContentTypes: vi.fn(() => Promise.resolve({})),
	getContentTypeId: vi.fn(() => 1)
}));

const fetchMock = vi.fn();

beforeEach(() => {
	vi.stubGlobal('fetch', fetchMock);
	fetchMock.mockResolvedValue({
		ok: true,
		text: () => Promise.resolve(JSON.stringify({ type: 'success', data: {} })),
		json: () => Promise.resolve([])
	});
	vi.spyOn(console, 'error').mockImplementation(() => {});
	drawerStore.open({ props: {} });
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	fetchMock.mockReset();
	drawerStore.close();
});

describe('DrawerTabs', () => {
	test('should show edge tabs for cables', () => {
		render(DrawerTabs, {
			type: 'edge',
			uuid: 'cable-1',
			name: 'K-Nord'
		});

		expect(screen.getByRole('tab', { name: 'common_attributes' })).toBeInTheDocument();
		expect(screen.getByRole('tab', { name: 'form_status' })).toBeInTheDocument();
		expect(screen.getByRole('tab', { name: 'form_handles' })).toBeInTheDocument();
		expect(screen.getByRole('tab', { name: 'form_actions' })).toBeInTheDocument();
		expect(screen.getByRole('tab', { name: 'form_attachments' })).toBeInTheDocument();
	});

	test('should show node tabs without cable-specific entries', () => {
		render(DrawerTabs, {
			type: 'node',
			uuid: 'node-1',
			name: 'PoP-1'
		});

		expect(screen.getByRole('tab', { name: 'common_attributes' })).toBeInTheDocument();
		expect(screen.getByRole('tab', { name: 'form_actions' })).toBeInTheDocument();
		expect(screen.queryByRole('tab', { name: 'form_status' })).not.toBeInTheDocument();
		expect(screen.queryByRole('tab', { name: 'form_handles' })).not.toBeInTheDocument();
	});

	test('should select the attributes tab by default', () => {
		render(DrawerTabs, { type: 'node', uuid: 'node-1' });

		expect(screen.getByRole('tab', { name: 'common_attributes' })).toHaveAttribute(
			'aria-selected',
			'true'
		);
	});
});
