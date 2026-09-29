import type OlMap from 'ol/Map.js';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { globalMapView } from '$lib/stores/store';

import { syncGlobalView, syncMapProject } from './projectScopeSync';

function createMapState(olMap: OlMap | null) {
	return {
		olMap,
		selectedProject: 'project-1',
		reinitializeForProject: vi.fn(),
		reinitializeForGlobalView: vi.fn()
	};
}

const readyMap = {} as OlMap;

describe('syncMapProject', () => {
	test('should rebuild the tile sources for the project the URL now names', () => {
		const mapState = createMapState(readyMap);
		const onSwitched = vi.fn();

		syncMapProject(mapState, 'project-2', onSwitched);

		expect(mapState.reinitializeForProject).toHaveBeenCalledExactlyOnceWith('project-2');
		expect(onSwitched).toHaveBeenCalledOnce();
	});

	test('should leave a map alone that already shows the project', () => {
		const mapState = createMapState(readyMap);
		const onSwitched = vi.fn();

		syncMapProject(mapState, 'project-1', onSwitched);

		expect(mapState.reinitializeForProject).not.toHaveBeenCalled();
		expect(onSwitched).not.toHaveBeenCalled();
	});

	test('should not touch a map that is not ready yet', () => {
		const mapState = createMapState(null);
		const onSwitched = vi.fn();

		syncMapProject(mapState, 'project-2', onSwitched);

		expect(mapState.reinitializeForProject).not.toHaveBeenCalled();
		expect(onSwitched).not.toHaveBeenCalled();
	});
});

describe('syncGlobalView', () => {
	let stop: () => void = () => {};

	beforeEach(() => globalMapView.set(false));

	afterEach(() => stop());

	test('should follow the global view toggle', () => {
		const mapState = createMapState(readyMap);
		stop = syncGlobalView(mapState);

		globalMapView.set(true);

		expect(mapState.reinitializeForGlobalView).toHaveBeenLastCalledWith(true);
	});

	test('should not touch a map that is not ready yet', () => {
		const mapState = createMapState(null);
		stop = syncGlobalView(mapState);

		globalMapView.set(true);

		expect(mapState.reinitializeForGlobalView).not.toHaveBeenCalled();
	});

	test('should stop following the toggle once stopped', () => {
		const mapState = createMapState(readyMap);
		syncGlobalView(mapState)();

		globalMapView.set(true);

		expect(mapState.reinitializeForGlobalView).not.toHaveBeenCalledWith(true);
	});
});
