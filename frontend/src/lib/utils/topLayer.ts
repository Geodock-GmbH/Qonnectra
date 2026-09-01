/**
 * Shared monotonic z-index counter for the app's floating top layer (floating
 * panels and modal dialogs). Every overlay that must sit above previously-shown
 * overlays draws its z-index from here, so a confirm dialog opened from inside a
 * floating panel always renders above that panel — even when the panel has been
 * brought to front many times or is maximized to fill the viewport.
 *
 * The counter lives on `window` so all component instances share one sequence.
 */

const BASE_Z_INDEX = 50;
const COUNTER_KEY = '__topLayerZIndex';

type TopLayerWindow = Window & { [COUNTER_KEY]?: number };

/**
 * Returns the next z-index in the shared top-layer sequence. Each call yields a
 * value strictly greater than every previous call, so the most recently raised
 * overlay is always on top. Returns the base value during SSR.
 */
export function nextTopZIndex(): number {
	if (typeof window === 'undefined') return BASE_Z_INDEX;
	const win = window as TopLayerWindow;
	const next = (win[COUNTER_KEY] ?? BASE_Z_INDEX) + 1;
	win[COUNTER_KEY] = next;
	return next;
}
