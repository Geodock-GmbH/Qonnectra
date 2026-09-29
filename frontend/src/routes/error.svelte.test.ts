import { render, screen } from '@testing-library/svelte';
import { describe, expect, test, vi } from 'vitest';

import ErrorPage from './+error.svelte';

vi.mock('$app/state', () => ({
	page: { status: 404, error: { message: 'Not Found' } }
}));

describe('+error.svelte', () => {
	test('should show the status and the error message', () => {
		render(ErrorPage);

		expect(screen.getByText('404')).toBeInTheDocument();
		expect(screen.getByText('Not Found')).toBeInTheDocument();
	});

	test('should send the user home through the landing redirect, not to the login page', () => {
		render(ErrorPage);

		expect(screen.getByRole('link')).toHaveAttribute('href', '/');
	});
});
