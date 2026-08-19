interface FileTypeInfo {
	description: string;
	mime: string;
}

const FILE_TYPES: Record<string, FileTypeInfo> = {
	'.zip': { description: 'ZIP Archive', mime: 'application/zip' },
	'.geojson': { description: 'GeoJSON File', mime: 'application/geo+json' },
	'.json': { description: 'JSON File', mime: 'application/json' },
	'.csv': { description: 'CSV File', mime: 'text/csv' },
	'.xlsx': {
		description: 'Excel Spreadsheet',
		mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
	},
	'.pdf': { description: 'PDF Document', mime: 'application/pdf' }
};

interface SaveFilePickerOptions {
	suggestedName: string;
	types: { description: string; accept: Record<string, string[]> }[];
}

interface FileSystemWritableFileStream {
	write(data: Blob): Promise<void>;
	close(): Promise<void>;
}

interface FileSystemFileHandle {
	createWritable(): Promise<FileSystemWritableFileStream>;
}

/**
 * Prompts the user to choose a save location via the File System Access API,
 * falling back to an anchor-based download when unsupported.
 */
export async function saveFile(blob: Blob, suggestedName: string): Promise<void> {
	if (typeof (window as unknown as Record<string, unknown>).showSaveFilePicker === 'function') {
		await saveWithPicker(blob, suggestedName);
	} else {
		saveWithAnchor(blob, suggestedName);
	}
}

async function saveWithPicker(blob: Blob, suggestedName: string): Promise<void> {
	const ext = suggestedName.includes('.')
		? suggestedName.slice(suggestedName.lastIndexOf('.'))
		: '';
	const fileType = FILE_TYPES[ext];

	const types: SaveFilePickerOptions['types'] = fileType
		? [{ description: fileType.description, accept: { [fileType.mime]: [ext] } }]
		: [];

	let handle: FileSystemFileHandle;
	try {
		const showSaveFilePicker = (window as unknown as Record<string, unknown>)
			.showSaveFilePicker as (options: SaveFilePickerOptions) => Promise<FileSystemFileHandle>;
		handle = await showSaveFilePicker({ suggestedName, types });
	} catch (err) {
		if (err instanceof DOMException && err.name === 'AbortError') return;
		throw err;
	}

	const writable = await handle.createWritable();
	await writable.write(blob);
	await writable.close();
}

function saveWithAnchor(blob: Blob, suggestedName: string): void {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = suggestedName;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}
