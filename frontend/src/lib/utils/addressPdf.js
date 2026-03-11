import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const MARGIN = 18;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

const COL_GAP = 6;
const LEFT_COL_WIDTH = 100;
const RIGHT_COL_WIDTH = CONTENT_WIDTH - LEFT_COL_WIDTH - COL_GAP;
const RIGHT_COL_X = MARGIN + LEFT_COL_WIDTH + COL_GAP;

const COLORS = {
	green: [46, 170, 110],
	greenLight: [235, 250, 243],
	dark: [24, 32, 44],
	text: [33, 37, 41],
	textMuted: [108, 117, 125],
	border: [206, 212, 218],
	white: [255, 255, 255],
	rowAlt: [245, 248, 251]
};

/**
 * Generate a PDF for an address with optional residential units.
 * @param {Object} params
 * @param {Object} params.address - Address data object
 * @param {Array} params.residentialUnits - Array of residential unit objects
 * @param {string|null} params.mapImage - Base64 data URL of the map canvas
 * @param {boolean} params.includeResidentialUnits - Whether to include RU pages
 * @param {Object} params.labels - Translation labels
 */
export function generateAddressPdf({
	address,
	residentialUnits,
	mapImage,
	includeResidentialUnits,
	labels
}) {
	const doc = new jsPDF('p', 'mm', 'a4');

	buildAddressPage(doc, { address, mapImage, labels });

	if (includeResidentialUnits && residentialUnits?.length > 0) {
		for (const unit of residentialUnits) {
			doc.addPage();
			buildResidentialUnitPage(doc, { unit, address, labels });
		}
	}

	addPageNumbers(doc);

	const filename = `${address.street}_${address.housenumber}${address.house_number_suffix || ''}.pdf`;
	doc.save(filename.replace(/\s+/g, '_'));
}

/**
 * Build the address overview page.
 */
function buildAddressPage(doc, { address, mapImage, labels }) {
	let y = 0;

	y = drawHeaderBand(doc, {
		title: `${address.street} ${address.housenumber}${address.house_number_suffix || ''}`,
		subtitle: `${address.zip_code} ${address.city}${address.district ? `  ·  ${address.district}` : ''}`
	});

	y += 2;

	const gridTop = y;

	// --- Left column: Address info + Classification ---
	let leftY = gridTop;

	leftY = drawSectionHeader(doc, labels.sectionAddressInformation, leftY, MARGIN);

	const addressRows = [
		[labels.idAddress, address.id_address || '–'],
		[labels.street, address.street || '–'],
		[
			labels.housenumber,
			`${address.housenumber ?? '–'}${address.house_number_suffix ? ` ${address.house_number_suffix}` : ''}`
		],
		[labels.zipCode, address.zip_code || '–'],
		[labels.city, address.city || '–'],
		[labels.district, address.district || '–']
	];

	leftY = drawDataTable(doc, addressRows, leftY, {
		marginLeft: MARGIN,
		tableWidth: LEFT_COL_WIDTH
	});
	leftY += 8;

	leftY = drawSectionHeader(doc, labels.sectionClassification, leftY, MARGIN);

	const classificationRows = [
		[labels.statusDevelopment, address.status_development?.status || '–'],
		[labels.flag, address.flag?.flag || '–'],
		[labels.project, address.project?.project || '–']
	];

	leftY = drawDataTable(doc, classificationRows, leftY, {
		marginLeft: MARGIN,
		tableWidth: LEFT_COL_WIDTH
	});

	// --- Right column: Map + Coordinates ---
	let rightY = gridTop;

	if (mapImage) {
		rightY = drawMapImage(doc, mapImage, rightY);
		rightY += 3;
	}

	if (address.coords25832 || address.coords4326) {
		rightY = drawCoordinateBlock(doc, address, rightY);
	}
}

/**
 * Build a residential unit page.
 */
