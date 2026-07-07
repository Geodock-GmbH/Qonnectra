/**
 * Pure helpers for the Wertermittlung (valuation) page.
 *
 * The backend performs the spatial calculation; these helpers format its
 * numeric result for display and recompute the future-value projection
 * client-side so the projection table can react to year/correction changes
 * without a server round-trip.
 */

/**
 * Format a numeric value as EUR currency (de-DE).
 * @param {number | string | null | undefined} value
 * @returns {string}
 */
export function formatCurrency(value) {
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
 * @param {number | string | null | undefined} value
 * @returns {string}
 */
export function formatQuantity(value) {
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
 *
 * @param {number} total Base net value (grand total).
 * @param {number} baseYear Build-completion year.
 * @param {number} annualCorrection Yearly correction as a fraction (e.g. 0.025).
 * @param {number} [years=22] Number of years to project, including the base year.
 * @returns {Array<{year: number, netValue: number, increase: number | null}>}
 */
export function computeProjection(total, baseYear, annualCorrection, years = 22) {
	const factor = 1 + annualCorrection;
	const projection = [];
	let previous = null;
	for (let offset = 0; offset < years; offset++) {
		const netValue = total * factor ** offset;
		const increase = previous === null ? null : netValue - previous;
		projection.push({ year: baseYear + offset, netValue, increase });
		previous = netValue;
	}
	return projection;
}
