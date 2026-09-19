// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';

import { getSavedSettings, saveSettings } from '$lib/remote/settings/user-settings.remote';

import {
	applySettingsSnapshot,
	loadUserSettings,
	saveUserSettings,
	snapshotLocalSettings,
	SYNCED_SETTINGS_KEYS
} from './userSettingsSync';

vi.mock('$app/environment', () => ({ browser: true }));

vi.mock('$lib/remote/settings/user-settings.remote', () => ({
	getSavedSettings: vi.fn().mockResolvedValue({}),
	saveSettings: vi.fn().mockResolvedValue(undefined)
}));

afterEach(() => {
	localStorage.clear();
});

describe('snapshotLocalSettings', () => {
	test('returns only the synced keys that are present in storage', () => {
		localStorage.setItem('theme', JSON.stringify(['dark']));
		localStorage.setItem('layerOpacity', JSON.stringify(0.5));
		// Not a synced key -> must be excluded.
		localStorage.setItem('mapZoom', JSON.stringify(15));

		const snapshot = snapshotLocalSettings(localStorage);

		expect(snapshot).toEqual({ theme: ['dark'], layerOpacity: 0.5 });
		expect(snapshot).not.toHaveProperty('mapZoom');
	});

	test('skips malformed JSON entries instead of throwing', () => {
		localStorage.setItem('theme', '{not valid json');
		localStorage.setItem('layerOpacity', JSON.stringify(1));

		const snapshot = snapshotLocalSettings(localStorage);

		expect(snapshot).toEqual({ layerOpacity: 1 });
	});

	test('returns an empty object when no synced keys are stored', () => {
		expect(snapshotLocalSettings(localStorage)).toEqual({});
	});
});

describe('applySettingsSnapshot', () => {
	test('writes recognised synced keys to storage and reports the count', () => {
		const applied = applySettingsSnapshot(localStorage, {
			theme: ['dark'],
			sidebarPreferences: { hiddenRoutes: ['map'], collapsedGroups: [] }
		});

		expect(applied).toBe(2);
		expect(localStorage.getItem('theme')).toBe(JSON.stringify(['dark']));
		expect(localStorage.getItem('sidebarPreferences')).toBe(
			JSON.stringify({ hiddenRoutes: ['map'], collapsedGroups: [] })
		);
	});

	test('ignores keys that are not part of the synced allowlist', () => {
		const applied = applySettingsSnapshot(localStorage, {
			mapZoom: 15,
			evilKey: 'nope'
		});

		expect(applied).toBe(0);
		expect(localStorage.getItem('mapZoom')).toBeNull();
		expect(localStorage.getItem('evilKey')).toBeNull();
	});

	test('round-trips a snapshot through save and load', () => {
		localStorage.setItem('theme', JSON.stringify(['legacy']));
		localStorage.setItem('drawerWidth', JSON.stringify(320));

		const snapshot = snapshotLocalSettings(localStorage);
		localStorage.clear();
		const applied = applySettingsSnapshot(localStorage, snapshot);

		expect(applied).toBe(2);
		expect(snapshotLocalSettings(localStorage)).toEqual(snapshot);
	});

	test('every synced key is unique', () => {
		expect(new Set(SYNCED_SETTINGS_KEYS).size).toBe(SYNCED_SETTINGS_KEYS.length);
	});
});

describe('saveUserSettings', () => {
	test('sends the synced local settings to the server', async () => {
		localStorage.setItem('theme', JSON.stringify(['dark']));
		localStorage.setItem('mapZoom', JSON.stringify(15));

		await saveUserSettings();

		expect(saveSettings).toHaveBeenCalledWith({ theme: ['dark'] });
	});
});

describe('loadUserSettings', () => {
	test('applies the saved snapshot to this browser', async () => {
		vi.mocked(getSavedSettings).mockResolvedValueOnce({ theme: ['dark'], evilKey: 'nope' });

		const applied = await loadUserSettings();

		expect(applied).toBe(1);
		expect(localStorage.getItem('theme')).toBe(JSON.stringify(['dark']));
		expect(localStorage.getItem('evilKey')).toBeNull();
	});

	test('rejects and leaves the browser alone when the server cannot be read', async () => {
		vi.mocked(getSavedSettings).mockRejectedValueOnce(new Error('offline'));

		await expect(loadUserSettings()).rejects.toThrow('offline');
		expect(localStorage.length).toBe(0);
	});
});
