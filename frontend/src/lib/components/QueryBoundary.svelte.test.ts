import { error } from '@sveltejs/kit';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import QueryBoundaryFixture from './QueryBoundary.fixture.svelte';

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => () => `${prop}`
		}
	)
}));

/**
 * Builds a Kit HttpError the way a remote function's `error()` call does.
 */
function httpError(status: number, message: string): unknown {
	try {
		error(status, message);
	} catch (e) {
		return e;
	}
	return null;
}

describe('QueryBoundary', () => {
	test('should show the placeholder until the awaited content resolves', async () => {
		let resolve: (value: string) => void = () => {};
		const load = vi.fn(() => new Promise<string>((r) => (resolve = r)));
		render(QueryBoundaryFixture, { props: { load } });

		expect(screen.getByRole('status')).toHaveTextContent('common_loading');
		expect(screen.queryByTestId('content')).not.toBeInTheDocument();

		resolve('hello');

		expect(await screen.findByTestId('content')).toHaveTextContent('hello');
		expect(screen.queryByRole('status')).not.toBeInTheDocument();
	});

	test('should render the backend message of a failed remote call', async () => {
		const load = vi.fn(() => Promise.reject(httpError(403, 'Not allowed')));
		render(QueryBoundaryFixture, { props: { load } });

		expect(await screen.findByRole('alert')).toHaveTextContent('Not allowed');
	});

	test('should fall back to a generic message for errors without one', async () => {
		const load = vi.fn(() => Promise.reject('nope'));
		render(QueryBoundaryFixture, { props: { load } });

		expect(await screen.findByRole('alert')).toHaveTextContent('message_error_loading_data');
	});

	test('should retry the content when the retry button is clicked', async () => {
		const user = userEvent.setup();
		const load = vi
			.fn<() => Promise<string>>()
			.mockRejectedValueOnce(new Error('first try failed'))
			.mockResolvedValueOnce('second try');
		render(QueryBoundaryFixture, { props: { load } });

		expect(await screen.findByRole('alert')).toHaveTextContent('first try failed');

		await user.click(screen.getByRole('button', { name: 'common_retry' }));

		expect(await screen.findByTestId('content')).toHaveTextContent('second try');
		expect(load).toHaveBeenCalledTimes(2);
	});
});
