import type OlMap from 'ol/Map.js';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { globalMapView, selectedProject } from '$lib/stores/store';

import { syncProjectScope } from './projectScopeSync';

function createMapState(olMap: OlMap | null) {
	return {
		olMap,
		selectedProject: 'project-1',
		reinitializeForProject: vi.fn(),
		reinitializeForGlobalView: vi.fn()
	};
}

const readyMap = {} as OlMap;

let stop: () => void = () => {};

beforeEach(() => {
	selectedProject.set('project-1');
	globalMapView.set(false);
});

afterEach(() => stop());

describe('syncProjectScope', () => {
	test('should rebuild the tile sources when another project is selected', () => {
		const mapState = createMapState(readyMap);
		const onProjectChange = vi.fn();
		stop = syncProjectScope(mapState, onProjectChange);

		selectedProject.set('project-2');

		expect(mapState.reinitializeForProject).toHaveBeenCalledExactlyOnceWith('project-2');
		expect(onProjectChange).toHaveBeenCalledOnce();
	});

	test('should leave the map alone while the project is unchanged', () => {
		const mapState = createMapState(readyMap);
		const onProjectChange = vi.fn();

		stop = syncProjectScope(mapState, onProjectChange);

		expect(mapState.reinitializeForProject).not.toHaveBeenCalled();
		expect(onProjectChange).not.toHaveBeenCalled();
	});

	test('should follow the global view toggle', () => {
		const mapState = createMapState(readyMap);
		stop = syncProjectScope(mapState);

		globalMapView.set(true);

		expect(mapState.reinitializeForGlobalView).toHaveBeenLastCalledWith(true);
	});

	test('should not touch a map that is not ready yet', () => {
		const mapState = createMapState(null);
		stop = syncProjectScope(mapState);

		selectedProject.set('project-2');
		globalMapView.set(true);

		expect(mapState.reinitializeForProject).not.toHaveBeenCalled();
		expect(mapState.reinitializeForGlobalView).not.toHaveBeenCalled();
	});

	test('should stop following the stores once stopped', () => {
		const mapState = createMapState(readyMap);
		syncProjectScope(mapState)();

		selectedProject.set('project-2');

		expect(mapState.reinitializeForProject).not.toHaveBeenCalled();
	});
});
