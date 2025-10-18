# Flow Field Visualization

A 3D particle flow field visualization built with Three.js, featuring smooth trails and interactive controls.

## Features

- **3D Flow Field**: Particles follow a Perlin noise-based flow field in 3D space
- **Persistent Trails**: Beautiful motion trails with customizable fade effects
- **Interactive Controls**: Real-time adjustment of visualization parameters
- **Smooth Animation**: Rotating camera view with continuous particle motion

## Demo

Open `index.html` in a modern web browser to see the visualization in action.

## Controls

- **Noise Scale** (0.001 - 0.01): Controls the granularity of the flow field
- **Flow Speed** (0.1 - 2.0): Adjusts how quickly particles respond to the flow field
- **Trail Length** (Short - Infinite): Controls how long particle trails persist
- **Particle Size** (0.5 - 5.0): Adjusts the size of individual particles

## Technical Details

### Technologies Used

- [Three.js](https://threejs.org/) (r170) - 3D graphics library
- ImprovedNoise from Three.js addons - Perlin noise implementation
- WebGL render targets for trail persistence (ping-pong rendering)
- Custom shader for fade effects

### Project Structure

```
flow-field/
├── index.html          # Main HTML file
├── script.js           # Main application logic
├── shaders/
│   ├── fade.vert      # Vertex shader for trail fade effect
│   └── fade.frag      # Fragment shader for trail fade effect
├── style.css          # Styling (if present)
└── README.md          # This file
```

### How It Works

1. **Flow Field Generation**: Uses 3D Perlin noise to create a smooth, animated vector field
2. **Particle Simulation**: 3000 particles follow the flow field with velocity damping
3. **Trail Rendering**: Uses ping-pong render targets to create persistent motion trails
4. **Fade Effect**: Custom shader gradually fades old trails while preserving new particle positions

## Customization

You can modify the configuration in `script.js`:

```javascript
const config = {
    particleCount: 3000,      // Number of particles
    noiseScale: 0.003,        // Flow field detail
    flowSpeed: 0.5,           // Particle response speed
    fadeSpeed: 0.992,         // Trail persistence (higher = longer)
    particleSize: 2,          // Base particle size
    bounds: 500               // Simulation boundary size
};
```

## Browser Compatibility

Requires a modern browser with WebGL support:
- Chrome/Edge 79+
- Firefox 70+
- Safari 14+

## License

MIT
