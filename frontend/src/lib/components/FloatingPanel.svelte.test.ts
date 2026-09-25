import { createRawSnippet } from 'svelte';
import { get } from 'svelte/store';
import { render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { floatingPanelRects } from '$lib/stores/store';

import FloatingPanel from './FloatingPanel.svelte';

const children = createRawSnippet(() => ({
	render: () => '<p>Panel-Inhalt</p>'
}));

/** The positioner carries the panel's rect as CSS variables. */
function positionerStyle() {
	const positioner = document.querySelector<HTMLElement>('[data-part="positioner"]');
	if (!positioner) throw new Error('positioner not rendered');
	return {
		x: positioner.style.getPropertyValue('--x'),
		y: positioner.style.getPropertyValue('--y'),
		width: positioner.style.getPropertyValue('--width'),
		height: positioner.style.getPropertyValue('--height')
	};
}

/**
 * Dispatches a pointer event carrying coordinates and lets the panel react;
 * jsdom has no PointerEvent, so a MouseEvent of the pointer type stands in.
 */
async function pointer(target: EventTarget, type: string, clientX: number, clientY: number) {
	target.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX, clientY }));
	await new Promise((resolve) => setTimeout(resolve));
}

/**
 * Clicks the stage trigger that switches the panel into the given stage.
 * @param stage - The stage to switch into.
 */
function clickStageTrigger(stage: 'minimized' | 'maximized') {
	const trigger = document.querySelector<HTMLElement>(
		`[data-part="stage-trigger"][data-stage="${stage}"]`
	);
	if (!trigger) throw new Error(`${stage} trigger not rendered`);
	trigger.click();
}

/** The stage the panel is in, as its control reports it. */
function currentStage() {
	return document.querySelector('[data-part="control"]')?.getAttribute('data-stage');
}

describe('FloatingPanel remembered rect', () => {
	afterEach(() => floatingPanelRects.set({}));

	test('should open at the rect remembered under its storage key', async () => {
		floatingPanelRects.set({ structure: { x: 40, y: 30, width: 700, height: 500 } });

		render(FloatingPanel, { open: true, title: 'Struktur', storageKey: 'structure', children });
		await screen.findByText('Struktur');

		await waitFor(() =>
			expect(positionerStyle()).toEqual({ x: '40px', y: '30px', width: '700px', height: '500px' })
		);
	});

	test('should keep a remembered rect inside a smaller window', async () => {
		floatingPanelRects.set({ structure: { x: 1800, y: 900, width: 700, height: 500 } });

		render(FloatingPanel, { open: true, title: 'Struktur', storageKey: 'structure', children });
		await screen.findByText('Struktur');

		await waitFor(() =>
			expect(positionerStyle()).toEqual({
				x: `${window.innerWidth - 700}px`,
				y: `${window.innerHeight - 500}px`,
				width: '700px',
				height: '500px'
			})
		);
	});

	test('should remember the rect under its storage key once a resize ends', async () => {
		render(FloatingPanel, {
			open: true,
			title: 'Struktur',
			storageKey: 'structure',
			width: 400,
			height: 300,
			children
		});
		await screen.findByText('Struktur');

		const trigger = document.querySelector<HTMLElement>('[data-part="resize-trigger"]');
		if (!trigger) throw new Error('resize trigger not rendered');
		// jsdom lacks pointer capture, which the resize start requests.
		trigger.setPointerCapture = () => {};
		await pointer(trigger, 'pointerdown', 500, 500);
		await pointer(document, 'pointermove', 560, 540);
		await pointer(document, 'pointerup', 560, 540);

		await waitFor(() =>
			expect(get(floatingPanelRects).structure).toMatchObject({ width: 460, height: 340 })
		);
	});

	test('should reopen at the remembered rect after closing it maximized', async () => {
		floatingPanelRects.set({ structure: { x: 40, y: 30, width: 700, height: 500 } });
		const { rerender } = render(FloatingPanel, {
			open: true,
			title: 'Struktur',
			storageKey: 'structure',
			children
		});
		await screen.findByText('Struktur');

		clickStageTrigger('maximized');
		await waitFor(() => expect(positionerStyle().x).toBe('0px'));

		document.querySelector<HTMLElement>('[data-part="close-trigger"]')?.click();
		await rerender({ open: true });

		await waitFor(() =>
			expect(positionerStyle()).toEqual({ x: '40px', y: '30px', width: '700px', height: '500px' })
		);
		expect(currentStage()).toBe('default');
	});

	test('should not remember the header-only size of a panel dragged while minimized', async () => {
		floatingPanelRects.set({ structure: { x: 40, y: 30, width: 700, height: 500 } });
		render(FloatingPanel, { open: true, title: 'Struktur', storageKey: 'structure', children });
		await screen.findByText('Struktur');

		clickStageTrigger('minimized');
		await waitFor(() => expect(currentStage()).toBe('minimized'));
		const dragTrigger = document.querySelector<HTMLElement>('[data-part="drag-trigger"]');
		if (!dragTrigger) throw new Error('drag trigger not rendered');
		dragTrigger.setPointerCapture = () => {};
		await pointer(dragTrigger, 'pointerdown', 100, 100);
		await pointer(document, 'pointermove', 150, 120);
		await pointer(document, 'pointerup', 150, 120);

		expect(get(floatingPanelRects).structure).toEqual({ x: 40, y: 30, width: 700, height: 500 });
	});

	test('should not touch storage without a storage key', async () => {
		render(FloatingPanel, { open: true, title: 'Grabenprofil', children });
		await screen.findByText('Grabenprofil');

		expect(get(floatingPanelRects)).toEqual({});
	});
});

describe('FloatingPanel', () => {
	test('should render title and content when open', async () => {
		render(FloatingPanel, { open: true, title: 'Grabenprofil', children });

		expect(await screen.findByText('Grabenprofil')).toBeInTheDocument();
		expect(screen.getByText('Panel-Inhalt')).toBeInTheDocument();
	});

	test('should render nothing while closed', () => {
		render(FloatingPanel, { open: false, title: 'Grabenprofil', children });

		expect(screen.queryByText('Grabenprofil')).not.toBeInTheDocument();
	});

	test('should not read its unmounted state after closing', async () => {
		const warn = vi.spyOn(console, 'warn');
		render(FloatingPanel, { open: true, title: 'Grabenprofil', children });
		await screen.findByText('Grabenprofil');

		document.querySelector<HTMLElement>('[data-part="close-trigger"]')?.click();
		await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve)));

		expect(screen.queryByText('Grabenprofil')).not.toBeInTheDocument();
		expect(warn.mock.calls.flat().join('\n')).not.toContain('derived_inert');
		warn.mockRestore();
	});

	test('should render a resize trigger only when resizable', async () => {
		const { container: resizableContainer } = render(FloatingPanel, {
			open: true,
			title: 'A',
			resizable: true,
			children
		});
		await screen.findAllByText('A');
		expect(document.querySelector('[data-part="resize-trigger"]')).not.toBeNull();
		resizableContainer.remove();
	});
});
