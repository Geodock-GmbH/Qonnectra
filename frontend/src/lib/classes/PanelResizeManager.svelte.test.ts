import { afterEach, describe, expect, test, vi } from 'vitest';

import { PanelResizeManager } from './PanelResizeManager.svelte';

function pointerEvent(overrides: Partial<PointerEvent> = {}): PointerEvent {
	return {
		pointerType: 'mouse',
		button: 0,
		pointerId: 1,
		clientX: 500,
		preventDefault: vi.fn(),
		...overrides
	} as unknown as PointerEvent;
}

afterEach(() => {
	document.body.style.cursor = '';
	document.body.style.userSelect = '';
});

describe('PanelResizeManager', () => {
	test('should start with the default width', () => {
		const manager = new PanelResizeManager({ defaultWidth: 300, side: 'left' });

		expect(manager.width).toBe(300);
		expect(manager.isResizing).toBe(false);
		expect(manager.minWidth).toBe(200);
	});

	test('should ignore non-primary mouse buttons on start', () => {
		const manager = new PanelResizeManager({ defaultWidth: 300, side: 'left' });

		manager.start(pointerEvent({ button: 2 }));

		expect(manager.isResizing).toBe(false);
	});

	test('should begin resizing and lock document styles on start', () => {
		const manager = new PanelResizeManager({ defaultWidth: 300, side: 'left' });

		manager.start(pointerEvent());

		expect(manager.isResizing).toBe(true);
		expect(document.body.style.cursor).toBe('col-resize');
		expect(document.body.style.userSelect).toBe('none');
	});

	test('should grow a left panel when dragging right', () => {
		const onResize = vi.fn();
		const manager = new PanelResizeManager({ defaultWidth: 300, side: 'left', onResize });

		manager.start(pointerEvent({ clientX: 500 }));
		manager.move(pointerEvent({ clientX: 550 }));

		expect(manager.width).toBe(350);
		expect(onResize).toHaveBeenCalledWith(350);
	});

	test('should grow a right panel when dragging left', () => {
		const manager = new PanelResizeManager({ defaultWidth: 300, side: 'right' });

		manager.start(pointerEvent({ clientX: 500 }));
		manager.move(pointerEvent({ clientX: 450 }));

		expect(manager.width).toBe(350);
	});

	test('should clamp the width between minWidth and the viewport ratio', () => {
		const manager = new PanelResizeManager({
			defaultWidth: 300,
			minWidth: 250,
			maxWidthRatio: 0.5,
			side: 'left'
		});
		const maxWidth = Math.floor(window.innerWidth * 0.5);

		manager.start(pointerEvent({ clientX: 500 }));
		manager.move(pointerEvent({ clientX: 0 }));
		expect(manager.width).toBe(250);

		manager.move(pointerEvent({ clientX: 5000 }));
		expect(manager.width).toBe(maxWidth);
	});

	test('should ignore moves from other pointers', () => {
		const manager = new PanelResizeManager({ defaultWidth: 300, side: 'left' });

		manager.start(pointerEvent({ pointerId: 1, clientX: 500 }));
		manager.move(pointerEvent({ pointerId: 2, clientX: 900 }));

		expect(manager.width).toBe(300);
	});

	test('should ignore moves when not resizing', () => {
		const manager = new PanelResizeManager({ defaultWidth: 300, side: 'left' });

		manager.move(pointerEvent({ clientX: 900 }));

		expect(manager.width).toBe(300);
	});

	test('should stop resizing and restore document styles on end', () => {
		const manager = new PanelResizeManager({ defaultWidth: 300, side: 'left' });

		manager.start(pointerEvent());
		manager.end(pointerEvent());

		expect(manager.isResizing).toBe(false);
		expect(document.body.style.cursor).toBe('');
		expect(document.body.style.userSelect).toBe('');

		manager.move(pointerEvent({ clientX: 900 }));
		expect(manager.width).toBe(300);
	});

	test('should register and remove document listeners via listen', () => {
		const addSpy = vi.spyOn(document, 'addEventListener');
		const removeSpy = vi.spyOn(document, 'removeEventListener');
		const manager = new PanelResizeManager({ defaultWidth: 300, side: 'left' });

		const cleanup = manager.listen();
		expect(addSpy).toHaveBeenCalledWith('pointermove', manager.move);
		expect(addSpy).toHaveBeenCalledWith('pointerup', manager.end);
		expect(addSpy).toHaveBeenCalledWith('pointercancel', manager.end);

		cleanup();
		expect(removeSpy).toHaveBeenCalledWith('pointermove', manager.move);
		expect(removeSpy).toHaveBeenCalledWith('pointerup', manager.end);
		expect(removeSpy).toHaveBeenCalledWith('pointercancel', manager.end);

		addSpy.mockRestore();
		removeSpy.mockRestore();
	});
});
