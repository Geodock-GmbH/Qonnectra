import type { InquiryArea } from '$lib/remote/pipeline-records/inquiry-area-data';
import type OlFeature from 'ol/Feature';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import Feature from 'ol/Feature.js';
import Polygon from 'ol/geom/Polygon.js';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { globalToaster } from '$lib/stores/toaster';
import BoundaryFixture from '$lib/test-utils/Boundary.fixture.svelte';
import { httpError } from '$lib/test-utils/remote-stubs';

import InquiryWorkspace from './InquiryWorkspace.svelte';

type FeatureHandler = (feature: OlFeature) => Promise<void>;

const draw = vi.hoisted(() => ({
	renderPolygons: vi.fn(),
	updatePolygonGeometryCache: vi.fn(),
	refreshHighlights: vi.fn(),
	startDrawing: vi.fn(),
	startEditing: vi.fn(),
	cleanup: vi.fn()
}));

vi.mock('$lib/classes/InquiryDrawManager.svelte', () => ({
	InquiryDrawManager: class {
		olMap = {
			getView: () => ({ getProjection: () => 'EPSG:3857' }),
			on: vi.fn(),
			un: vi.fn()
		};
		isDrawing = false;
		isEditing = false;
		initialize = vi.fn();
		initializeHighlightLayers = vi.fn();
		stopDrawing = vi.fn();
		stopEditing = vi.fn();
		renderPolygons = draw.renderPolygons;
		updatePolygonGeometryCache = draw.updatePolygonGeometryCache;
		refreshHighlights = draw.refreshHighlights;
		startDrawing = draw.startDrawing;
		startEditing = draw.startEditing;
		cleanup = draw.cleanup;
	}
}));

vi.mock('$lib/classes/MapState.svelte', () => ({
	MapState: class {
		initializeLayers = () => true;
		getLayers = () => [];
		cleanup = vi.fn();
	}
}));

vi.mock('$lib/map/layerStyleSync', () => ({
	syncLayerStyles: () => () => undefined
}));

vi.mock('$lib/components/Map.svelte', async () => {
	const { default: MockMap } = await import('$lib/test-utils/mocks/MockMap.svelte');
	return { default: MockMap };
});

vi.mock('ol/ol.css', () => ({}));

vi.mock('$app/state', () => ({
	page: { data: { srid: 25832, proj4Def: '+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs' } }
}));

vi.mock('$lib/stores/store', async () => {
	const { writable } = await import('svelte/store');
	return { selectedProject: writable('1'), trenchColorSelected: writable('#ff0000') };
});

const getInquiryAreas = vi.fn();
const createInquiryArea = vi.fn();
const updateInquiryAreaGeometry = vi.fn();
const getPipelineRecord = vi.fn();

vi.mock('$lib/remote/pipeline-records/inquiry-areas.remote', () => ({
	getInquiryAreas: (...args: unknown[]) => getInquiryAreas(...args),
	createInquiryArea: (...args: unknown[]) => createInquiryArea(...args),
	updateInquiryAreaGeometry: (...args: unknown[]) => updateInquiryAreaGeometry(...args),
	renameInquiryArea: vi.fn(),
	deleteInquiryArea: vi.fn()
}));

vi.mock('$lib/remote/pipeline-records/records.remote', () => ({
	getPipelineRecord: (...args: unknown[]) => getPipelineRecord(...args)
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy({}, { get: (_target, prop: string) => () => `${prop}` })
}));

vi.mock('$lib/stores/toaster', () => ({
	globalToaster: { success: vi.fn(), error: vi.fn() }
}));

const user = userEvent.setup();

const SQUARE = {
	type: 'Polygon' as const,
	coordinates: [
		[
			[500000, 5400000],
			[500000, 5400100],
			[500100, 5400100],
			[500000, 5400000]
		]
	]
};

const AREA: InquiryArea = { uuid: 'area-1', name: 'North field', geometry: SQUARE };

function sketch(uuid?: string): OlFeature {
	const feature = new Feature(
		new Polygon([
			[
				[0, 0],
				[0, 1000],
				[1000, 1000],
				[0, 0]
			]
		])
	);
	if (uuid) feature.set('uuid', uuid);
	return feature;
}

function renderWorkspace(areas: InquiryArea[] = [AREA]) {
	getInquiryAreas.mockResolvedValue(areas);
	return render(BoundaryFixture, {
		props: { component: InquiryWorkspace, props: { recordUuid: 'rec-1' } }
	});
}

/**
 * Clicks a map tool and returns the handler the workspace handed to the draw manager.
 */
async function startTool(name: string, start: typeof draw.startDrawing): Promise<FeatureHandler> {
	await user.click(await screen.findByRole('button', { name }));
	return start.mock.calls[0][0] as FeatureHandler;
}

