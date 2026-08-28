import type { ActionFailure, Cookies } from '@sveltejs/kit';
import { fail } from '@sveltejs/kit';
import { API_URL } from '$env/static/private';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';

/**
 * Maps node API responses (GeoJSON, minimal, or flat array) to combobox option format.
 */
export function mapNodesToOptions(nodesData: unknown): { value: string; label: string }[] {
	const items =
		(nodesData as any)?.features || (nodesData as any)?.nodes || (nodesData as any) || [];
	return items.map((item: any) => {
		const node = item.properties || item;
		return {
			value: item.id || node.uuid,
			label: node.name || 'Unnamed Node'
		};
	});
}

export interface ContainerHierarchyNode {
	/** Container UUID */
	uuid: string;
	/** Container name */
	name: string;
	/** Container type name */
	container_type?: string;
	/** Child containers */
	children?: ContainerHierarchyNode[];
}

export interface SlotConfiguration {
	/** Slot configuration UUID */
	uuid: string;
	/** Slot configuration name */
	name: string;
	/** Position in slot */
	position?: number;
}

export interface NodeStructure {
	/** Node structure UUID */
	uuid: string;
	/** Component type name */
	component_type?: string;
	/** Position in slot */
	slot_position?: number;
}

export interface ComponentType {
	/** Component type UUID */
	uuid: string;
	/** Component type name */
	name: string;
	/** Component category */
	category?: string;
}

export interface Cable {
	/** Cable UUID */
	uuid: string;
	/** Cable name */
	name: string;
	/** Number of fibers */
	fiber_count?: number;
}

interface Fiber {
	/** Fiber UUID */
	uuid: string;
	/** Fiber position number */
	fiber_number: number;
	/** Fiber color name */
	color?: string;
}

/**
 * A fiber color as served by the `attributes_fiber_color/` endpoint
 * (`AttributesFiberColorSerializer`). Shared across the cable/fiber managers.
 */
export interface FiberColor {
	/** Database id */
	id: number;
	/** German color name */
	name_de: string;
	/** English color name */
	name_en: string;
	/** Primary hex color code */
	hex_code: string;
	/** Optional secondary hex color code (for striped colors) */
	hex_code_secondary?: string | null;
	/** Sort order */
	display_order: number;
	/** Whether the color is active */
	is_active?: boolean;
	/** Optional description */
	description?: string | null;
}

export interface ComponentPort {
	/** Port UUID */
	uuid: string;
	/** Port name */
	name: string;
	/** Port position */
	position?: number;
}

export interface FiberSplice {
	/** Splice UUID */
	uuid: string;
	/** First fiber UUID */
	fiber_a?: string;
	/** Second fiber UUID */
	fiber_b?: string;
}

export interface SlotDivider {
	/** Divider UUID */
	uuid: string;
	/** Divider position */
	position: number;
}

export interface SlotClipNumber {
	/** Clip number UUID */
	uuid: string;
	/** Clip number value */
	clip_number: number;
}

export interface ContainerType {
	/** Container type UUID */
	uuid: string;
	/** Container type name */
	name: string;
}

export interface Address {
	/** Address UUID */
	uuid: string;
	/** Street name */
	street?: string;
	/** House number */
	housenumber?: string;
	/** Units at this address */
	residential_units?: ResidentialUnit[];
}

export interface ResidentialUnit {
	/** Residential unit UUID */
	uuid: string;
	/** Unit identifier */
	unit_name?: string;
}

export interface ComponentPlacement {
	component_type: string;
	slot_start: number;
	port_number: number;
	side: string;
}

/**
 * Gets the container hierarchy tree for a node.
 */
