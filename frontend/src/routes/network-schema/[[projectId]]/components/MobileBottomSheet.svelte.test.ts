import { createRawSnippet } from 'svelte';
import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, test, vi } from 'vitest';

import MobileBottomSheet from './MobileBottomSheet.svelte';

// jsdom lacks Element.animate, which svelte transitions (fly/fade outro) invoke.
// The stub completes immediately so outro transitions finish and nodes unmount.
beforeAll(() => {
	Element.prototype.animate = function () {
		const anim = {
			cancel: () => {},
			finish: () => {},
			play: () => {},
			pause: () => {},
			set onfinish(cb: (() => void) | null) {
				if (cb) queueMicrotask(cb);
			},
			get onfinish() {
				return null;
			}
		};
		return anim as unknown as Animation;
	};
});

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => () => `${prop}`
		}
	)
}));

const children = createRawSnippet(() => ({
	render: () => '<p>Sheet-Inhalt</p>'
}));

function touchEvent(type: string, clientY: number) {
	const event = new Event(type, { bubbles: true });
	Object.defineProperty(event, 'touches', {
		value: [{ clientY }]
	});
	return event;
}

function dragHandle(handle: Element, fromY: number, toY: number) {
	handle.dispatchEvent(touchEvent('touchstart', fromY));
	handle.dispatchEvent(touchEvent('touchmove', toY));
	handle.dispatchEvent(touchEvent('touchend', toY));
}

describe('MobileBottomSheet', () => {
	test('should render nothing while closed', () => {
		render(MobileBottomSheet, { open: false, title: 'Details', children });

		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(screen.queryByText('Sheet-Inhalt')).not.toBeInTheDocument();
	});

	test('should render title and children content when open', () => {
		render(MobileBottomSheet, { open: true, title: 'Details', children });

		expect(screen.getByRole('dialog')).toBeInTheDocument();
		expect(screen.getByText('Details')).toBeInTheDocument();
		expect(screen.getByText('Sheet-Inhalt')).toBeInTheDocument();
	});

	test('should open at 50vh height by default', () => {
		render(MobileBottomSheet, { open: true, title: 'Details', children });

		const dialog = screen.getByRole('dialog');
		expect(dialog.getAttribute('style')).toContain('height: 50vh');
	});

	test('should close and unmount the sheet when the close button is clicked', async () => {
		const user = userEvent.setup();
		render(MobileBottomSheet, { open: true, title: 'Details', children });

		await user.click(screen.getByRole('button', { name: 'tooltip_close' }));

		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
	});

	test('should close the sheet when the backdrop is clicked', async () => {
		const user = userEvent.setup();
		render(MobileBottomSheet, { open: true, title: 'Details', children });

		const backdrop = screen.getByRole('button', { name: '' });
		await user.click(backdrop);

		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
	});

	test('should expose the drag handle slider with the resize label', () => {
		render(MobileBottomSheet, { open: true, title: 'Details', children });

		const slider = screen.getByRole('slider', { name: 'tooltip_drag_to_resize' });
		expect(slider).toHaveAttribute('aria-valuenow', '50');
	});

	test('should expand to 90vh when the handle is dragged up beyond the threshold', async () => {
		render(MobileBottomSheet, { open: true, title: 'Details', children });

		const slider = screen.getByRole('slider', { name: 'tooltip_drag_to_resize' });
		const viewportHeight = window.innerHeight;
		// Drag up by ~50% of the viewport (past the -20% expand threshold).
		dragHandle(slider, viewportHeight, viewportHeight * 0.5);

		await waitFor(() =>
			expect(screen.getByRole('slider', { name: 'tooltip_drag_to_resize' })).toHaveAttribute(
				'aria-valuenow',
				'90'
			)
		);
	});

	test('should dismiss the sheet when the handle is dragged down beyond the threshold', async () => {
		render(MobileBottomSheet, { open: true, title: 'Details', children });

		const slider = screen.getByRole('slider', { name: 'tooltip_drag_to_resize' });
		const viewportHeight = window.innerHeight;
		// Drag down by ~50% of the viewport (past the +30% dismiss threshold).
		dragHandle(slider, viewportHeight * 0.2, viewportHeight * 0.7);

		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
	});

	test('should keep the sheet open at 50vh for a small drag below the thresholds', () => {
		render(MobileBottomSheet, { open: true, title: 'Details', children });

		const slider = screen.getByRole('slider', { name: 'tooltip_drag_to_resize' });
		const viewportHeight = window.innerHeight;
		// Drag down by ~5% only — under both the expand and dismiss thresholds.
		dragHandle(slider, viewportHeight * 0.2, viewportHeight * 0.25);

		expect(screen.getByRole('dialog')).toBeInTheDocument();
		expect(screen.getByRole('slider', { name: 'tooltip_drag_to_resize' })).toHaveAttribute(
			'aria-valuenow',
			'50'
		);
	});
});
