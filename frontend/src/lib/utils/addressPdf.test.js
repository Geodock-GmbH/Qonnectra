import { beforeEach, describe, expect, test, vi } from 'vitest';

import { generateAddressPdf } from './addressPdf.js';

/** @type {any[]} */
let textCalls = [];
/** @type {any[]} */
let splitTextCalls = [];

vi.mock('jspdf', () => {
	class MockJsPDF {
		constructor() {
			this.pages = 1;
			this.currentPage = 1;
		}

		setFillColor() {}
		setDrawColor() {}
		setLineWidth() {}
		setTextColor() {}
		setFont() {}
		setFontSize() {}
		rect() {}
		roundedRect() {}
		line() {}
		circle() {}
		addImage() {}

		text(/** @type {string} */ content, /** @type {number} */ x, /** @type {number} */ y) {
			textCalls.push({ content, x, y });
		}

		getTextWidth(/** @type {string} */ text) {
			return text.length * 2;
		}

		splitTextToSize(/** @type {string} */ text, /** @type {number} */ maxWidth) {
			splitTextCalls.push({ text, maxWidth });
			const charsPerLine = Math.floor(maxWidth / 2);
			if (text.length <= charsPerLine) return [text];
			const lines = [];
			for (let i = 0; i < text.length; i += charsPerLine) {
				lines.push(text.slice(i, i + charsPerLine));
			}
			return lines;
		}

		addPage() {
			this.pages++;
		}

		getNumberOfPages() {
			return this.pages;
		}

		setPage(/** @type {number} */ n) {
			this.currentPage = n;
		}

		save() {}
	}

	return { jsPDF: MockJsPDF };
});

vi.mock('$lib/paraglide/messages', () => ({
	m: {
		Qonnectra: () => 'Qonnectra',
		common_documentation: () => 'Documentation'
	}
}));

/** @returns {Record<string, string>} */
function createLabels() {
	return {
		sectionAddressInformation: 'Address Information',
		sectionClassification: 'Classification',
		sectionLocation: 'Location',
		idAddress: 'ID Address',
		street: 'Street',
		housenumber: 'Housenumber',
		zipCode: 'ZIP Code',
		city: 'City',
		district: 'District',
		statusDevelopment: 'Status',
		flag: 'Flag',
		project: 'Project',
		residentialUnit: 'Residential Units',
		sectionIdentification: 'Identification',
		sectionUnitLocation: 'Unit Location',
		sectionResident: 'Resident',
		unitId: 'Unit ID',
		unitType: 'Unit Type',
		unitStatus: 'Unit Status',
		floor: 'Floor',
		side: 'Side',
		buildingSection: 'Building Section',
		externalId1: 'External ID 1',
		externalId2: 'External ID 2',
		residentName: 'Resident Name',
		residentRecordedDate: 'Recorded Date',
		readyForService: 'Ready for Service',
		sectionMicroductConnections: 'Microduct Connections',
		tableParentNode: 'Parent Node',
		tableNode: 'Node',
		tableConduitName: 'Conduit Name',
		tableConduitType: 'Conduit Type',
		tableNumber: 'Number',
		tableColor: 'Color',
		sectionFiberConnections: 'Fiber Connections',
		tableCableName: 'Cable Name',
		tableFiberAbsolute: 'Fiber Absolute',
		tableBundle: 'Bundle',
		tableFiber: 'Fiber',
		sectionComment: 'Comment'
	};
}

/** @returns {Record<string, any>} */
function createAddress() {
	return {
		id_address: 'ADDR-001',
		street: 'Main St',
		housenumber: 42,
		house_number_suffix: '',
		zip_code: '12345',
		city: 'Berlin',
		district: 'Mitte',
		status_development: { id: 1, status: 'Planned' },
		flag: { id: 1, flag: 'Priority' },
		project: { id: 1, project: 'Test Project' }
	};
}

