import { persisted } from './persisted';

// Default values
const defaultCenter = [0, 0];
const defaultZoom = 2;
const defaultProjectValue = ['1'];

export const sidebarExpanded = persisted('isSidebarExpanded', true);
export const defaultProject = persisted('defaultProject', defaultProjectValue);
export const selectedProject = persisted('selectedProject', defaultProjectValue);
export const mapCenter = persisted('mapCenter', defaultCenter);
export const mapZoom = persisted('mapZoom', defaultZoom);
export const trenchColor = persisted('trenchColor', '#fbb483');
export const trenchColorSelected = persisted('trenchColorSelected', '#fbb483');
export const lightSwitchMode = persisted('lightSwitchMode', 'light');
