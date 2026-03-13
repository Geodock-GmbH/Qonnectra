import { fail } from '@sveltejs/kit';
import { API_URL } from '$env/static/private';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';

/**
 * @typedef {Object} ContainerHierarchyNode
 * @property {string} uuid - Container UUID
 * @property {string} name - Container name
 * @property {string} [container_type] - Container type name
 * @property {ContainerHierarchyNode[]} [children] - Child containers
 */

/**
 * @typedef {Object} SlotConfiguration
 * @property {string} uuid - Slot configuration UUID
 * @property {string} name - Slot configuration name
 * @property {number} [position] - Position in slot
 */

/**
 * @typedef {Object} NodeStructure
 * @property {string} uuid - Node structure UUID
 * @property {string} [component_type] - Component type name
 * @property {number} [slot_position] - Position in slot
 */

/**
 * @typedef {Object} ComponentType
 * @property {string} uuid - Component type UUID
 * @property {string} name - Component type name
 * @property {string} [category] - Component category
 */

/**
 * @typedef {Object} Cable
 * @property {string} uuid - Cable UUID
 * @property {string} name - Cable name
 * @property {number} [fiber_count] - Number of fibers
 */

/**
 * @typedef {Object} Fiber
 * @property {string} uuid - Fiber UUID
 * @property {number} fiber_number - Fiber position number
 * @property {string} [color] - Fiber color name
 */

/**
 * @typedef {Object} FiberColor
 * @property {string} uuid - Fiber color UUID
 * @property {string} name - Color name
 * @property {string} hex_code - Hex color code
 */

/**
 * @typedef {Object} ComponentPort
 * @property {string} uuid - Port UUID
 * @property {string} name - Port name
 * @property {number} [position] - Port position
 */

/**
 * @typedef {Object} FiberSplice
 * @property {string} uuid - Splice UUID
 * @property {string} [fiber_a] - First fiber UUID
 * @property {string} [fiber_b] - Second fiber UUID
 */

/**
 * @typedef {Object} SlotDivider
 * @property {string} uuid - Divider UUID
 * @property {number} position - Divider position
 */

/**
 * @typedef {Object} SlotClipNumber
 * @property {string} uuid - Clip number UUID
 * @property {number} clip_number - Clip number value
 */

/**
 * @typedef {Object} ContainerType
 * @property {string} uuid - Container type UUID
 * @property {string} name - Container type name
 */

/**
 * @typedef {Object} Address
 * @property {string} uuid - Address UUID
 * @property {string} [street] - Street name
 * @property {string} [housenumber] - House number
 * @property {ResidentialUnit[]} [residential_units] - Units at this address
 */

/**
 * @typedef {Object} ResidentialUnit
 * @property {string} uuid - Residential unit UUID
 * @property {string} [unit_name] - Unit identifier
 */

/**
 * Gets the container hierarchy tree for a node.
 * @param {typeof fetch} fetch - SvelteKit fetch function
 * @param {import('@sveltejs/kit').Cookies} cookies - Request cookies
 * @param {string} nodeUuid - UUID of the node
 * @returns {Promise<{hierarchy: ContainerHierarchyNode} | import('@sveltejs/kit').ActionFailure<{error: string}>>} Container hierarchy tree
 */
