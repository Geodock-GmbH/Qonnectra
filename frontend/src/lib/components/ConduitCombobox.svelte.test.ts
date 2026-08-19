import { get } from 'svelte/store';
import { render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { selectedConduit } from '$lib/stores/store';
import { globalToaster } from '$lib/stores/toaster';

import ConduitCombobox from './ConduitCombobox.svelte';

vi.mock('$app/environment', () => ({
	browser: true
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

beforeEach(() => {
	selectedConduit.set(undefined);
	vi.mocked(globalToaster.error).mockClear();
});

describe('ConduitCombobox', () => {
	test('should show a pulsing placeholder while loading', () => {
		const { container } = render(ConduitCombobox, { loading: true });

		expect(container.querySelector('.animate-pulse')).not.toBeNull();
	});

	test('should show the error and toast it', () => {
		render(ConduitCombobox, { conduitsError: 'Rohre konnten nicht geladen werden' });

		expect(screen.getByText('Rohre konnten nicht geladen werden')).toBeInTheDocument();
		expect(globalToaster.error).toHaveBeenCalledWith(
			expect.objectContaining({ description: 'Rohre konnten nicht geladen werden' })
		);
	});

	test('should clear a selection that no longer exists in the conduit list', async () => {
		selectedConduit.set('vanished-conduit');

		render(ConduitCombobox, {
			conduits: [{ label: 'DA 50', value: 'conduit-1' }]
		});
		await Promise.resolve();

		expect(get(selectedConduit)).toBeUndefined();
	});

	test('should keep a selection that still exists', async () => {
		selectedConduit.set('conduit-1');

		render(ConduitCombobox, {
			conduits: [{ label: 'DA 50', value: 'conduit-1' }]
		});
		await Promise.resolve();

		expect(get(selectedConduit)).toBe('conduit-1');
	});
});
