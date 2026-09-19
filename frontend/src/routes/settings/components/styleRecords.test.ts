import { get, writable } from 'svelte/store';
import { describe, expect, test, vi } from 'vitest';

import { restyle, restyleAll, seedMissingStyles } from './styleRecords';

const blue = () => ({ color: '#0033ff', visible: true });

describe('seedMissingStyles', () => {
	test('should add a default for every name the store does not know', () => {
		const styles = writable<Record<string, { color: string; visible: boolean }>>({});

		seedMissingStyles(styles, ['Asphalt', 'Pflaster'], blue);

		expect(get(styles)).toEqual({
			Asphalt: { color: '#0033ff', visible: true },
			Pflaster: { color: '#0033ff', visible: true }
		});
	});

	test('should keep existing styles untouched', () => {
		const styles = writable<Record<string, { color: string; visible: boolean }>>({
			Asphalt: { color: '#123456', visible: false }
		});

		seedMissingStyles(styles, ['Asphalt', 'Pflaster'], blue);

		expect(get(styles).Asphalt).toEqual({ color: '#123456', visible: false });
		expect(get(styles).Pflaster).toEqual({ color: '#0033ff', visible: true });
	});

	test('should not write the store when nothing is missing', () => {
		const styles = writable({ Asphalt: { color: '#123456', visible: false } });
		const onChange = vi.fn();
		styles.subscribe(onChange);
		onChange.mockClear();

		seedMissingStyles(styles, ['Asphalt'], blue);

		expect(onChange).not.toHaveBeenCalled();
	});
});

describe('restyle', () => {
	test('should replace the looks of the named styles but keep their visibility', () => {
		const styles = writable({
			Asphalt: { color: '#123456', visible: false },
			Pflaster: { color: '#654321', visible: true }
		});

		restyle(styles, ['Asphalt'], blue);

		expect(get(styles)).toEqual({
			Asphalt: { color: '#0033ff', visible: false },
			Pflaster: { color: '#654321', visible: true }
		});
	});

	test('should show a style that was not stored before', () => {
		const styles = writable<Record<string, { color: string; visible: boolean }>>({});

		restyle(styles, ['Asphalt'], blue);

		expect(get(styles).Asphalt).toEqual({ color: '#0033ff', visible: true });
	});
});

describe('restyleAll', () => {
	test('should restyle every known name and drop styles of names that no longer exist', () => {
		const styles = writable<Record<string, { color: string; visible: boolean }>>({
			Asphalt: { color: '#123456', visible: false },
			Removed: { color: '#654321', visible: true }
		});

		restyleAll(styles, ['Asphalt', 'Pflaster'], blue);

		expect(get(styles)).toEqual({
			Asphalt: { color: '#0033ff', visible: false },
			Pflaster: { color: '#0033ff', visible: true }
		});
	});
});
