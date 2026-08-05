import { get } from 'svelte/store';
import { render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { updateUserStore } from '$lib/stores/auth';
import {
	areaTypeStyles,
	nodeTypeStyles,
	trenchConstructionTypeStyles,
	trenchSurfaceStyles
} from '$lib/stores/store';

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

const data = {
	nodeTypes: [{ node_type: 'POP' }, { node_type: 'Unbekannt' }],
	surfaces: [{ surface: 'Asphalt' }],
	constructionTypes: [{ construction_type: 'offen' }],
	areaTypes: [{ area_type: 'Ausbau' }]
};

beforeEach(() => {
	localStorage.clear();
	updateUserStore({ isAuthenticated: true, username: 'malte' });
	nodeTypeStyles.set({});
	trenchSurfaceStyles.set({});
	trenchConstructionTypeStyles.set({});
	areaTypeStyles.set({});
});

describe('settings page', () => {
	test('should render the settings sections', () => {
		render(SettingsPage, { data });

		expect(screen.getByText('User Settings')).toBeInTheDocument();
		expect(screen.getByText('POP')).toBeInTheDocument();
	});

	test('should seed node type styles with per-type defaults', () => {
		render(SettingsPage, { data });

		const styles = get(nodeTypeStyles);
		expect(styles.POP).toMatchObject({ color: '#ff0000', size: 22, visible: true });
		expect(styles.Unbekannt).toMatchObject({ size: 6, visible: true });
	});

	test('should seed surface and construction type styles with the trench default', () => {
		render(SettingsPage, { data });

		expect(get(trenchSurfaceStyles).Asphalt).toMatchObject({
			color: '#0033ff',
			visible: true
		});
		expect(get(trenchConstructionTypeStyles).offen).toMatchObject({
			color: '#0033ff',
			visible: true
		});
	});

	test('should seed area type styles with the area default', () => {
		render(SettingsPage, { data });

		expect(get(areaTypeStyles).Ausbau).toMatchObject({ color: '#22c55e', visible: true });
	});

	test('should keep existing custom styles untouched', () => {
		nodeTypeStyles.set({
			POP: { color: '#123456', size: 10, visible: false, shape: 'circle' }
		} as never);

		render(SettingsPage, { data });

		expect(get(nodeTypeStyles).POP).toEqual({
			color: '#123456',
			size: 10,
			visible: false,
			shape: 'circle'
		});
	});
});
