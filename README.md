# Flow Field Visualization

An interactive 3D particle flow field visualization built with Three.js. Particles follow a Perlin noise-based flow field that's influenced by your webcam - darker areas in the camera feed create stronger forces, pulling particles toward you!

**[Live Demo](https://mateovandamme.github.io/flow-field/)**

## How It Works

- **Flow Field**: Uses 3D Perlin noise (ImprovedNoise) to generate a smooth, animated vector field
- **Camera Interaction**: Your webcam feed is analyzed in real-time - darker areas create stronger forces
- **Visual Feedback**: A subtle red overlay shows the force field strength from your camera
- **Particles**: 10,000 particles follow the combined flow field with velocity damping
- **Trail Rendering**: Ping-pong render targets create persistent motion trails with custom fade shaders
- **Performance**: Camera feed is analyzed at 80x60 resolution with Gaussian blur for smooth visualization

## Controls

Press **D** to show/hide debug controls (GUI + FPS counter):
- **Noise Scale**: Granularity of the base flow field
- **Flow Speed**: How quickly particles respond to forces
- **Trail Length**: How long particle trails persist
- **Particle Size**: Size of individual particles
- **Camera Influence**: How much the camera affects the flow field (0 = pure noise, higher = camera-driven)

## Camera Permission

The visualization requires webcam access to create the interactive force field. Allow camera permission when prompted by your browser.
