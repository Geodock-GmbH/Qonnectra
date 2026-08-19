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
	construction_type: string;
}

interface SimulationGeometry {
	affected_trenches?: unknown[];
	affected_nodes?: unknown[];
	affected_addresses?: unknown[];
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
 * Escapes a value for safe inclusion in a CSV cell.
 */
function escapeCsv(value: string): string {
	const str = value == null ? '' : String(value);
	if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
		return `"${str.replace(/"/g, '""')}"`;
	}
	return str;
}

/**
 * Joins an array of values into a single CSV row.
 */
function csvRow(values: string[]): string {
	return values.map(escapeCsv).join(',');
}

/**
 * Builds a CSV string from a fault simulation result containing all sections.
 */
export function buildCsvString(result: FaultSimulationResult): string {
	const lines: string[] = [];

	const trench = result.trench;
	lines.push('Section,Trench');
	lines.push('Trench ID,Construction Type');
	lines.push(csvRow([trench?.id_trench ?? '', trench?.construction_type ?? '']));
	lines.push('');

	const conduits = result.conduits ?? [];
	lines.push('Section,Conduits');
	lines.push('Name,Conduit Type');
	for (const c of conduits) {
		lines.push(csvRow([c.name ?? '', c.conduit_type ?? '']));
	}
	lines.push('');

	const cables = result.cables ?? [];
	lines.push('Section,Cables');
	lines.push('Name,Cable Type,Fiber Count,Dark Fibers,Node Start,Node End');
	for (const k of cables) {
		lines.push(
			csvRow([
				k.name ?? '',
				k.cable_type ?? '',
				String(k.fiber_count ?? ''),
				String(k.dark_fibers ?? ''),
				k.node_start?.name ?? '',
				k.node_end?.name ?? ''
			])
		);
	}
	lines.push('');

	const addresses = result.affected_addresses_details ?? [];
	lines.push('Section,Affected Addresses');
	lines.push(
		'Address ID,Street,Housenumber,Zip Code,City,Residential Unit ID,Floor,Side,Type,Status'
	);
	for (const addr of addresses) {
		const base = [
			addr.id_address ?? '',
			addr.street ?? '',
			addr.housenumber ?? '',
			addr.zip_code ?? '',
			addr.city ?? ''
		];
		const units = addr.residential_units ?? [];
		if (units.length === 0) {
			lines.push(csvRow([...base, '', '', '', '', '']));
		} else {
			for (const ru of units) {
				lines.push(
					csvRow([
						...base,
						ru.id_residential_unit ?? '',
						ru.floor ?? '',
						ru.side ?? '',
						ru.type ?? '',
						ru.status ?? ''
					])
				);
			}
		}
	}
	lines.push('');

	return lines.join('\r\n');
}

const UTF8_BOM = '﻿';

/**
 * Triggers a browser download of the fault simulation result as CSV.
 */
export function downloadFaultSimulationCsv(result: FaultSimulationResult, trenchId?: string): void {
	const csv = buildCsvString(result);
	const blob = new Blob([UTF8_BOM, csv], { type: 'text/csv;charset=utf-8;' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	const idShort = trenchId?.slice(0, 20) || 'fault-simulation';
	a.download = `fault-simulation-${idShort}.csv`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}
