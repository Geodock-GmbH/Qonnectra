import type { FaultSimulationResult } from '$lib/remote/fault-simulation/simulation-data';
import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import DamageReportFixture from './DamageReport.fixture.svelte';
import { FaultSimulationState } from './FaultSimulationState.svelte';
import { downloadFaultSimulationCsv } from './exportCsv';

vi.mock('./exportCsv', () => ({
	downloadFaultSimulationCsv: vi.fn()
}));

const result: FaultSimulationResult = {
	trench: { id_trench: 'T-001', construction_type: 'Offene Bauweise' },
	conduits: [{ uuid: 'c-1', name: 'DA 50', conduit_type: 'Rohrverband' }],
	cables: [
		{
			uuid: 'k-1',
			name: 'Kabel 1',
			cable_type: 'A-DQ(ZN)2Y',
			fiber_count: 96,
			dark_fibers: 12,
			node_start: { name: 'PoP-1' },
			node_end: { name: 'NVt-7' }
		}
	],
	affected_addresses_details: [
		{
			uuid: 'a-1',
			id_address: 'A-001',
			street: 'Hauptstraße',
			housenumber: '12',
			zip_code: '24937',
			city: 'Flensburg',
			residential_units: [
				{
					uuid: 'ru-1',
					id_residential_unit: 'RU-001',
					floor: '1',
					side: 'links',
					type: 'Wohnung',
					status: 'aktiv'
				}
			]
		}
	],
	summary: { total_cables_affected: 1, affected_addresses: 1, affected_residential_units: 1 }
};

function renderReport(simulationResult: FaultSimulationResult = result) {
	const simulation = new FaultSimulationState();
	simulation.selectDamagePoint([100, 200], [10, 20], simulationResult.trench);
	simulation.showResult(simulationResult);
	render(DamageReportFixture, { props: { simulation, projectId: '7' } });
	return simulation;
}

describe('DamageReport', () => {
	test('should render nothing without a simulation result', () => {
		render(DamageReportFixture, {
			props: { simulation: new FaultSimulationState(), projectId: '7' }
		});

		expect(screen.queryByRole('button')).not.toBeInTheDocument();
	});

	test('should name the damaged trench', () => {
		renderReport();

		expect(screen.getByText('T-001')).toBeInTheDocument();
		expect(screen.getByText('(Offene Bauweise)')).toBeInTheDocument();
	});

	test('should link affected addresses and their units into the address route', () => {
		renderReport();

		const table = screen.getByRole('table');
		expect(within(table).getByRole('link', { name: 'A-001' })).toHaveAttribute(
			'href',
			'/address/7/a-1'
		);
		expect(within(table).getByRole('link', { name: 'RU-001' })).toHaveAttribute(
			'href',
			'/address/7/a-1/unit/ru-1'
		);
		expect(within(table).getByText('Hauptstraße 12')).toBeInTheDocument();
		expect(within(table).getByText('24937 Flensburg')).toBeInTheDocument();
	});

	test('should reveal the affected cables when their section is expanded', async () => {
		renderReport();
		expect(screen.queryByText('Kabel 1')).not.toBeInTheDocument();

		await userEvent.click(screen.getByRole('button', { name: /cables|kabel/i }));

		expect(await screen.findByText('Kabel 1')).toBeInTheDocument();
	});

	test('should export the shown result as CSV', async () => {
		renderReport();

		const [exportButton] = screen.getAllByRole('button', { name: /csv/i });
		await userEvent.click(exportButton);

		expect(downloadFaultSimulationCsv).toHaveBeenCalledWith(result, 'T-001');
	});

	test('should reset the simulation', async () => {
		const simulation = renderReport();

		const [resetButton] = screen.getAllByRole('button', { name: /reset|zurück/i });
		await userEvent.click(resetButton);

		expect(simulation.simulationResult).toBeNull();
		expect(simulation.damagePoint).toBeNull();
	});
});