export async function getContainerHierarchy(fetch, cookies, nodeUuid) {
	if (!nodeUuid) {
		return fail(400, { error: 'Missing required parameter: nodeUuid' });
	}

	try {
		const headers = /** @type {Record<string, string>} */ (getAuthHeaders(cookies));
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
 * Gets slot configurations for a node.
 * @param {typeof fetch} fetch - SvelteKit fetch function
 * @param {import('@sveltejs/kit').Cookies} cookies - Request cookies
 * @param {string} nodeUuid - UUID of the node
 * @returns {Promise<{configurations: SlotConfiguration[]} | import('@sveltejs/kit').ActionFailure<{error: string}>>} Slot configurations
 */
export async function getSlotConfigurationsForNode(fetch, cookies, nodeUuid) {
	if (!nodeUuid) {
		return fail(400, { error: 'Missing required parameter: nodeUuid' });
	}

	try {
		const headers = /** @type {Record<string, string>} */ (getAuthHeaders(cookies));
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
 * Gets node structures for a slot configuration.
 * @param {typeof fetch} fetch - SvelteKit fetch function
 * @param {import('@sveltejs/kit').Cookies} cookies - Request cookies
 * @param {string} slotConfigUuid - UUID of the slot configuration
 * @returns {Promise<{structures: NodeStructure[]} | import('@sveltejs/kit').ActionFailure<{error: string}>>} Node structures
 */
export async function getNodeStructures(fetch, cookies, slotConfigUuid) {
	if (!slotConfigUuid) {
		return fail(400, { error: 'Missing required parameter: slotConfigUuid' });
	}

	try {
		const headers = /** @type {Record<string, string>} */ (getAuthHeaders(cookies));
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
 * Gets available component types.
 * @param {typeof fetch} fetch - SvelteKit fetch function
 * @param {import('@sveltejs/kit').Cookies} cookies - Request cookies
 * @returns {Promise<{componentTypes: ComponentType[]} | import('@sveltejs/kit').ActionFailure<{error: string}>>} Component types
 */
export async function getComponentTypes(fetch, cookies) {
	try {
		const headers = /** @type {Record<string, string>} */ (getAuthHeaders(cookies));
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
 * Gets cables connected to a node.
 * @param {typeof fetch} fetch - SvelteKit fetch function
 * @param {import('@sveltejs/kit').Cookies} cookies - Request cookies
 * @param {string} nodeUuid - UUID of the node
 * @returns {Promise<{cables: Cable[]} | import('@sveltejs/kit').ActionFailure<{error: string}>>} Cables at node
 */
export async function getCablesAtNode(fetch, cookies, nodeUuid) {
	if (!nodeUuid) {
		return fail(400, { error: 'Missing required parameter: nodeUuid' });
	}

	try {
		const headers = /** @type {Record<string, string>} */ (getAuthHeaders(cookies));
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
 * Gets fibers for a cable.
 * @param {typeof fetch} fetch - SvelteKit fetch function
 * @param {import('@sveltejs/kit').Cookies} cookies - Request cookies
 * @param {string} cableUuid - UUID of the cable
 * @returns {Promise<{fibers: Fiber[]} | import('@sveltejs/kit').ActionFailure<{error: string}>>} Fibers for cable
 */
export async function getFibersForCable(fetch, cookies, cableUuid) {
	if (!cableUuid) {
		return fail(400, { error: 'Missing required parameter: cableUuid' });
	}

	try {
		const headers = /** @type {Record<string, string>} */ (getAuthHeaders(cookies));
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
 * Gets fiber colors.
 * @param {typeof fetch} fetch - SvelteKit fetch function
 * @param {import('@sveltejs/kit').Cookies} cookies - Request cookies
 * @returns {Promise<{fiberColors: FiberColor[]} | import('@sveltejs/kit').ActionFailure<{error: string}>>} Fiber colors
 */
export async function getFiberColors(fetch, cookies) {
	try {
		const headers = /** @type {Record<string, string>} */ (getAuthHeaders(cookies));
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
 * Gets ports for a component type.
 * @param {typeof fetch} fetch - SvelteKit fetch function
 * @param {import('@sveltejs/kit').Cookies} cookies - Request cookies
 * @param {string} componentTypeId - ID of the component type
 * @returns {Promise<{ports: ComponentPort[]} | import('@sveltejs/kit').ActionFailure<{error: string}>>} Component ports
 */
export async function getComponentPorts(fetch, cookies, componentTypeId) {
	if (!componentTypeId) {
		return fail(400, { error: 'Missing required parameter: componentTypeId' });
	}

	try {
		const headers = /** @type {Record<string, string>} */ (getAuthHeaders(cookies));
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
 * Gets fiber splices for a node structure.
 * @param {typeof fetch} fetch - SvelteKit fetch function
 * @param {import('@sveltejs/kit').Cookies} cookies - Request cookies
 * @param {string} nodeStructureUuid - UUID of the node structure
 * @returns {Promise<{splices: FiberSplice[]} | import('@sveltejs/kit').ActionFailure<{error: string}>>} Fiber splices
 */
export async function getFiberSplices(fetch, cookies, nodeStructureUuid) {
	if (!nodeStructureUuid) {
		return fail(400, { error: 'Missing required parameter: nodeStructureUuid' });
	}

	try {
		const headers = /** @type {Record<string, string>} */ (getAuthHeaders(cookies));
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
 * Gets slot dividers for a slot configuration.
 * @param {typeof fetch} fetch - SvelteKit fetch function
 * @param {import('@sveltejs/kit').Cookies} cookies - Request cookies
 * @param {string} slotConfigUuid - UUID of the slot configuration
 * @returns {Promise<{dividers: SlotDivider[]} | import('@sveltejs/kit').ActionFailure<{error: string}>>} Slot dividers
 */
export async function getSlotDividers(fetch, cookies, slotConfigUuid) {
	if (!slotConfigUuid) {
		return fail(400, { error: 'Missing required parameter: slotConfigUuid' });
	}

	try {
		const headers = /** @type {Record<string, string>} */ (getAuthHeaders(cookies));
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
 * Gets slot clip numbers for a slot configuration.
 * @param {typeof fetch} fetch - SvelteKit fetch function
 * @param {import('@sveltejs/kit').Cookies} cookies - Request cookies
 * @param {string} slotConfigUuid - UUID of the slot configuration
 * @returns {Promise<{clipNumbers: SlotClipNumber[]} | import('@sveltejs/kit').ActionFailure<{error: string}>>} Slot clip numbers
 */
export async function getSlotClipNumbers(fetch, cookies, slotConfigUuid) {
	if (!slotConfigUuid) {
		return fail(400, { error: 'Missing required parameter: slotConfigUuid' });
	}

	try {
		const headers = /** @type {Record<string, string>} */ (getAuthHeaders(cookies));
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
 * Gets container types.
 * @param {typeof fetch} fetch - SvelteKit fetch function
 * @param {import('@sveltejs/kit').Cookies} cookies - Request cookies
 * @returns {Promise<{containerTypes: ContainerType[]} | import('@sveltejs/kit').ActionFailure<{error: string}>>} Container types
 */
export async function getContainerTypes(fetch, cookies) {
	try {
		const headers = /** @type {Record<string, string>} */ (getAuthHeaders(cookies));
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
 * Gets fiber usage in a node (which fibers are already spliced).
 * @param {typeof fetch} fetch - SvelteKit fetch function
 * @param {import('@sveltejs/kit').Cookies} cookies - Request cookies
 * @param {string} nodeUuid - UUID of the node
 * @returns {Promise<{usedFiberUuids: string[]} | import('@sveltejs/kit').ActionFailure<{error: string}>>} Used fiber UUIDs
 */
export async function getFiberUsageInNode(fetch, cookies, nodeUuid) {
	if (!nodeUuid) {
		return fail(400, { error: 'Node UUID is required' });
	}

	try {
		const headers = /** @type {Record<string, string>} */ (getAuthHeaders(cookies));
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

		/** @type {Array<{fiber_a?: string, fiber_b?: string, shared_fiber_a?: string, shared_fiber_b?: string}>} */
		const splices = await response.json();

		/** @type {Set<string>} */
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
 * Gets addresses with residential units for a node.
 * @param {typeof fetch} fetch - SvelteKit fetch function
 * @param {import('@sveltejs/kit').Cookies} cookies - Request cookies
 * @param {string} nodeUuid - UUID of the node
 * @returns {Promise<{addresses: Address[]} | import('@sveltejs/kit').ActionFailure<{error: string}>>} Addresses with residential units
 */
export async function getAddressesForNode(fetch, cookies, nodeUuid) {
	if (!nodeUuid) {
		return fail(400, { error: 'Node UUID is required' });
	}

	try {
		const headers = /** @type {Record<string, string>} */ (getAuthHeaders(cookies));
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
 * Exports node structure data as Excel file.
 * @param {typeof fetch} fetch - SvelteKit fetch function
 * @param {import('@sveltejs/kit').Cookies} cookies - Request cookies
 * @param {string} nodeUuid - UUID of the node
 * @returns {Promise<{fileData: string, fileName: string} | import('@sveltejs/kit').ActionFailure<{error: string}>>} Base64-encoded file data and filename
 */
export async function exportNodeExcel(fetch, cookies, nodeUuid) {
	if (!nodeUuid) {
		return fail(400, { error: 'Missing nodeUuid' });
	}

	try {
		const headers = /** @type {Record<string, string>} */ (getAuthHeaders(cookies));
		const response = await fetch(`${API_URL}node-export/excel/${nodeUuid}/`, { headers });

		if (!response.ok) {
			return fail(response.status, { error: 'Export failed' });
		}

		const arrayBuffer = await response.arrayBuffer();
		const base64 = Buffer.from(arrayBuffer).toString('base64');
		const contentDisposition = response.headers.get('Content-Disposition') || '';
		const fileNameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
		const fileName = fileNameMatch ? fileNameMatch[1] : 'structure.xlsx';

		return { fileData: base64, fileName };
	} catch (err) {
		console.error('Export error:', err);
		return fail(500, { error: 'Export failed' });
	}
}

/**
 * Gets used residential units in a node (connected to fibers).
 * @param {typeof fetch} fetch - SvelteKit fetch function
 * @param {import('@sveltejs/kit').Cookies} cookies - Request cookies
 * @param {string} nodeUuid - UUID of the node
 * @returns {Promise<{used_uuids: string[]} | import('@sveltejs/kit').ActionFailure<{error: string}>>} Used residential unit UUIDs
 */
export async function getUsedResidentialUnits(fetch, cookies, nodeUuid) {
	if (!nodeUuid) {
		return fail(400, { error: 'Node UUID is required' });
	}

	try {
		const headers = /** @type {Record<string, string>} */ (getAuthHeaders(cookies));
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
