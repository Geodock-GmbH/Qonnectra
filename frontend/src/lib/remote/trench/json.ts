/**
 * Reads a property off an untyped JSON value.
 * @param value - Parsed JSON of unknown shape.
 * @param key - Property to read.
 * @returns The property, or `undefined` when `value` is not an object.
 */
export function property(value: unknown, key: string): unknown {
	return value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined;
}
