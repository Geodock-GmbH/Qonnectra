// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { tooltip } from './tooltip';

function mount(): HTMLButtonElement {
	const button = document.createElement('button');
	document.body.appendChild(button);
	return button;
}

function getTooltip(): HTMLElement | null {
	return document.querySelector('[role="tooltip"]');
}

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	document.body.innerHTML = '';
	vi.useRealTimers();
});

describe('tooltip attachment', () => {
	test('should show the tooltip after the delay on mouseenter', () => {
		const button = mount();
		tooltip('Hello')(button);

		button.dispatchEvent(new MouseEvent('mouseenter'));
		expect(getTooltip()).toBeNull();

		vi.advanceTimersByTime(200);

		const el = getTooltip();
		expect(el).not.toBeNull();
		expect(el?.textContent).toBe('Hello');
	});

	test('should respect a custom delay', () => {
		const button = mount();
		tooltip('Slow', { delay: 500 })(button);

		button.dispatchEvent(new MouseEvent('mouseenter'));
		vi.advanceTimersByTime(300);
		expect(getTooltip()).toBeNull();

		vi.advanceTimersByTime(200);
		expect(getTooltip()).not.toBeNull();
	});

	test('should apply the position class', () => {
		const button = mount();
		tooltip('Below', { position: 'bottom' })(button);

		button.dispatchEvent(new MouseEvent('mouseenter'));
		vi.advanceTimersByTime(200);

		expect(getTooltip()?.classList.contains('tooltip-bottom')).toBe(true);
	});

	test('should remove the tooltip on mouseleave', () => {
		const button = mount();
		tooltip('Hello')(button);

		button.dispatchEvent(new MouseEvent('mouseenter'));
		vi.advanceTimersByTime(200);
		expect(getTooltip()).not.toBeNull();

		button.dispatchEvent(new MouseEvent('mouseleave'));
		expect(getTooltip()).toBeNull();
	});

	test('should cancel a pending tooltip when leaving before the delay', () => {
		const button = mount();
		tooltip('Hello')(button);

		button.dispatchEvent(new MouseEvent('mouseenter'));
		button.dispatchEvent(new MouseEvent('mouseleave'));
		vi.advanceTimersByTime(500);

		expect(getTooltip()).toBeNull();
	});

	test('should do nothing when disabled', () => {
		const button = mount();
		tooltip('Hidden', { disabled: true })(button);

		button.dispatchEvent(new MouseEvent('mouseenter'));
		vi.advanceTimersByTime(500);

		expect(getTooltip()).toBeNull();
	});

	test('should clean up listeners and tooltip on detach', () => {
		const button = mount();
		const detach = tooltip('Hello')(button);

		button.dispatchEvent(new MouseEvent('mouseenter'));
		vi.advanceTimersByTime(200);
		expect(getTooltip()).not.toBeNull();

		detach();
		expect(getTooltip()).toBeNull();

		button.dispatchEvent(new MouseEvent('mouseenter'));
		vi.advanceTimersByTime(500);
		expect(getTooltip()).toBeNull();
	});
});
