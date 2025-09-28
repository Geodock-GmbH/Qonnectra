# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```bash
# create a new project in the current directory
npx sv create

# create a new project in my-app
npx sv create my-app
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```bash
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```bash
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

# Frontend

This is the frontend for the Krit-GIS application built with SvelteKit and OpenLayers.

## Features

### Map Component

The Map component provides a reusable OpenLayers map with the following features:

- **Opacity Slider**: Control the opacity of the base OSM layer
- **Layer Visibility Tree**: Toggle visibility of individual map layers on/off

#### Using the Layer Visibility Tree

The Map component now includes a layer visibility tree that allows users to toggle individual layers on and off. To use this feature:

1. **Enable the feature** by setting `showLayerVisibilityTree={true}` (default)
2. **Add layer names** to your OpenLayers layers for better display in the tree:

```javascript
// Example: Adding layer properties for the visibility tree
vectorLayer.set('layerId', 'my-unique-layer-id');
vectorLayer.set('layerName', 'My Layer Display Name');
```

3. **Position**: The layer visibility tree appears in the top-left corner of the map
4. **Controls**: Each layer gets a toggle switch and visibility icon (eye/eye-off)

#### Map Component Props

```javascript
<Map
	layers={[layer1, layer2, layer3]}
	showOpacitySlider={true} // Default: true - Show opacity control for base layer
	showLayerVisibilityTree={true} // Default: true - Show layer visibility controls
	on:layerVisibilityChanged={handleLayerVisibilityChange}
/>
```

#### Layer Visibility Events

The component dispatches `layerVisibilityChanged` events when a layer's visibility is toggled:

```javascript
function handleLayerVisibilityChange(event) {
	const { layerId, visible, layer } = event.detail;
	console.log(`Layer ${layerId} is now ${visible ? 'visible' : 'hidden'}`);
}
```

## Development

Install dependencies and start the development server:

```bash
npm install
npm run dev
```
