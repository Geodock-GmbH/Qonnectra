// @vitest-environment jsdom
import { get } from 'svelte/store';
import { describe, expect, test, vi } from 'vitest';

import {
	getWMSLayerVisibility,
	getWMSSourceExpanded,
	selectedProject,
	setWMSLayerVisibility,
	setWMSSourceExpanded,
	wmsSourcesData
} from './store';

vi.mock('$app/environment', () => ({
	browser: true
}));

describe('store defaults', () => {
	test('should default the selected project to "1"', () => {
		expect(get(selectedProject)).toBe('1');
	});

	test('should start with no loaded WMS sources', () => {
		expect(get(wmsSourcesData)).toEqual({ sources: [], loaded: false });
	});
});

describe('getWMSLayerVisibility', () => {
	const config = { 'proj-1': { 'layer-a': true, 'layer-b': false } };

	test('should return the configured visibility', () => {
		expect(getWMSLayerVisibility(config, 'proj-1', 'layer-a')).toBe(true);
		expect(getWMSLayerVisibility(config, 'proj-1', 'layer-b')).toBe(false);
	});

	test('should fall back to the default for unknown layers or projects', () => {
		expect(getWMSLayerVisibility(config, 'proj-1', 'layer-x')).toBe(false);
		expect(getWMSLayerVisibility(config, 'proj-2', 'layer-a', true)).toBe(true);
	});
});

describe('setWMSLayerVisibility', () => {
	test('should set visibility without mutating the original config', () => {
		const config = { 'proj-1': { 'layer-a': true } };

		const updated = setWMSLayerVisibility(config, 'proj-1', 'layer-b', true);

		expect(updated['proj-1']).toEqual({ 'layer-a': true, 'layer-b': true });
		expect(config['proj-1']).toEqual({ 'layer-a': true });
	});

	test('should create the project entry when missing', () => {
		const updated = setWMSLayerVisibility({}, 'proj-2', 'layer-a', true);

		expect(updated).toEqual({ 'proj-2': { 'layer-a': true } });
	});
});

describe('getWMSSourceExpanded', () => {
	test('should return the configured expansion state', () => {
		const state = { 'proj-1': { 'src-1': true } };

		expect(getWMSSourceExpanded(state, 'proj-1', 'src-1')).toBe(true);
	});

	test('should default to collapsed for unknown sources', () => {
		expect(getWMSSourceExpanded({}, 'proj-1', 'src-1')).toBe(false);
	});
});

describe('setWMSSourceExpanded', () => {
	test('should set expansion state without mutating the original state', () => {
		const state = { 'proj-1': { 'src-1': false } };

		const updated = setWMSSourceExpanded(state, 'proj-1', 'src-1', true);

		expect(updated['proj-1']['src-1']).toBe(true);
		expect(state['proj-1']['src-1']).toBe(false);
	});
});
