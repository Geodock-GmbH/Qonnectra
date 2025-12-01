import { persisted } from './persisted';
import { session } from './session';

// Default values
const defaultCenter = [0, 0];
const defaultZoom = 2;
const defaultProjectValue = ['1'];
const defaultFlagValue = ['1'];
const defaultTrenchColor = '#000000';

export const sidebarExpanded = persisted('isSidebarExpanded', true);
export const defaultProject = persisted('defaultProject', defaultProjectValue);
export const selectedProject = persisted('selectedProject', defaultProjectValue);
export const mapCenter = persisted('mapCenter', defaultCenter);
export const mapZoom = persisted('mapZoom', defaultZoom);
export const trenchColor = persisted('trenchColor', defaultTrenchColor);
export const trenchColorSelected = persisted('trenchColorSelected', defaultTrenchColor);
export const lightSwitchMode = persisted('lightSwitchMode', 'light');
export const selectedFlag = persisted('selectedFlag', defaultFlagValue);
export const routingMode = persisted('routingMode', false);
export const routingTolerance = persisted('routingTolerance', [1]);
export const selectedConduit = session('selectedConduit', undefined);
export const theme = persisted('theme', ['legacy']);
export const drawerWidth = persisted('drawerWidth', 400);
export const edgeSnappingEnabled = persisted('edgeSnappingEnabled', true);
export const edgeSnappingGridSize = persisted('edgeSnappingGridSize', 20);
export const networkSchemaViewport = persisted('networkSchemaViewport', { x: 0, y: 0, zoom: 1 });

// Node type styles - stores color, size, and visibility per node type
// Structure: { [node_type_name]: { color: '#hex', size: number, visible: boolean } }
export const nodeTypeStyles = persisted('nodeTypeStyles', {});
