/**
 * Fires a cancelable beforeunload event and reports whether it was prevented.
 * @returns True when a handler blocked the unload
 */
export function fireBeforeUnload(): boolean {
	const event = new Event('beforeunload', { cancelable: true });
	window.dispatchEvent(event);
	return event.defaultPrevented;
}