describe('generateAddressPdf', () => {
	beforeEach(() => {
		textCalls = [];
		splitTextCalls = [];
	});

	test('should generate PDF without commentText (backward compatible)', () => {
		expect(() => {
			generateAddressPdf({
				address: createAddress(),
				residentialUnits: [],
				mapImage: null,
				includeResidentialUnits: false,
				labels: createLabels()
			});
		}).not.toThrow();
	});

	test('should generate PDF with commentText without error', () => {
		expect(() => {
			generateAddressPdf({
				address: createAddress(),
				residentialUnits: [],
				mapImage: null,
				includeResidentialUnits: false,
				commentText: 'This is a post-compaction comment with details.',
				labels: createLabels()
			});
		}).not.toThrow();
	});

	test('should generate PDF with commentText and residential units', () => {
		const units = [
			{
				id_residential_unit: 'RU-1',
				floor: 1,
				side: 'left',
				building_section: 'A',
				residential_unit_type: { residential_unit_type: 'Apartment' },
				status: { status: 'Active' },
				external_id_1: 'EXT1',
				external_id_2: 'EXT2',
				resident_name: 'John',
				resident_recorded_date: '2024-01-01',
				ready_for_service: 'Yes',
				fiberConnections: []
			}
		];

		expect(() => {
			generateAddressPdf({
				address: createAddress(),
				residentialUnits: units,
				mapImage: null,
				includeResidentialUnits: true,
				commentText: 'Post-compaction notes',
				labels: createLabels()
			});
		}).not.toThrow();
	});

	test('should generate PDF with long commentText (multi-line wrapping)', () => {
		const longText =
			'This is a very long comment that should be wrapped across multiple lines in the PDF document. ' +
			'It contains important details about the post-compaction process and various observations ' +
			'that the user wants to document for future reference. The text should wrap correctly.';

		expect(() => {
			generateAddressPdf({
				address: createAddress(),
				residentialUnits: [],
				mapImage: null,
				includeResidentialUnits: false,
				commentText: longText,
				labels: createLabels()
			});
		}).not.toThrow();
	});

	test('should render comment text in the PDF when commentText is provided', () => {
		generateAddressPdf({
			address: createAddress(),
			residentialUnits: [],
			mapImage: null,
			includeResidentialUnits: false,
			commentText: 'Specific post-compaction note',
			labels: createLabels()
		});

		const commentTextFound = textCalls.some((c) => c.content === 'Specific post-compaction note');
		expect(commentTextFound).toBe(true);
	});

	test('should render comment section title when commentText is provided', () => {
		generateAddressPdf({
			address: createAddress(),
			residentialUnits: [],
			mapImage: null,
			includeResidentialUnits: false,
			commentText: 'A comment',
			labels: createLabels()
		});

		const sectionTitleFound = textCalls.some((c) => c.content === 'COMMENT');
		expect(sectionTitleFound).toBe(true);
	});

	test('should not render comment section when commentText is not provided', () => {
		generateAddressPdf({
			address: createAddress(),
			residentialUnits: [],
			mapImage: null,
			includeResidentialUnits: false,
			labels: createLabels()
		});

		const commentSectionFound = textCalls.some((c) => c.content === 'COMMENT');
		expect(commentSectionFound).toBe(false);
	});

	test('should use full width for data sections when no map and no microducts', () => {
		expect(() => {
			generateAddressPdf({
				address: createAddress(),
				residentialUnits: [],
				mapImage: null,
				includeResidentialUnits: false,
				linkedMicroducts: [],
				commentText: 'Full width comment',
				labels: createLabels()
			});
		}).not.toThrow();
	});

	test('should still support map image and microducts (existing behavior)', () => {
		expect(() => {
			generateAddressPdf({
				address: {
					...createAddress(),
					coordsDefault: '123.456, 789.012',
					coords4326: '52.520, 13.405',
					srid: 25832
				},
				residentialUnits: [],
				mapImage: 'data:image/png;base64,iVBOR',
				includeResidentialUnits: false,
				linkedMicroducts: [
					{
						uuid: 'md-1',
						number: 1,
						color: 'Red',
						colorHex: '#ff0000',
						conduitName: 'C1',
						conduitType: 'Type A',
						nodeName: 'N1',
						parentNodeName: 'PN1'
					}
				],
				labels: createLabels()
			});
		}).not.toThrow();
	});
});
