import { property } from '$lib/remote/shared/json';

/** A GeoJSON geometry in the storage projection. */
export interface AreaGeometry {
	type: string;
	coordinates: unknown;
}

/** An area that a valuation can be restricted to. */
export interface ValuationArea {
	uuid: string;
	name: string;
	areaType: string | null;
	geometry: AreaGeometry | null;
}

/** How a cost rate is multiplied: by trench metres or by counted nodes. */
export type ValuationUnit = 'per_meter' | 'per_piece';

/** One cost rate of a valuation with the quantity found for it. */
export interface ValuationCategory {
	name: string;
	unit: ValuationUnit;
	amount: number;
	quantity: number;
	totalPrice: number;
}

/** A calculated valuation. */
export interface ValuationResult {
	categories: ValuationCategory[];
	total: number;
	costPerHouseConnection: number | null;
	costPerMeter: number | null;
}

/**
 * Reads a number the backend may deliver as a decimal string.
 * @param value - Parsed JSON value.
 * @returns The finite number, or `null` when there is none.
 */
function toNumber(value: unknown): number | null {
	if (value === null || value === undefined || value === '') return null;
	const number = Number(value);
	return Number.isFinite(number) ? number : null;
}

/**
 * Maps the GeoJSON feature collection of `area/all/` to lean areas, dropping
 * features without an id since they cannot be selected.
 * @param body - The raw response body.
 * @returns The selectable areas, or an empty array when none.
 */
export function toValuationAreas(body: unknown): ValuationArea[] {
	const features = property(body, 'features');
	if (!Array.isArray(features)) return [];

	return features.flatMap((feature: unknown): ValuationArea[] => {
		const properties = property(feature, 'properties');
		const uuid = property(feature, 'id') ?? property(properties, 'uuid');
		if (!uuid) return [];

		const areaType = property(property(properties, 'area_type'), 'area_type');
		const geometry = property(feature, 'geometry');

		return [
			{
				uuid: String(uuid),
				name: String(property(properties, 'name') ?? ''),
				areaType: typeof areaType === 'string' && areaType ? areaType : null,
				geometry: geometry && typeof geometry === 'object' ? (geometry as AreaGeometry) : null
			}
		];
	});
}

/**
 * Counts the cost rates in a `valuation-rates/` response, paginated or not.
 * @param body - The raw response body.
 * @returns The number of cost rates.
 */
export function countValuationRates(body: unknown): number {
	if (Array.isArray(body)) return body.length;

	const count = property(body, 'count');
	if (typeof count === 'number') return count;

	const results = property(body, 'results');
	return Array.isArray(results) ? results.length : 0;
}

/**
 * Maps the `valuation/calculate/` response to the page model. The backend
 * serializes its decimals as strings, so every figure is read as a number.
 * @param body - The raw response body.
 * @returns The valuation; empty when the body is unusable.
 */
export function toValuationResult(body: unknown): ValuationResult {
	const categories = property(body, 'categories');

	return {
		categories: (Array.isArray(categories) ? categories : []).map(
			(category: unknown): ValuationCategory => ({
				name: String(property(category, 'name') ?? ''),
				unit: property(category, 'unit') === 'per_meter' ? 'per_meter' : 'per_piece',
				amount: toNumber(property(category, 'amount')) ?? 0,
				quantity: toNumber(property(category, 'quantity')) ?? 0,
				totalPrice: toNumber(property(category, 'gp')) ?? 0
			})
		),
		total: toNumber(property(body, 'total')) ?? 0,
		costPerHouseConnection: toNumber(property(body, 'cost_per_house_connection')),
		costPerMeter: toNumber(property(body, 'cost_per_meter'))
	};
}
