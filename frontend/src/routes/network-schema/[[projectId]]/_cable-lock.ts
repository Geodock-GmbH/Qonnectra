/**
 * Serializes work per cable within this process so two concurrent operations for
 * the same cable can't interleave. The second call awaits the first, so a
 * read-then-write (e.g. label upsert) sees the first call's result instead of
 * racing it.
 *
 * NOTE: this guard is per-process only. On a horizontally-scaled deployment the
 * two requests can land on different Node instances and race again. The
 * definitive fix is a backend uniqueness constraint plus an upsert endpoint.
 */
const cableLocks = new Map<string, Promise<unknown>>();

/**
 * Runs `fn` after any in-flight operation for the same cable has settled, so
 * same-cable operations serialize while different cables run concurrently.
 * @param cableId - Cable UUID to lock on.
 * @param fn - The work to serialize.
 * @returns The result of `fn`.
 */
export function withCableLock<T>(cableId: string, fn: () => Promise<T>): Promise<T> {
	const prev = cableLocks.get(cableId) ?? Promise.resolve();
	const next = prev.catch(() => {}).then(fn);
	cableLocks.set(
		cableId,
		next.finally(() => {
			if (cableLocks.get(cableId) === next) cableLocks.delete(cableId);
		})
	);
	return next;
}
