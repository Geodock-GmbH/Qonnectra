/**
 * @param {string} value
 * @returns {string}
 */
function escapeCsv(value) {
	const str = value == null ? '' : String(value);
	if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
		return `"${str.replace(/"/g, '""')}"`;
	}
	return str;
}

/**
 * @param {string[]} values
 * @returns {string}
 */
function csvRow(values) {
	return values.map(escapeCsv).join(',');
}

/**
 * Builds a CSV string from a fault simulation result containing all sections.
 * @param {Record<string, any>} result
 * @returns {string}
 */
export function buildCsvString(result) {
	const lines = [];

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
				k.fiber_count ?? '',
				k.dark_fibers ?? '',
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

const UTF8_BOM = '\uFEFF';

/**
 * Triggers a browser download of the fault simulation result as CSV.
 * @param {Record<string, any>} result
 * @param {string} trenchId
 * @returns {void}
 */
export function downloadFaultSimulationCsv(result, trenchId) {
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
