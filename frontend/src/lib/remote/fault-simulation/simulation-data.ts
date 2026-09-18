import { backendErrorMessage } from '$lib/remote/shared/backend-error';

export interface ResidentialUnit {
	uuid: string;
	id_residential_unit: string;
	floor: string;
	side: string;
	type: string;
	status: string;
}

export interface AffectedAddress {
	uuid: string;
	id_address: string;
	street: string;
	housenumber: string;
	zip_code: string;
	city: string;
	residential_units: ResidentialUnit[];
}

interface CableNode {
	name: string;
}

export interface Cable {
	uuid: string;
	name: string;
	cable_type: string;
	fiber_count: number;
	dark_fibers: number;
	node_start: CableNode | null;
	node_end: CableNode | null;
}

export interface Conduit {
	uuid: string;
	name: string;
	conduit_type: string;
}

export interface Trench {
	id_trench: string;
	construction_type: string | null;
	uuid?: string | null;
}

/** A GeoJSON feature collection in the storage projection. */
export interface SimulationFeatureCollection {
	type: 'FeatureCollection';
	features: unknown[];
}

interface SimulationGeometry {
	affected_trenches?: SimulationFeatureCollection;
	affected_nodes?: SimulationFeatureCollection;
	affected_addresses?: SimulationFeatureCollection;
}

interface SimulationSummary {
	[key: string]: unknown;
}

export interface FaultSimulationResult {
	trench: Trench | null;
	conduits: Conduit[];
	cables: Cable[];
	affected_addresses_details: AffectedAddress[];
	summary?: SimulationSummary;
	geometry?: SimulationGeometry;
}

/**
 * Builds the message for a failed simulation. The simulation endpoint reports
 * problems under an `error` key rather than DRF's `detail`.
 * @param errorData - Parsed JSON error body (may be anything).
 * @param fallback - Message when the body carries nothing usable.
 * @returns A user-facing error message.
 */
export function simulationErrorMessage(errorData: unknown, fallback: string): string {
	if (errorData && typeof errorData === 'object' && 'error' in errorData) {
		const { error } = errorData;
		if (typeof error === 'string' && error) return error;
	}
	return backendErrorMessage(errorData, fallback);
}
