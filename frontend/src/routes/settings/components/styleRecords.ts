import type { Writable } from 'svelte/store';
import { get } from 'svelte/store';

/** A persisted style store keyed by attribute name (node type, surface, ...). */
export type StyleStore<T extends { visible: boolean }> = Writable<Record<string, T>>;

/**
 * Gives every attribute the store has no style for its default, so the map
 * finds a style for each. Leaves the store alone when nothing is missing.
 * @param styles - The style store to complete.
 * @param names - Attribute names the backend knows.
 * @param defaultFor - Builds the default style of a name.
 */
export function seedMissingStyles<T extends { visible: boolean }>(
	styles: StyleStore<T>,
	names: string[],
	defaultFor: (name: string) => T
): void {
	const current = get(styles);
	const missing = names.filter((name) => !current[name]);
	if (missing.length === 0) return;

	styles.set({
		...current,
		...Object.fromEntries(missing.map((name) => [name, defaultFor(name)]))
	});
}

/**
 * Builds the new styles of the given names, keeping whether each one is
 * visible on the map, which the layer tree owns.
 * @param current - The stored styles.
 * @param names - Attribute names to restyle.
 * @param styleFor - Builds the new style of a name.
 * @returns The restyled entries.
 */
function restyled<T extends { visible: boolean }>(
	current: Record<string, T>,
	names: string[],
	styleFor: (name: string) => T
): Record<string, T> {
	return Object.fromEntries(
		names.map((name) => {
			const style = styleFor(name);
			return [name, { ...style, visible: current[name]?.visible ?? style.visible }];
		})
	);
}

/**
 * Changes the looks of the named styles and leaves every other style alone.
 * @param styles - The style store to update.
 * @param names - Attribute names to restyle.
 * @param styleFor - Builds the new style of a name; its `visible` only applies to unstored styles.
 */
export function restyle<T extends { visible: boolean }>(
	styles: StyleStore<T>,
	names: string[],
	styleFor: (name: string) => T
): void {
	const current = get(styles);
	styles.set({ ...current, ...restyled(current, names, styleFor) });
}

/**
 * Changes the looks of every attribute at once. The store is rebuilt from the
 * given names, which drops styles of attributes that no longer exist.
 * @param styles - The style store to rebuild.
 * @param names - Every attribute name the backend knows.
 * @param styleFor - Builds the new style of a name; its `visible` only applies to unstored styles.
 */
export function restyleAll<T extends { visible: boolean }>(
	styles: StyleStore<T>,
	names: string[],
	styleFor: (name: string) => T
): void {
	styles.set(restyled(get(styles), names, styleFor));
}

/**
 * @returns A random `#rrggbb` color.
 */
export function randomHexColor(): string {
	return `#${Math.floor(Math.random() * 0x1000000)
		.toString(16)
		.padStart(6, '0')}`;
}

/**
 * @param min - Smallest size.
 * @param max - Largest size.
 * @returns A random whole point size between `min` and `max`.
 */
export function randomSize(min = 3, max = 30): number {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}
