import { persisted } from './persisted';

// Default values
const defaultCenter = [0, 0];
const defaultZoom = 2;
const defaultProjectValue = ['1'];
const defaultFlagValue = '1';
const defaultTrenchColor = '#fbb483';

export const sidebarExpanded = persisted('isSidebarExpanded', true);
export const defaultProject = persisted('defaultProject', defaultProjectValue);
export const selectedProject = persisted('selectedProject', defaultProjectValue);
export const mapCenter = persisted('mapCenter', defaultCenter);
export const mapZoom = persisted('mapZoom', defaultZoom);
export const trenchColor = persisted('trenchColor', defaultTrenchColor);
export const trenchColorSelected = persisted('trenchColorSelected', defaultTrenchColor);
export const lightSwitchMode = persisted('lightSwitchMode', 'light');
export const selectedFlag = persisted('selectedFlag', defaultFlagValue);
