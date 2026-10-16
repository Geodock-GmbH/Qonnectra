/**
 * Reads a property off an untyped JSON value.
 * @param value - Parsed JSON of unknown shape.
 * @param key - Property to read.
 * @returns The property, or `undefined` when `value` is not an object.
 */
export function property(value: unknown, key: string): unknown {
	return value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined;
}

/**
 * Cancels the bodies of responses that will not be read, e.g. the other
 * requests of a parallel batch once one of them failed. An unread body keeps
 * its connection waiting until Django closes it.
 * @param responses - Responses whose bodies are no longer needed.
 */
export async function discardBodies(responses: Response[]): Promise<void> {
	await Promise.all(responses.map((response) => response.body?.cancel()));
}

/**
 * Parses the body of a successful response and discards the body of a failed one.
 * @param response - A backend response.
 * @returns The parsed JSON, or `undefined` for a failed response.
 */
export async function readOkJson(response: Response): Promise<unknown> {
	if (response.ok) return response.json();
	await discardBodies([response]);
	return undefined;
}
