import type { CableEndOption } from '$lib/types/trace';

import { m } from '$lib/paraglide/messages';

/**
 * Labels a cable end for the picker: its name, whether it starts or ends
 * its cable, and whether the backend falls back to it.
 * @param option - The cable end.
 * @returns The label.
 */
export function cableEndLabel(option: CableEndOption): string {
	const side =
		option.direction === 'start' ? m.signal_source_cable_start() : m.signal_source_cable_end();
	const fallback = option.is_default ? ` (${m.common_default()})` : '';
	return `${option.name} (${side})${fallback}`;
}
