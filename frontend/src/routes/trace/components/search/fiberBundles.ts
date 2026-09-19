import type { Fiber, FiberBundle } from '$lib/classes/CableFiberDataManager.svelte';

/**
 * Groups a cable's fibers by their bundle.
 * @param fibers - The cable's fibers.
 * @returns The bundles ordered by bundle number, each keeping its fibers' order.
 */
export function groupFibersByBundle(fibers: Fiber[]): FiberBundle[] {
	const bundles = new Map<number, FiberBundle>();
	for (const fiber of fibers) {
		const bundleNumber = fiber.bundle_number ?? 0;
		let bundle = bundles.get(bundleNumber);
		if (!bundle) {
			bundle = { bundleNumber, bundleColor: fiber.bundle_color, fibers: [] };
			bundles.set(bundleNumber, bundle);
		}
		bundle.fibers.push(fiber);
	}
	return [...bundles.values()].sort((a, b) => a.bundleNumber - b.bundleNumber);
}
