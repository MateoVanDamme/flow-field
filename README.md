# Flow Field Visualization

A 3D particle flow field visualization built with Three.js. Particles follow a Perlin noise-based flow field, creating beautiful, organic motion trails in 3D space.

**[Live Demo](https://mateovandamme.github.io/flow-field/)**

## How It Works

- **Flow Field**: Uses 3D Perlin noise (ImprovedNoise) to generate a smooth, animated vector field
- **Particles**: 3000 particles follow the flow field with velocity damping
- **Trail Rendering**: Ping-pong render targets create persistent motion trails with custom fade shaders

## Controls

Press **D** to show/hide debug controls (GUI + FPS counter):
- **Noise Scale**: Granularity of the flow field
- **Flow Speed**: How quickly particles respond to forces
- **Trail Length**: How long particle trails persist
- **Particle Size**: Size of individual particles
