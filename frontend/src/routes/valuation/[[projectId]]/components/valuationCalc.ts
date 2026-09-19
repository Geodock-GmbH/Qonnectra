/**
 * Pure helpers for the Wertermittlung (valuation) page.
 *
 * The backend performs the spatial calculation; these helpers format its
 * numeric result for display, recompute the future-value projection
 * client-side so the projection table can react to year/correction changes
 * without a server round-trip, and group the selectable areas by type.
 */

import type { ValuationArea } from '$lib/remote/valuation/valuation-data';

export interface ProjectionRow {
	year: number;
	netValue: number;
	increase: number | null;
}

/**
 * Format a numeric value as EUR currency (de-DE).
 */
export function formatCurrency(value: number | string | null | undefined): string {
	if (value === null || value === undefined || value === '') return '–';
	const num = typeof value === 'string' ? Number(value) : value;
	if (!Number.isFinite(num)) return '–';
	return new Intl.NumberFormat('de-DE', {
		style: 'currency',
		currency: 'EUR',
		maximumFractionDigits: 2
	}).format(num);
}

/**
 * Format a numeric quantity (de-DE) with up to two decimals.
 */
export function formatQuantity(value: number | string | null | undefined): string {
	if (value === null || value === undefined || value === '') return '–';
	const num = typeof value === 'string' ? Number(value) : value;
	if (!Number.isFinite(num)) return '–';
	return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(num);
}

/**
 * Recompute the future-value projection from a total.
 *
 * Each year's net value is `total * (1 + annualCorrection) ** offset`, and the
 * increase is the delta from the previous year (null for the base year).
 */
export function computeProjection(
	total: number,
	baseYear: number,
	annualCorrection: number,
	years = 22
): ProjectionRow[] {
	const factor = 1 + annualCorrection;
	const projection: ProjectionRow[] = [];
	let previous: number | null = null;
	for (let offset = 0; offset < years; offset++) {
		const netValue = total * factor ** offset;
		const increase = previous === null ? null : netValue - previous;
		projection.push({ year: baseYear + offset, netValue, increase });
		previous = netValue;
	}
	return projection;
}

/** The areas sharing one area type, as listed in the area selection. */
export interface AreaGroup {
	type: string;
	areas: ValuationArea[];
}

/**
 * Group areas by their type, keeping the order in which types first appear.
 * @param areas - The areas to group.
 * @param untypedLabel - Group name for areas without a type.
 * @returns One group per area type.
 */
export function groupAreasByType(areas: ValuationArea[], untypedLabel: string): AreaGroup[] {
	const groups = new Map<string, ValuationArea[]>();
	for (const area of areas) {
		const type = area.areaType ?? untypedLabel;
		const group = groups.get(type);
		if (group) group.push(area);
		else groups.set(type, [area]);
	}
	return Array.from(groups, ([type, items]) => ({ type, areas: items }));
}