function buildResidentialUnitPage(doc, { unit, address, labels }) {
	let y = 0;

	const addressLine = `${address.street} ${address.housenumber}${address.house_number_suffix || ''}, ${address.zip_code} ${address.city}`;

	y = drawHeaderBand(doc, {
		title: labels.residentialUnit,
		subtitle: addressLine
	});

	y += 2;

	const gridTop = y;

	// --- Left column: Identification + Classification ---
	let leftY = gridTop;

	leftY = drawSectionHeader(doc, labels.sectionIdentification, leftY, MARGIN);

	const idRows = [
		[labels.unitId, unit.id_residential_unit || '–'],
		[labels.externalId1, unit.external_id_1 || '–'],
		[labels.externalId2, unit.external_id_2 || '–']
	];
	leftY = drawDataTable(doc, idRows, leftY, {
		marginLeft: MARGIN,
		tableWidth: LEFT_COL_WIDTH
	});
	leftY += 8;

	leftY = drawSectionHeader(doc, labels.sectionClassification, leftY, MARGIN);

	const classRows = [
		[labels.unitType, unit.residential_unit_type?.residential_unit_type || '–'],
		[labels.unitStatus, unit.status?.status || '–']
	];
	leftY = drawDataTable(doc, classRows, leftY, {
		marginLeft: MARGIN,
		tableWidth: LEFT_COL_WIDTH
	});

	// --- Right column: Location + Resident ---
	let rightY = gridTop;

	rightY = drawSectionHeader(doc, labels.sectionUnitLocation, rightY, RIGHT_COL_X);

	const locationRows = [
		[labels.floor, unit.floor ?? '–'],
		[labels.side, unit.side || '–'],
		[labels.buildingSection, unit.building_section || '–']
	];
	rightY = drawDataTable(doc, locationRows, rightY, {
		marginLeft: RIGHT_COL_X,
		tableWidth: RIGHT_COL_WIDTH
	});
	rightY += 8;

	rightY = drawSectionHeader(doc, labels.sectionResident, rightY, RIGHT_COL_X);

	const residentRows = [
		[labels.residentName, unit.resident_name || '–'],
		[labels.residentRecordedDate, unit.resident_recorded_date || '–'],
		[labels.readyForService, unit.ready_for_service || '–']
	];
	drawDataTable(doc, residentRows, rightY, {
		marginLeft: RIGHT_COL_X,
		tableWidth: RIGHT_COL_WIDTH
	});
}

/**
 * Draw the header band with Qonnectra green accent stripe.
 * @returns {number} The y position after the header
 */
function drawHeaderBand(doc, { title, subtitle }) {
	const stripeHeight = 3;
	const bandHeight = 26;

	doc.setFillColor(...COLORS.green);
	doc.rect(0, 0, PAGE_WIDTH, stripeHeight, 'F');

	doc.setFillColor(...COLORS.dark);
	doc.rect(0, stripeHeight, PAGE_WIDTH, bandHeight, 'F');

	doc.setFontSize(15);
	doc.setFont('helvetica', 'bold');
	doc.setTextColor(...COLORS.white);
	doc.text(title, MARGIN, stripeHeight + 11);

	doc.setFontSize(9);
	doc.setFont('helvetica', 'normal');
	doc.setTextColor(160, 175, 190);
	doc.text(subtitle, MARGIN, stripeHeight + 19);

	const dateStr = new Date().toLocaleDateString('de-DE', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric'
	});
	doc.setFontSize(8);
	doc.setTextColor(...COLORS.green);
	doc.text(dateStr, PAGE_WIDTH - MARGIN, stripeHeight + 11, { align: 'right' });

	doc.setTextColor(...COLORS.text);

	return stripeHeight + bandHeight + 6;
}

/**
 * Draw the map image in the right column, preserving aspect ratio.
 * @returns {number} The y position after the map
 */
function drawMapImage(doc, mapImage, y) {
	const mapWidth = RIGHT_COL_WIDTH;
	const mapHeight = mapWidth * 0.75;

	doc.setFillColor(...COLORS.greenLight);
	doc.rect(RIGHT_COL_X - 1, y - 1, mapWidth + 2, mapHeight + 2, 'F');

	doc.setDrawColor(...COLORS.green);
	doc.setLineWidth(0.4);
	doc.rect(RIGHT_COL_X - 0.5, y - 0.5, mapWidth + 1, mapHeight + 1, 'S');

	doc.addImage(mapImage, 'PNG', RIGHT_COL_X, y, mapWidth, mapHeight);

	return y + mapHeight + 2;
}

/**
 * Draw compact coordinate labels under the map.
 * @returns {number} The y position after the block
 */
