import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { globalToaster } from '$lib/stores/toaster';

import LoginPage from './+page.svelte';

type EnhanceCallback = (form: {
	submit: () => Promise<boolean>;
	element: HTMLFormElement;
}) => Promise<void>;

// Captures the enhance callback so the submit → toast wiring can be driven directly.
const loginStub = vi.hoisted(() => {
	const state: { enhanceCallback: EnhanceCallback | null; pending: number } = {
		enhanceCallback: null,
		pending: 0
	};
	const field = (name: string) => ({
		as: (type: string, value?: string) => ({ name, type, value }),
		issues: () => undefined
	});
	const attributes = { method: 'POST', action: '/_app/remote/stub/login' };
	return {
		state,
		login: {
			...attributes,
			get pending() {
				return state.pending;
			},
			fields: {
				username: field('username'),
				_password: field('_password'),
				redirectTo: field('redirectTo'),
				allIssues: () => undefined
			},
			enhance: (callback: EnhanceCallback) => {
				state.enhanceCallback = callback;
				return attributes;
			}
		}
	};
});

vi.mock('$lib/remote/auth/login.remote', () => ({ login: loginStub.login }));

vi.mock('$lib/stores/toaster', () => ({
	globalToaster: { create: vi.fn() }
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => () => `${prop}`
		}
	)
}));

function submitThrough(submit: () => Promise<boolean>) {
	const element = document.querySelector('form') as HTMLFormElement;
	return loginStub.state.enhanceCallback?.({ submit, element });
}

beforeEach(() => {
	vi.mocked(globalToaster.create).mockClear();
	loginStub.state.enhanceCallback = null;
	loginStub.state.pending = 0;
});

describe('login page', () => {
	test('renders the remote form with its fields', () => {
		render(LoginPage);

		const form = document.querySelector('form') as HTMLFormElement;
		expect(form).toHaveAttribute('action', '/_app/remote/stub/login');
		expect(screen.getByLabelText('auth_username')).toHaveAttribute('name', 'username');
		expect(screen.getByLabelText('auth_password')).toHaveAttribute('name', '_password');
		expect(form.querySelector('input[name="redirectTo"]')).toHaveValue('/dashboard');
	});

	test('toggles password visibility without swapping the field', async () => {
		const user = userEvent.setup();
		render(LoginPage);

		const password = screen.getByLabelText('auth_password');
		expect(password).toHaveAttribute('type', 'password');

		await user.click(screen.getByRole('button', { name: '' }));

		expect(screen.getByLabelText('auth_password')).toBe(password);
		expect(password).toHaveAttribute('type', 'text');
	});

	test('toasts when the credentials are rejected', async () => {
		render(LoginPage);

		await submitThrough(vi.fn().mockResolvedValue(false));

		expect(globalToaster.create).toHaveBeenCalledWith({
			title: 'title_login_error',
			description: 'message_login_error',
			type: 'error'
		});
	});

	test('toasts when the submission fails', async () => {
		render(LoginPage);

		await submitThrough(vi.fn().mockRejectedValue(new Error('Internal Error')));

		expect(globalToaster.create).toHaveBeenCalledOnce();
	});

	test('stays silent on success', async () => {
		render(LoginPage);

		await submitThrough(vi.fn().mockResolvedValue(true));

		expect(globalToaster.create).not.toHaveBeenCalled();
	});

	test('disables the submit button while a submission is pending', () => {
		loginStub.state.pending = 1;
		render(LoginPage);

		expect(screen.getByRole('button', { name: 'auth_login' })).toBeDisabled();
	});
});
