import { render, screen } from '@testing-library/svelte';
import { describe, expect, test } from 'vitest';

import { m } from '$lib/paraglide/messages';

import NoAccessPage from './+page.svelte';

describe('no-access +page.svelte', () => {
	test('should tell the user to contact their administrator', () => {
		render(NoAccessPage);

		expect(screen.getByRole('heading', { name: m.message_no_access_title() })).toBeInTheDocument();
		expect(screen.getByText(m.message_no_access_description())).toBeInTheDocument();
	});
});
