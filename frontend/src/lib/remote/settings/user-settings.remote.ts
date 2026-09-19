import type { SettingsSnapshot } from '$lib/utils/userSettingsSync';
import { command, query } from '$app/server';
import { API_URL } from '$env/static/private';
import * as v from 'valibot';

import { failFromResponse } from '$lib/remote/shared/backend-error';
import { property } from '$lib/remote/shared/json';
import { djangoHeaders } from '$lib/remote/shared/remote-auth';

const SnapshotSchema = v.record(v.string(), v.unknown());

/**
 * Fetch the settings snapshot the user saved on the server.
 * @returns The saved snapshot; empty when nothing was saved yet.
 * @throws When the backend request fails.
 */
export const getSavedSettings = query(async (): Promise<SettingsSnapshot> => {
	const response = await fetch(`${API_URL}user-settings/`, { headers: djangoHeaders() });
	if (!response.ok) await failFromResponse(response, 'Failed to load settings');

	const settings = property(await response.json(), 'settings');
	return settings && typeof settings === 'object' ? (settings as SettingsSnapshot) : {};
});

/**
 * Save a settings snapshot for the user, overwriting the previous one.
 * @param snapshot - Settings keyed by their localStorage key.
 * @throws When the backend rejects the snapshot or the request fails.
 */
export const saveSettings = command(SnapshotSchema, async (snapshot): Promise<void> => {
	const response = await fetch(`${API_URL}user-settings/`, {
		method: 'PUT',
		headers: djangoHeaders(true),
		body: JSON.stringify({ settings: snapshot })
	});
	if (!response.ok) await failFromResponse(response, 'Failed to save settings');
});