beforeEach(() => {
	getPipelineRecord.mockResolvedValue({ uuid: 'rec-1' });
	createInquiryArea.mockResolvedValue(undefined);
	updateInquiryAreaGeometry.mockResolvedValue(undefined);
});

afterEach(() => {
	Object.values(draw).forEach((spy) => spy.mockReset());
	getInquiryAreas.mockReset();
	createInquiryArea.mockReset();
	updateInquiryAreaGeometry.mockReset();
	getPipelineRecord.mockReset();
	vi.mocked(globalToaster.success).mockClear();
	vi.mocked(globalToaster.error).mockClear();
});

describe('InquiryWorkspace', () => {
	test('should mirror the saved areas onto the map in the storage projection', async () => {
		renderWorkspace();
		await screen.findByTestId('map');

		await vi.waitFor(() => expect(draw.renderPolygons).toHaveBeenCalled());
		const [features, dataProjection, featureProjection] = draw.renderPolygons.mock.calls[0];
		expect(features).toEqual([
			{
				type: 'Feature',
				properties: { uuid: 'area-1', name: 'North field' },
				geometry: SQUARE
			}
		]);
		expect(dataProjection).toBe('EPSG:25832');
		expect(featureProjection).toBe('EPSG:3857');
		expect(draw.updatePolygonGeometryCache).toHaveBeenCalled();
		expect(getInquiryAreas).toHaveBeenCalledWith('rec-1');
	});

	test('should fail the boundary for an unknown record', async () => {
		getPipelineRecord.mockRejectedValue(new Error('Not found.'));
		renderWorkspace();

		expect(await screen.findByTestId('boundary-failed')).toHaveTextContent('Not found.');
		expect(screen.queryByTestId('map')).toBeNull();
	});

	test('should offer editing only once the record has areas', async () => {
		renderWorkspace([]);
		await screen.findByTestId('map');

		expect(screen.getByRole('button', { name: 'action_draw_polygon' })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'action_edit_polygon' })).toBeNull();
	});

	test('should save a finished sketch as an EPSG:4326 polygon of the record', async () => {
		renderWorkspace();
		const onDrawEnd = await startTool('action_draw_polygon', draw.startDrawing);

		await onDrawEnd(sketch());

		expect(createInquiryArea).toHaveBeenCalledTimes(1);
		const [input] = createInquiryArea.mock.calls[0];
		expect(input.recordUuid).toBe('rec-1');
		expect(input.geometry.type).toBe('Polygon');
		expect(input.geometry.coordinates[0][2][0]).toBeCloseTo(0.008983, 5);
		expect(globalToaster.success).toHaveBeenCalled();
	});

	test('should drop the unsaved sketch and show the backend message when saving fails', async () => {
		createInquiryArea.mockRejectedValue(httpError(400, 'geom: Invalid polygon.'));
		renderWorkspace();
		const onDrawEnd = await startTool('action_draw_polygon', draw.startDrawing);
		await vi.waitFor(() => expect(draw.renderPolygons).toHaveBeenCalled());
		draw.renderPolygons.mockClear();

		await onDrawEnd(sketch());

		expect(draw.renderPolygons).toHaveBeenCalledTimes(1);
		expect(globalToaster.error).toHaveBeenCalledWith(
			expect.objectContaining({ description: 'geom: Invalid polygon.' })
		);
		expect(globalToaster.success).not.toHaveBeenCalled();
	});

	test('should save a modified polygon under its area uuid', async () => {
		renderWorkspace();
		const onModifyEnd = await startTool('action_edit_polygon', draw.startEditing);

		await onModifyEnd(sketch('area-1'));

		expect(updateInquiryAreaGeometry).toHaveBeenCalledWith(
			expect.objectContaining({ recordUuid: 'rec-1', areaUuid: 'area-1' })
		);
		expect(globalToaster.success).toHaveBeenCalled();
	});

	test('should put the saved shape back when the backend refuses a modification', async () => {
		updateInquiryAreaGeometry.mockRejectedValue(httpError(400, 'geom: Self-intersection.'));
		renderWorkspace();
		const onModifyEnd = await startTool('action_edit_polygon', draw.startEditing);
		await vi.waitFor(() => expect(draw.renderPolygons).toHaveBeenCalled());
		draw.renderPolygons.mockClear();

		await onModifyEnd(sketch('area-1'));

		expect(draw.renderPolygons).toHaveBeenCalledTimes(1);
		expect(globalToaster.error).toHaveBeenCalledWith(
			expect.objectContaining({ description: 'geom: Self-intersection.' })
		);
	});

	test('should ignore a modified feature that is not a saved area', async () => {
		renderWorkspace();
		const onModifyEnd = await startTool('action_edit_polygon', draw.startEditing);

		await onModifyEnd(sketch());

		expect(updateInquiryAreaGeometry).not.toHaveBeenCalled();
	});
});
