// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { autoLockSvelteFlow, isSvelteFlowLocked, toggleSvelteFlowLock } from './svelteFlowLock';

function addLockButton(): HTMLButtonElement {
	const button = document.createElement('button');
	button.className = 'svelte-flow__controls-button svelte-flow__controls-interactive';
	button.title = 'Toggle Interactivity';
	document.body.appendChild(button);
	return button;
}

beforeEach(() => {
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
	document.body.innerHTML = '';
	vi.restoreAllMocks();
	vi.useRealTimers();
});

describe('autoLockSvelteFlow', () => {
	test('should click the lock button when it is already present', async () => {
		const button = addLockButton();
		const clickSpy = vi.spyOn(button, 'click');

		await expect(autoLockSvelteFlow()).resolves.toBe(true);
		expect(clickSpy).toHaveBeenCalledTimes(1);
	});

	test('should keep polling until the button appears', async () => {
		vi.useFakeTimers();

		const promise = autoLockSvelteFlow(10, 100);
		await vi.advanceTimersByTimeAsync(250);

		const button = addLockButton();
		const clickSpy = vi.spyOn(button, 'click');
		await vi.advanceTimersByTimeAsync(100);

		await expect(promise).resolves.toBe(true);
		expect(clickSpy).toHaveBeenCalledTimes(1);
	});

	test('should give up after the maximum number of attempts', async () => {
		vi.useFakeTimers();

		const promise = autoLockSvelteFlow(3, 100);
		await vi.advanceTimersByTimeAsync(400);

		await expect(promise).resolves.toBe(false);
	});
});

describe('isSvelteFlowLocked', () => {
	test('should return false when no lock button exists', () => {
		expect(isSvelteFlowLocked()).toBe(false);
	});

	test('should return false for an unlocked canvas', () => {
		addLockButton();
		expect(isSvelteFlowLocked()).toBe(false);
	});

	test('should detect the locked state via the active class', () => {
		addLockButton().classList.add('active');
		expect(isSvelteFlowLocked()).toBe(true);
	});

	test('should detect the locked state via aria-pressed', () => {
		addLockButton().setAttribute('aria-pressed', 'true');
		expect(isSvelteFlowLocked()).toBe(true);
	});
});

describe('toggleSvelteFlowLock', () => {
	test('should click the lock button and return true', () => {
		const button = addLockButton();
		const clickSpy = vi.spyOn(button, 'click');

		expect(toggleSvelteFlowLock()).toBe(true);
		expect(clickSpy).toHaveBeenCalledTimes(1);
	});

	test('should return false when no lock button exists', () => {
		expect(toggleSvelteFlowLock()).toBe(false);
	});
});
