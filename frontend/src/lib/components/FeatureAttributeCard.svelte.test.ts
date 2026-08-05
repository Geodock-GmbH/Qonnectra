import { render, screen } from '@testing-library/svelte';
import { describe, expect, test, vi } from 'vitest';

import FeatureAttributeCard from './FeatureAttributeCard.svelte';

vi.mock('$lib/paraglide/messages', () => ({
	m: {
		common_yes: () => 'Ja',
		common_no: () => 'Nein',
		form_no_attributes_available: () => 'Keine Attribute verfügbar'
	}
}));

describe('FeatureAttributeCard', () => {
	test('should show a placeholder without properties', () => {
		render(FeatureAttributeCard, { properties: {} });

		expect(screen.getByText('Keine Attribute verfügbar')).toBeInTheDocument();
	});

	test('should render readonly inputs for every non-empty property', () => {
		render(FeatureAttributeCard, {
			properties: { name: 'PoP-1', status: null, length: 42 }
		});

		expect(screen.getByLabelText('Name')).toHaveValue('PoP-1');
		expect(screen.getByLabelText('Length')).toHaveValue('42');
		expect(screen.queryByLabelText('Status')).not.toBeInTheDocument();
	});

	test('should prefer alias labels over generated ones', () => {
		render(FeatureAttributeCard, {
			properties: { id_trench: 'T-1' },
			alias: { id_trench: 'Graben-ID' }
		});

		expect(screen.getByLabelText('Graben-ID')).toHaveValue('T-1');
	});

	test('should localize boolean values', () => {
		render(FeatureAttributeCard, {
			properties: { house_connection: true, internal_execution: false }
		});

		expect(screen.getByLabelText('House Connection')).toHaveValue('Ja');
		expect(screen.getByLabelText('Internal Execution')).toHaveValue('Nein');
	});

	test('should resolve project ids to project names', () => {
		render(FeatureAttributeCard, {
			properties: { project: 7 },
			projects: [{ label: 'Ausbau Nord', value: '7' }]
		});

		expect(screen.getByLabelText('Project')).toHaveValue('Ausbau Nord');
	});

	test('should sort properties alphabetically by display label', () => {
		render(FeatureAttributeCard, {
			properties: { zip_code: '24211', city: 'Preetz' }
		});

		const labels = screen.getAllByText(/City|Zip Code/).map((el) => el.textContent);
		expect(labels).toEqual(['City', 'Zip Code']);
	});
});
