import { expect, test } from '@playwright/test';

import { loginOrSkip } from './helpers/auth.js';

/**
 * Prepares the canvas so exactly one cable edge is in edit mode with exactly one
 * vertex handle, placed at a point that is genuinely clickable (topmost element,
 * not covered by the left panel). Runs entirely in the page so it can use
 * SvelteFlow's live geometry, then returns the vertex's viewport coordinates for
 * Playwright to drive with real hardware input.
 *
 * Returns `null` when no edge could be brought into an editable, unobstructed
 * state (e.g. an empty or fully off-screen graph) so the caller can skip rather
 * than fail on a fixtureless environment.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{ edgeId: string, x: number, y: number } | null>}
 */
async function seedEditableVertex(page) {
	return page.evaluate(async () => {
		const sleep = (/** @type {number} */ ms) => new Promise((r) => setTimeout(r, ms));
		const waitFor = async (/** @type {() => boolean} */ pred, ms = 1500) => {
			const t = Date.now();
			while (Date.now() - t < ms) {
				if (pred()) return true;
				await sleep(30);
			}
			return pred();
		};

		const pane = document.querySelector('.svelte-flow');
		if (!pane) return null;

		// Frame the whole graph so edges and their labels land inside the viewport
		// at a workable zoom; the default view can be panned/zoomed far off-screen.
		const fitBtn = [...document.querySelectorAll('.svelte-flow__controls button')].find((b) =>
			(b.getAttribute('aria-label') || '').toLowerCase().includes('fit')
		);
		if (fitBtn) {
			/** @type {HTMLButtonElement} */ (fitBtn).click();
			await sleep(500);
		}
		const pr = pane.getBoundingClientRect();

		/**
		 * Screen point of an edge path at parameter t in [0,1], or null if the edge
		 * has no measurable geometry.
		 * @param {Element} edgeEl
		 * @param {number} t
		 */
		const pathPoint = (edgeEl, t) => {
			const path = edgeEl.querySelector('path[id]');
			if (!path) return null;
			let len;
			try {
				len = /** @type {SVGPathElement} */ (path).getTotalLength();
			} catch {
				return null;
			}
			if (!len) return null;
			const ctm = /** @type {SVGGraphicsElement} */ (path).getScreenCTM();
			if (!ctm) return null;
			const p = /** @type {SVGPathElement} */ (path).getPointAtLength(len * t);
			return { x: ctm.a * p.x + ctm.c * p.y + ctm.e, y: ctm.b * p.x + ctm.d * p.y + ctm.f };
		};

		const inViewport = (/** @type {{x:number,y:number}} */ pt, pad = 20) =>
			pt.x > pr.left + pad &&
			pt.x < pr.right - pad &&
			pt.y > pr.top + pad &&
			pt.y < pr.bottom - pad;

		/** @param {Element} el @param {{clientX:number,clientY:number,altKey?:boolean,shiftKey?:boolean}} o */
		const fire = (el, type, o) =>
			el.dispatchEvent(
				new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, view: window, ...o })
			);

		// The graph mounts asynchronously; wait until edges and labels exist.
		await waitFor(
			() =>
				document.querySelectorAll('.svelte-flow__edge').length > 0 &&
				document.querySelectorAll('foreignObject.nopan [role="button"]').length > 0,
			5000
		);

		// The id of whichever edge currently shows the edit-mode cursor, or null.
		const editingEdgeId = () => {
			for (const g of document.querySelectorAll('.svelte-flow__edge > g[role="button"]')) {
				if ((g.getAttribute('style') || '').includes('cursor: pointer')) {
					return g.closest('.svelte-flow__edge')?.getAttribute('data-id') ?? null;
				}
			}
			return null;
		};

		// Try each on-screen label in turn: alt-click it to edit its cable (the
		// app's fast edit-mode switch), then attempt to place a clickable vertex on
		// whichever edge actually became editable. Some editable edges sit entirely
		// behind the left panel or off-screen, so a failure on one is not fatal —
		// move on to the next label until one yields an unobstructed vertex.
		const labels = [...document.querySelectorAll('foreignObject.nopan [role="button"]')];
		for (const label of labels) {
			const lr = label.getBoundingClientRect();
			const lx = lr.left + lr.width / 2;
			const ly = lr.top + lr.height / 2;
			if (!inViewport({ x: lx, y: ly }, 40)) continue;

			const o = { clientX: lx, clientY: ly, altKey: true };
			fire(label, 'mousedown', o);
			fire(label, 'mouseup', o);
			fire(label, 'click', o);
			await sleep(150);

			const edgeId = editingEdgeId();
			if (!edgeId) continue;

			const edge = () => document.querySelector(`.svelte-flow__edge[data-id="${edgeId}"]`);
			const gEl = () => edge().querySelector('g[role="button"]');
			const circles = () => edge().querySelectorAll('circle.nopan').length;

			// Clean slate: drop any pre-existing vertices via synthetic shift-delete.
			// dispatchEvent bypasses the very suppression under test, so this is a
			// reliable teardown, not the assertion.
			let guard = 0;
			while (circles() > 0 && guard++ < 10) {
				const c = edge().querySelector('circle.nopan');
				const r = c.getBoundingClientRect();
				fire(c, 'mousedown', {
					clientX: r.left + r.width / 2,
					clientY: r.top + r.height / 2,
					shiftKey: true
				});
				await sleep(150);
			}
			await waitFor(() => circles() === 0);

			// Add one vertex at an unobstructed on-screen point (topmost element is
			// the circle itself — not the left nav/attributes panel).
			for (let t = 0.05; t <= 0.95; t += 0.02) {
				const pt = pathPoint(edge(), t);
				if (!pt || !inViewport(pt, 15)) continue;
				fire(gEl(), 'click', { clientX: pt.x, clientY: pt.y });
				if (!(await waitFor(() => circles() === 1, 600))) {
					await waitFor(() => circles() === 0, 300);
					continue;
				}
				const c = edge().querySelector('circle.nopan');
				const r = c.getBoundingClientRect();
				const x = Math.round(r.left + r.width / 2);
				const y = Math.round(r.top + r.height / 2);
				if (document.elementFromPoint(x, y) === c) {
					return { edgeId, x, y };
				}
				// Obstructed: remove and try the next parameter.
				fire(c, 'mousedown', { clientX: x, clientY: y, shiftKey: true });
				await waitFor(() => circles() === 0, 600);
			}
		}
		return null;
	});
}

