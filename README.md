# Flow Field Visualization

An interactive particle flow field visualization built with Three.js. 50,000 particles follow a Perlin noise-based flow field influenced by real-time edge detection from your webcam - particles flow along detected edges in the camera feed!

**[Live Demo](https://mateovandamme.github.io/flow-field/)**

## How It Works

The webcam feed is analyzed at 640x480 using Sobel edge detection running entirely on the GPU. Detected edges generate flow vectors (rotated 90°) that blend with Perlin noise to guide 50,000 particles. Ping-pong render targets create persistent motion trails. Red arrows can be toggled to visualize the gradient field in real-time.

## Controls

Press **D** to toggle controls and FPS counter.

## Camera Permission

Webcam access required for edge detection.

## Development

Python notebook included at `python/gradient_test.ipynb` for testing gradient kernels (Derivative of Gaussian vs Sobel) before shader implementation.
