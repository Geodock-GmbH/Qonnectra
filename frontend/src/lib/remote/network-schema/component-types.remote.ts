import type { ComponentType } from '$lib/classes/DragDropManager.svelte';
import { query } from '$app/server';
import { API_URL } from '$env/static/private';

import { failFromResponse } from '$lib/remote/shared/backend-error';
import { djangoHeaders } from '$lib/remote/shared/remote-auth';

/**
 * Fetch the available component types for the drag-and-drop sidebar.
 * @returns The component type list from the backend.
 * @throws When the backend request fails.
 */
export const getComponentTypes = query(async (): Promise<ComponentType[]> => {
	const response = await fetch(`${API_URL}attributes_component_type/`, {
		method: 'GET',
		headers: djangoHeaders()
	});

	if (!response.ok) await failFromResponse(response, 'Failed to load component types');

	return (await response.json()) as ComponentType[];
});
