import { fail } from '@sveltejs/kit';
import { API_URL } from '$env/static/private';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';

/**
 * Get the container hierarchy tree for a node
 * @param {Function} fetch - SvelteKit fetch function
 * @param {import('@sveltejs/kit').Cookies} cookies - Request cookies
 * @param {string} nodeUuid - UUID of the node
 * @returns {Promise<{hierarchy: Object}>} Container hierarchy
 */
export async function getContainerHierarchy(fetch, cookies, nodeUuid) {
	if (!nodeUuid) {
		return fail(400, { error: 'Missing required parameter: nodeUuid' });
	}

	try {
		const headers = getAuthHeaders(cookies);
		const response = await fetch(`${API_URL}container/tree/${nodeUuid}/`, {
			method: 'GET',
			headers
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			return fail(response.status, {
				error: errorData.detail || 'Failed to fetch hierarchy'
			});
		}

		const hierarchy = await response.json();
		return { hierarchy };
	} catch (err) {
		console.error('Error fetching container hierarchy:', err);
		return fail(500, { error: 'Internal server error' });
	}
}

/**
 * Get slot configurations for a node
 * @param {Function} fetch - SvelteKit fetch function
 * @param {import('@sveltejs/kit').Cookies} cookies - Request cookies
 * @param {string} nodeUuid - UUID of the node
 * @returns {Promise<{configurations: Array}>} Slot configurations
 */
export async function getSlotConfigurationsForNode(fetch, cookies, nodeUuid) {
	if (!nodeUuid) {
		return fail(400, { error: 'Missing required parameter: nodeUuid' });
	}

	try {
		const headers = getAuthHeaders(cookies);
		const response = await fetch(`${API_URL}node-slot-configuration/by-node/${nodeUuid}/`, {
			method: 'GET',
			headers
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			return fail(response.status, {
				error: errorData.detail || 'Failed to fetch slot configurations'
			});
		}

		const configurations = await response.json();
		return { configurations };
	} catch (err) {
		console.error('Error fetching slot configurations:', err);
		return fail(500, { error: 'Internal server error' });
	}
}

/**
 * Get node structures for a slot configuration
 * @param {Function} fetch - SvelteKit fetch function
 * @param {import('@sveltejs/kit').Cookies} cookies - Request cookies
 * @param {string} slotConfigUuid - UUID of the slot configuration
 * @returns {Promise<{structures: Array}>} Node structures
 */
export async function getNodeStructures(fetch, cookies, slotConfigUuid) {
	if (!slotConfigUuid) {
		return fail(400, { error: 'Missing required parameter: slotConfigUuid' });
	}

	try {
		const headers = getAuthHeaders(cookies);
		const response = await fetch(`${API_URL}node-structure/?slot_configuration=${slotConfigUuid}`, {
			method: 'GET',
			headers
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			return fail(response.status, {
				error: errorData.detail || 'Failed to fetch node structures'
			});
		}

		const structures = await response.json();
		return { structures };
	} catch (err) {
		console.error('Error fetching node structures:', err);
		return fail(500, { error: 'Internal server error' });
	}
}

/**
 * Get available component types
 * @param {Function} fetch - SvelteKit fetch function
 * @param {import('@sveltejs/kit').Cookies} cookies - Request cookies
 * @returns {Promise<{componentTypes: Array}>} Component types
 */
export async function getComponentTypes(fetch, cookies) {
	try {
		const headers = getAuthHeaders(cookies);
		const response = await fetch(`${API_URL}attributes_component_type/`, {
			method: 'GET',
			headers
		});

		if (!response.ok) {
			return fail(response.status, { error: 'Failed to fetch component types' });
		}

		const componentTypes = await response.json();
		return { componentTypes };
	} catch (err) {
		console.error('Error fetching component types:', err);
		return fail(500, { error: 'Internal server error' });
	}
}

/**
 * Get cables connected to a node
 * @param {Function} fetch - SvelteKit fetch function
 * @param {import('@sveltejs/kit').Cookies} cookies - Request cookies
 * @param {string} nodeUuid - UUID of the node
 * @returns {Promise<{cables: Array}>} Cables at node
 */
export async function getCablesAtNode(fetch, cookies, nodeUuid) {
	if (!nodeUuid) {
		return fail(400, { error: 'Missing required parameter: nodeUuid' });
	}

	try {
		const headers = getAuthHeaders(cookies);
		const response = await fetch(`${API_URL}cable/at-node/${nodeUuid}/`, {
			method: 'GET',
			headers
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			return fail(response.status, {
				error: errorData.detail || 'Failed to fetch cables at node'
			});
		}

		const cables = await response.json();
		return { cables };
	} catch (err) {
		console.error('Error fetching cables at node:', err);
		return fail(500, { error: 'Internal server error' });
	}
}

/**
 * Get fibers for a cable
 * @param {Function} fetch - SvelteKit fetch function
 * @param {import('@sveltejs/kit').Cookies} cookies - Request cookies
 * @param {string} cableUuid - UUID of the cable
 * @returns {Promise<{fibers: Array}>} Fibers for cable
 */
export async function getFibersForCable(fetch, cookies, cableUuid) {
	if (!cableUuid) {
		return fail(400, { error: 'Missing required parameter: cableUuid' });
	}

	try {
		const headers = getAuthHeaders(cookies);
		const response = await fetch(`${API_URL}fiber/by-cable/${cableUuid}/`, {
			method: 'GET',
			headers
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			return fail(response.status, {
				error: errorData.detail || 'Failed to fetch fibers for cable'
			});
		}

		const fibers = await response.json();
		return { fibers };
	} catch (err) {
		console.error('Error fetching fibers for cable:', err);
		return fail(500, { error: 'Internal server error' });
	}
}

/**
 * Get fiber colors
 * @param {Function} fetch - SvelteKit fetch function
 * @param {import('@sveltejs/kit').Cookies} cookies - Request cookies
 * @returns {Promise<{fiberColors: Array}>} Fiber colors
 */
export async function getFiberColors(fetch, cookies) {
	try {
		const headers = getAuthHeaders(cookies);
		const response = await fetch(`${API_URL}attributes_fiber_color/`, {
			method: 'GET',
			headers
		});

		if (!response.ok) {
			return fail(response.status, { error: 'Failed to fetch fiber colors' });
		}

		const fiberColors = await response.json();
		return { fiberColors };
	} catch (err) {
		console.error('Error fetching fiber colors:', err);
		return fail(500, { error: 'Internal server error' });
	}
}

/**
 * Get ports for a component type
 * @param {Function} fetch - SvelteKit fetch function
 * @param {import('@sveltejs/kit').Cookies} cookies - Request cookies
 * @param {string} componentTypeId - ID of the component type
 * @returns {Promise<{ports: Array}>} Component ports
 */
export async function getComponentPorts(fetch, cookies, componentTypeId) {
	if (!componentTypeId) {
		return fail(400, { error: 'Missing required parameter: componentTypeId' });
	}

	try {
		const headers = getAuthHeaders(cookies);
		const response = await fetch(
			`${API_URL}attributes_component_structure/?component_type=${componentTypeId}`,
			{
				method: 'GET',
				headers
			}
		);

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			return fail(response.status, {
				error: errorData.detail || 'Failed to fetch component ports'
			});
		}

		const ports = await response.json();
		return { ports };
	} catch (err) {
		console.error('Error fetching component ports:', err);
		return fail(500, { error: 'Internal server error' });
	}
}

/**
 * Get fiber splices for a node structure
 * @param {Function} fetch - SvelteKit fetch function
 * @param {import('@sveltejs/kit').Cookies} cookies - Request cookies
 * @param {string} nodeStructureUuid - UUID of the node structure
 * @returns {Promise<{splices: Array}>} Fiber splices
 */
export async function getFiberSplices(fetch, cookies, nodeStructureUuid) {
	if (!nodeStructureUuid) {
		return fail(400, { error: 'Missing required parameter: nodeStructureUuid' });
	}

	try {
		const headers = getAuthHeaders(cookies);
		const response = await fetch(`${API_URL}fiber-splice/?node_structure=${nodeStructureUuid}`, {
			method: 'GET',
			headers
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			return fail(response.status, {
				error: errorData.detail || 'Failed to fetch fiber splices'
			});
		}

		const splices = await response.json();
		return { splices };
	} catch (err) {
		console.error('Error fetching fiber splices:', err);
		return fail(500, { error: 'Internal server error' });
	}
}

/**
 * Get slot dividers for a slot configuration
 * @param {Function} fetch - SvelteKit fetch function
 * @param {import('@sveltejs/kit').Cookies} cookies - Request cookies
 * @param {string} slotConfigUuid - UUID of the slot configuration
 * @returns {Promise<{dividers: Array}>} Slot dividers
 */
export async function getSlotDividers(fetch, cookies, slotConfigUuid) {
	if (!slotConfigUuid) {
		return fail(400, { error: 'Missing required parameter: slotConfigUuid' });
	}

	try {
		const headers = getAuthHeaders(cookies);
		const response = await fetch(
			`${API_URL}node-slot-divider/?slot_configuration=${slotConfigUuid}`,
			{
				method: 'GET',
				headers
			}
		);

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			return fail(response.status, {
				error: errorData.detail || 'Failed to fetch dividers'
			});
		}

		const data = await response.json();
		const dividers = Array.isArray(data) ? data : data.results || [];
		return { dividers };
	} catch (err) {
		console.error('Error fetching slot dividers:', err);
		return fail(500, { error: 'Internal server error' });
	}
}

/**
 * Get slot clip numbers for a slot configuration
 * @param {Function} fetch - SvelteKit fetch function
 * @param {import('@sveltejs/kit').Cookies} cookies - Request cookies
 * @param {string} slotConfigUuid - UUID of the slot configuration
 * @returns {Promise<{clipNumbers: Array}>} Slot clip numbers
 */
export async function getSlotClipNumbers(fetch, cookies, slotConfigUuid) {
	if (!slotConfigUuid) {
		return fail(400, { error: 'Missing required parameter: slotConfigUuid' });
	}

	try {
		const headers = getAuthHeaders(cookies);
		const response = await fetch(
			`${API_URL}node-slot-clip-number/?slot_configuration=${slotConfigUuid}`,
			{
				method: 'GET',
				headers
			}
		);

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			return fail(response.status, {
				error: errorData.detail || 'Failed to fetch clip numbers'
			});
		}

		const data = await response.json();
		const clipNumbers = Array.isArray(data) ? data : data.results || [];
		return { clipNumbers };
	} catch (err) {
		console.error('Error fetching slot clip numbers:', err);
		return fail(500, { error: 'Internal server error' });
	}
}

/**
 * Get container types
 * @param {Function} fetch - SvelteKit fetch function
 * @param {import('@sveltejs/kit').Cookies} cookies - Request cookies
 * @returns {Promise<{containerTypes: Array}>} Container types
 */
export async function getContainerTypes(fetch, cookies) {
	try {
		const headers = getAuthHeaders(cookies);
		const response = await fetch(`${API_URL}container-type/`, {
			method: 'GET',
			headers
		});

		if (!response.ok) {
			return fail(response.status, { error: 'Failed to fetch container types' });
		}

		const containerTypes = await response.json();
		return { containerTypes };
	} catch (err) {
		console.error('Error fetching container types:', err);
		return fail(500, { error: 'Internal server error' });
	}
}

/**
 * Get fiber usage in a node (which fibers are already spliced)
 * @param {Function} fetch - SvelteKit fetch function
 * @param {import('@sveltejs/kit').Cookies} cookies - Request cookies
 * @param {string} nodeUuid - UUID of the node
 * @returns {Promise<{usedFiberUuids: Array}>} Used fiber UUIDs
 */
export async function getFiberUsageInNode(fetch, cookies, nodeUuid) {
	if (!nodeUuid) {
		return fail(400, { error: 'Node UUID is required' });
	}

	try {
		const headers = getAuthHeaders(cookies);
		const response = await fetch(`${API_URL}fiber-splice/?node_structure__uuid_node=${nodeUuid}`, {
			method: 'GET',
			headers
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			return fail(response.status, {
				error: errorData.detail || 'Failed to fetch fiber usage'
			});
		}

		const splices = await response.json();

		const usedFiberUuids = new Set();
		splices.forEach((splice) => {
			if (splice.fiber_a) usedFiberUuids.add(splice.fiber_a);
			if (splice.fiber_b) usedFiberUuids.add(splice.fiber_b);
			if (splice.shared_fiber_a) usedFiberUuids.add(splice.shared_fiber_a);
			if (splice.shared_fiber_b) usedFiberUuids.add(splice.shared_fiber_b);
		});

		return {
			usedFiberUuids: Array.from(usedFiberUuids)
		};
	} catch (err) {
		console.error('Error fetching fiber usage in node:', err);
		return fail(500, { error: 'Failed to fetch fiber usage' });
	}
}

/**
 * Get addresses with residential units for a node
 * @param {Function} fetch - SvelteKit fetch function
 * @param {import('@sveltejs/kit').Cookies} cookies - Request cookies
 * @param {string} nodeUuid - UUID of the node
 * @returns {Promise<{addresses: Array}>} Addresses with residential units
 */
export async function getAddressesForNode(fetch, cookies, nodeUuid) {
	if (!nodeUuid) {
		return fail(400, { error: 'Node UUID is required' });
	}

	try {
		const headers = getAuthHeaders(cookies);
		const response = await fetch(`${API_URL}node/${nodeUuid}/addresses/`, {
			method: 'GET',
			headers
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			return fail(response.status, {
				error: errorData.detail || 'Failed to fetch addresses'
			});
		}

		const data = await response.json();
		return { addresses: data.addresses || [] };
	} catch (err) {
		console.error('Error fetching addresses for node:', err);
		return fail(500, { error: 'Failed to fetch addresses' });
	}
}

/**
 * Get used residential units in a node (connected to fibers)
 * @param {Function} fetch - SvelteKit fetch function
 * @param {import('@sveltejs/kit').Cookies} cookies - Request cookies
 * @param {string} nodeUuid - UUID of the node
 * @returns {Promise<{used_uuids: Array}>} Used residential unit UUIDs
 */
export async function getUsedResidentialUnits(fetch, cookies, nodeUuid) {
	if (!nodeUuid) {
		return fail(400, { error: 'Node UUID is required' });
	}

	try {
		const headers = getAuthHeaders(cookies);
		const response = await fetch(`${API_URL}node/${nodeUuid}/used-residential-units/`, {
			method: 'GET',
			headers
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			return fail(response.status, {
				error: errorData.detail || 'Failed to fetch used residential units'
			});
		}

		const data = await response.json();
		return { used_uuids: data.used_uuids || [] };
	} catch (err) {
		console.error('Error fetching used residential units:', err);
		return fail(500, { error: 'Failed to fetch used residential units' });
	}
}