function drawCoordinateBlock(doc, address, y) {
	doc.setFillColor(...COLORS.rowAlt);
	const blockHeight = address.coords25832 && address.coords4326 ? 14 : 8;
	doc.roundedRect(RIGHT_COL_X, y, RIGHT_COL_WIDTH, blockHeight, 1.5, 1.5, 'F');

	doc.setFontSize(6.5);
	let lineY = y + 4.5;

	if (address.coords25832) {
		doc.setFont('helvetica', 'bold');
		doc.setTextColor(...COLORS.textMuted);
		doc.text('EPSG:25832', RIGHT_COL_X + 3, lineY);
		const labelW = doc.getTextWidth('EPSG:25832');
		doc.setFont('helvetica', 'normal');
		doc.setTextColor(...COLORS.text);
		doc.text(address.coords25832, RIGHT_COL_X + 3 + labelW + 2, lineY);
		lineY += 5.5;
	}

	if (address.coords4326) {
		doc.setFont('helvetica', 'bold');
		doc.setTextColor(...COLORS.textMuted);
		doc.text('EPSG:4326', RIGHT_COL_X + 3, lineY);
		const labelW = doc.getTextWidth('EPSG:4326');
		doc.setFont('helvetica', 'normal');
		doc.setTextColor(...COLORS.text);
		doc.text(address.coords4326, RIGHT_COL_X + 3 + labelW + 2, lineY);
	}

	doc.setTextColor(...COLORS.text);
	return y + blockHeight + 2;
}

/**
 * Draw a section header with a green accent bar.
 * @returns {number} The y position after the header
 */
function drawSectionHeader(doc, text, y, x = MARGIN) {
	doc.setFillColor(...COLORS.green);
	doc.rect(x, y, 2.5, 5, 'F');

	doc.setFontSize(10);
	doc.setFont('helvetica', 'bold');
	doc.setTextColor(...COLORS.dark);
	doc.text(text, x + 5.5, y + 3.8);

	doc.setTextColor(...COLORS.text);

	return y + 8;
}

/**
 * Draw a styled key-value data table.
 * @returns {number} The y position after the table
 */
function drawDataTable(
	doc,
	rows,
	startY,
	{ marginLeft = MARGIN, tableWidth = CONTENT_WIDTH } = {}
) {
	const labelColWidth = Math.min(tableWidth * 0.42, 55);

	autoTable(doc, {
		startY,
		margin: { left: marginLeft, right: PAGE_WIDTH - marginLeft - tableWidth },
		theme: 'plain',
		tableWidth,
		columnStyles: {
			0: {
				fontStyle: 'bold',
				cellWidth: labelColWidth,
				textColor: COLORS.textMuted,
				fontSize: 8.5
			},
			1: {
				cellWidth: tableWidth - labelColWidth,
				textColor: COLORS.text,
				fontSize: 9
			}
		},
		body: rows,
		styles: {
			cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
			lineWidth: 0,
			minCellHeight: 6.5
		},
		alternateRowStyles: {
			fillColor: COLORS.rowAlt
		}
	});

	const tableEndY = doc.lastAutoTable.finalY;
	doc.setDrawColor(...COLORS.border);
	doc.setLineWidth(0.15);
	doc.line(marginLeft, tableEndY, marginLeft + tableWidth, tableEndY);

	return tableEndY;
}

/**
 * Add page numbers and footer to all pages.
 */
function addPageNumbers(doc) {
	const totalPages = doc.getNumberOfPages();

	for (let i = 1; i <= totalPages; i++) {
		doc.setPage(i);

		doc.setDrawColor(...COLORS.green);
		doc.setLineWidth(0.4);
		doc.line(MARGIN, PAGE_HEIGHT - 14, MARGIN + CONTENT_WIDTH, PAGE_HEIGHT - 14);

		doc.setFontSize(7.5);
		doc.setFont('helvetica', 'normal');
		doc.setTextColor(...COLORS.textMuted);
		doc.text(`${i} / ${totalPages}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 9, {
			align: 'right'
		});

		doc.setTextColor(...COLORS.green);
		doc.setFont('helvetica', 'bold');
		doc.text('Qonnectra', MARGIN, PAGE_HEIGHT - 9);

		const qWidth = doc.getTextWidth('Qonnectra');
		doc.setTextColor(...COLORS.textMuted);
		doc.setFont('helvetica', 'normal');
		doc.text(' GIS', MARGIN + qWidth, PAGE_HEIGHT - 9);
	}
}