/**
 * Counts the vertex handles rendered on a given edge.
 * @param {import('@playwright/test').Page} page
 * @param {string} edgeId
 * @returns {Promise<number>}
 */
async function vertexCount(page, edgeId) {
	return page.evaluate((/** @type {string} */ id) => {
		const edge = document.querySelector(`.svelte-flow__edge[data-id="${id}"]`);
		return edge ? edge.querySelectorAll('circle.nopan').length : 0;
	}, edgeId);
}

test.describe('Network schema cable vertex handles', () => {
	test.beforeEach(async ({ page }) => {
		await loginOrSkip(page, test.skip);
		await page.goto('/network-schema');
		await page.waitForLoadState('networkidle');
		await expect(page.locator('.svelte-flow').first()).toBeVisible({ timeout: 15000 });
	});

	test('Shift+click deletes a cable vertex with real pointer input', async ({ page }) => {
		const vertex = await seedEditableVertex(page);
		test.skip(vertex === null, 'No editable, unobstructed cable vertex available in this dataset');
		const { edgeId, x, y } = /** @type {{edgeId:string,x:number,y:number}} */ (vertex);

		await expect.poll(() => vertexCount(page, edgeId)).toBe(1);

		// The regression this guards: with the canvas selectable in edit mode,
		// holding Shift arms SvelteFlow's box-selection, whose Pane pointerdown
		// capture preventDefaults the pointerdown and thereby suppresses the compat
		// `mousedown` that the vertex delete is wired to. Only REAL hardware input
		// reproduces that chain — `fireEvent`/`dispatchEvent` deliver mousedown
		// unconditionally and would pass even while the feature is broken. The fix
		// is the `nokey` class on the vertex, which opts it out of that capture.
		await page.keyboard.down('Shift');
		await page.mouse.move(x, y);
		await page.mouse.down();
		await page.mouse.up();
		await page.keyboard.up('Shift');

		await expect
			.poll(() => vertexCount(page, edgeId), {
				message:
					'Shift+click did not delete the vertex — SvelteFlow selection likely swallowed its mousedown'
			})
			.toBe(0);
	});
});