export async function getContainerHierarchy(
	fetch: typeof globalThis.fetch,
	cookies: Cookies,
	nodeUuid: string
): Promise<{ hierarchy: ContainerHierarchyNode } | ActionFailure<{ error: string }>> {
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
 * Gets slot configurations for a node.
 */
export async function getSlotConfigurationsForNode(
	fetch: typeof globalThis.fetch,
	cookies: Cookies,
	nodeUuid: string
): Promise<{ configurations: SlotConfiguration[] } | ActionFailure<{ error: string }>> {
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
 * Gets node structures for a slot configuration.
 */
export async function getNodeStructures(
	fetch: typeof globalThis.fetch,
	cookies: Cookies,
	slotConfigUuid: string
): Promise<{ structures: NodeStructure[] } | ActionFailure<{ error: string }>> {
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
 * Gets available component types.
 */
export async function getComponentTypes(
	fetch: typeof globalThis.fetch,
	cookies: Cookies
): Promise<{ componentTypes: ComponentType[] } | ActionFailure<{ error: string }>> {
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
 * Gets cables connected to a node.
 */
export async function getCablesAtNode(
	fetch: typeof globalThis.fetch,
	cookies: Cookies,
	nodeUuid: string
): Promise<{ cables: Cable[] } | ActionFailure<{ error: string }>> {
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
 * Gets fibers for a cable.
 */
export async function getFibersForCable(
	fetch: typeof globalThis.fetch,
	cookies: Cookies,
	cableUuid: string
): Promise<{ fibers: Fiber[] } | ActionFailure<{ error: string }>> {
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
 * Gets fiber colors.
 */
export async function getFiberColors(
	fetch: typeof globalThis.fetch,
	cookies: Cookies
): Promise<{ fiberColors: FiberColor[] } | ActionFailure<{ error: string }>> {
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
 * Gets ports for a component type.
 */
export async function getComponentPorts(
	fetch: typeof globalThis.fetch,
	cookies: Cookies,
	componentTypeId: string
): Promise<{ ports: ComponentPort[] } | ActionFailure<{ error: string }>> {
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
 * Gets fiber splices for a node structure.
 */
export async function getFiberSplices(
	fetch: typeof globalThis.fetch,
	cookies: Cookies,
	nodeStructureUuid: string
): Promise<{ splices: FiberSplice[] } | ActionFailure<{ error: string }>> {
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
 * Gets slot dividers for a slot configuration.
 */
export async function getSlotDividers(
	fetch: typeof globalThis.fetch,
	cookies: Cookies,
	slotConfigUuid: string
): Promise<{ dividers: SlotDivider[] } | ActionFailure<{ error: string }>> {
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
 * Gets slot clip numbers for a slot configuration.
 */
export async function getSlotClipNumbers(
	fetch: typeof globalThis.fetch,
	cookies: Cookies,
	slotConfigUuid: string
): Promise<{ clipNumbers: SlotClipNumber[] } | ActionFailure<{ error: string }>> {
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
 * Gets container types.
 */
export async function getContainerTypes(
	fetch: typeof globalThis.fetch,
	cookies: Cookies
): Promise<{ containerTypes: ContainerType[] } | ActionFailure<{ error: string }>> {
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
 * Gets fiber usage in a node (which fibers are already spliced) with component placement info.
 */
export async function getFiberUsageInNode(
	fetch: typeof globalThis.fetch,
	cookies: Cookies,
	nodeUuid: string
): Promise<
	| {
			usedFiberUuids: string[];
			fiberComponentMap: Record<string, ComponentPlacement>;
	  }
	| ActionFailure<{ error: string }>
> {
	if (!nodeUuid) {
		return fail(400, { error: 'Node UUID is required' });
	}

	try {
		const headers = getAuthHeaders(cookies);
		const response = await fetch(`${API_URL}node/${nodeUuid}/used-fibers/`, {
			method: 'GET',
			headers
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			return fail(response.status, {
				error: errorData.detail || 'Failed to fetch fiber usage'
			});
		}

		const data = await response.json();

		const fiberComponentMap: Record<string, ComponentPlacement> = {};
		if (data.fiber_component_map) {
			for (const [uuid, info] of Object.entries(data.fiber_component_map)) {
				fiberComponentMap[uuid] = info as ComponentPlacement;
			}
		}

		return {
			usedFiberUuids: data.used_uuids || [],
			fiberComponentMap
		};
	} catch (err) {
		console.error('Error fetching fiber usage in node:', err);
		return fail(500, { error: 'Failed to fetch fiber usage' });
	}
}

/**
 * Gets addresses with residential units for a node.
 */
export async function getAddressesForNode(
	fetch: typeof globalThis.fetch,
	cookies: Cookies,
	nodeUuid: string
): Promise<{ addresses: Address[] } | ActionFailure<{ error: string }>> {
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
 * Exports node structure data as Excel file.
 */
export async function exportNodeExcel(
	fetch: typeof globalThis.fetch,
	cookies: Cookies,
	nodeUuid: string
): Promise<{ fileData: string; fileName: string } | ActionFailure<{ error: string }>> {
	if (!nodeUuid) {
		return fail(400, { error: 'Missing nodeUuid' });
	}

	try {
		const headers = getAuthHeaders(cookies);
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
 * Gets used residential units in a node (connected to fibers) with component placement info.
 */
export async function getUsedResidentialUnits(
	fetch: typeof globalThis.fetch,
	cookies: Cookies,
	nodeUuid: string
): Promise<
	| {
			used_uuids: string[];
			residentialUnitComponentMap: Record<string, ComponentPlacement>;
	  }
	| ActionFailure<{ error: string }>
> {
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

		const residentialUnitComponentMap: Record<string, ComponentPlacement> = {};
		if (data.residential_unit_component_map) {
			for (const [uuid, info] of Object.entries(data.residential_unit_component_map)) {
				residentialUnitComponentMap[uuid] = info as ComponentPlacement;
			}
		}

		return {
			used_uuids: data.used_uuids || [],
			residentialUnitComponentMap
		};
	} catch (err) {
		console.error('Error fetching used residential units:', err);
		return fail(500, { error: 'Failed to fetch used residential units' });
	}
}
