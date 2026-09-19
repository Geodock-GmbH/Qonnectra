import { get } from 'svelte/store';
import { error } from '@sveltejs/kit';
import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { updateUserStore } from '$lib/stores/auth';
import {
	areaTypeStyles,
	nodeTypeStyles,
	trenchConstructionTypeStyles,
	trenchStyleMode,
	trenchSurfaceStyles
} from '$lib/stores/store';
import { globalToaster } from '$lib/stores/toaster';
import { getLayerStyleAttributes } from '$lib/remote/map/layers.remote';
import { getSavedSettings, saveSettings } from '$lib/remote/settings/user-settings.remote';

import SettingsPage from './+page.svelte';

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
	globalToaster: { create: vi.fn() }
}));

const attributes = {
	nodeTypes: [
		{ id: 1, node_type: 'POP' },
		{ id: 2, node_type: 'Unbekannt' }
	],
	surfaces: [{ id: 1, surface: 'Asphalt' }],
	constructionTypes: [{ id: 1, construction_type: 'offen' }],
	areaTypes: [{ id: 1, area_type: 'Ausbau' }]
};

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

/**
 * Finds the style card of an attribute by its heading.
 * @param name - Attribute name shown as the card's heading.
 */
async function findCard(name: string): Promise<HTMLElement> {
	const heading = await screen.findByRole('heading', { name });
	return heading.closest('.card') as HTMLElement;
}

beforeEach(() => {
	localStorage.clear();
	updateUserStore({ isAuthenticated: true, username: 'malte' });
	nodeTypeStyles.set({});
	trenchSurfaceStyles.set({});
	trenchConstructionTypeStyles.set({});
	areaTypeStyles.set({});
	trenchStyleMode.set('none');
	vi.mocked(getLayerStyleAttributes).mockReset().mockResolvedValue(attributes);
	vi.mocked(getSavedSettings).mockReset().mockResolvedValue({});
	vi.mocked(saveSettings).mockClear();
	vi.mocked(globalToaster.create).mockClear();
});

describe('settings page', () => {
	test('should render the account and the node and area types the backend knows', async () => {
		render(SettingsPage);

		expect(screen.getByText('User Settings')).toBeInTheDocument();
		expect(screen.getByText('malte')).toBeInTheDocument();
		expect(await screen.findByRole('heading', { name: 'POP' })).toBeInTheDocument();
		expect(await screen.findByRole('heading', { name: 'Ausbau' })).toBeInTheDocument();
	});

	test('should seed node type styles with per-type defaults', async () => {
		render(SettingsPage);
		await findCard('POP');

		const styles = get(nodeTypeStyles);
		expect(styles.POP).toMatchObject({ color: '#ff0000', size: 22, visible: true });
		expect(styles.Unbekannt).toMatchObject({ size: 6, visible: true });
	});

	test('should seed area type styles with the area default', async () => {
		render(SettingsPage);
		await findCard('Ausbau');

		expect(get(areaTypeStyles).Ausbau).toMatchObject({ color: '#22c55e', visible: true });
	});

	test('should list and seed the surfaces only while trenches are styled by surface', async () => {
		trenchStyleMode.set('surface');
		render(SettingsPage);
		await findCard('Asphalt');

		expect(get(trenchSurfaceStyles).Asphalt).toMatchObject({ color: '#0033ff', visible: true });
		expect(screen.queryByRole('heading', { name: 'offen' })).not.toBeInTheDocument();
	});

	test('should list and seed the construction types in construction type mode', async () => {
		trenchStyleMode.set('construction_type');
		render(SettingsPage);
		await findCard('offen');

		expect(get(trenchConstructionTypeStyles).offen).toMatchObject({
			color: '#0033ff',
			visible: true
		});
		expect(screen.queryByRole('heading', { name: 'Asphalt' })).not.toBeInTheDocument();
	});

	test('should keep existing custom styles untouched', async () => {
		nodeTypeStyles.set({
			POP: { color: '#123456', size: 10, visible: false, shape: 'circle' }
		});

		render(SettingsPage);
		await findCard('Unbekannt');

		expect(get(nodeTypeStyles).POP).toEqual({
			color: '#123456',
			size: 10,
			visible: false,
			shape: 'circle'
		});
	});

	test('should change a node type’s shape and reset it to its default', async () => {
		const user = userEvent.setup();
		nodeTypeStyles.set({
			POP: { color: '#123456', size: 10, visible: false, shape: 'circle' }
		});
		render(SettingsPage);
		const card = await findCard('POP');

		await user.click(within(card).getByTitle('settings_shape_square'));
		expect(get(nodeTypeStyles).POP).toMatchObject({ color: '#123456', shape: 'square' });

		await user.click(within(card).getByRole('button', { name: 'common_reset' }));
		expect(get(nodeTypeStyles).POP).toMatchObject({ color: '#ff0000', size: 22, visible: false });
	});

	test('should report a failed attribute lookup instead of an empty list', async () => {
		vi.mocked(getLayerStyleAttributes).mockRejectedValue(httpError(502, 'Attributes unavailable'));

		render(SettingsPage);

		const alerts = await screen.findAllByRole('alert');
		expect(alerts[0]).toHaveTextContent('Attributes unavailable');
	});

	test('should save the browser’s settings to the server', async () => {
		const user = userEvent.setup();
		localStorage.setItem('theme', JSON.stringify(['dark']));
		render(SettingsPage);

		await user.click(screen.getByRole('button', { name: 'settings_sync_save' }));

		expect(saveSettings).toHaveBeenCalledWith(expect.objectContaining({ theme: ['dark'] }));
		expect(globalToaster.create).toHaveBeenCalledWith({
			title: 'settings_sync_save_success',
			type: 'success'
		});
	});

	test('should say so when the saved settings cannot be loaded', async () => {
		const user = userEvent.setup();
		vi.mocked(getSavedSettings).mockRejectedValue(httpError(500, 'boom'));
		render(SettingsPage);

		await user.click(screen.getByRole('button', { name: 'settings_sync_load' }));

		expect(globalToaster.create).toHaveBeenCalledWith({
			title: 'settings_sync_load_error',
			type: 'error'
		});
		expect(screen.getByRole('button', { name: 'settings_sync_load' })).toBeEnabled();
	});
});
