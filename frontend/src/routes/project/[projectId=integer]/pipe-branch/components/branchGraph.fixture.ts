import type { TrenchesNearNodeMicroduct, TrenchesNearNodeTrench } from '$lib/types';

/**
 * Builds a microduct of a "trenches near node" payload.
 * @param uuid - Microduct UUID.
 * @param number - Position of the microduct within its conduit.
 */
export function microduct(uuid: string, number: number): TrenchesNearNodeMicroduct {
	return {
		uuid,
		number,
		color: 'rot',
		microduct_status: null,
		hex_code: '#ff0000',
		hex_code_secondary: null,
		name_de: 'rot',
		name_en: 'red',
		is_two_layer: false
	};
}

/** Two trenches: `t1` with conduit `c1` (m1, m2) and `t2` with `c2` (m3, m4) and `c3` (m5). */
export const trenches: TrenchesNearNodeTrench[] = [
	{
		uuid: 't1',
		id_trench: 'T-1',
		conduits: [
			{ uuid: 'c1', name: 'Conduit 1', microducts: [microduct('m1', 1), microduct('m2', 2)] }
		]
	},
	{
		uuid: 't2',
		id_trench: 'T-2',
		conduits: [
			{ uuid: 'c2', name: 'Conduit 2', microducts: [microduct('m3', 1), microduct('m4', 2)] },
			{ uuid: 'c3', name: 'Conduit 3', microducts: [microduct('m5', 3)] }
		]
	}
];
