// Use three.js ImprovedNoise implementation
import * as THREE from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import Stats from 'three/addons/libs/stats.module.js';
import { vertexShader, fragmentShader } from './fade-simple.js';

// Three.js Scene Setup
let scene, camera, renderer;
let perlin;
let time = 0;
let particles = [];
let particleSystem;

// Render targets for trail persistence
let renderTargetA, renderTargetB;
let fadeScene, fadeCamera, fadeMaterial;
let currentRenderTarget = 0;

// Stats
let stats;

// Configuration
const config = {
    particleCount: 50000,
    perlinScale: 0.007,
    flowSpeed: 20.0,
    trailDecay: 10, // User-friendly value (gets multiplied by 0.0001 in shader)
    particleSize: 2.0, // Smaller default size
    bounds: 0  // Will be set dynamically based on screen size
};

// Particle class
class Particle {
    constructor() {
        this.position = new THREE.Vector3(
            (Math.random() - 0.5) * config.bounds,
            (Math.random() - 0.5) * config.bounds,
            0  // 2D - all particles on the same Z plane
        );

        // Random size - bigger particles are slightly brighter blue
        this.size = 0.5 + Math.random() * 2; // Less variation

        // Color - all dark blue range, no white
        this.color = new THREE.Color();
        const sizeNormalized = (this.size - 0.5) / 2; // Adjust normalization

        // All particles are shades of blue
        const brightness = Math.pow(sizeNormalized, 2);

        // Dark blue to medium blue only
        this.color.setRGB(
            0.05 + brightness * 0.25,  // R: very little red
            0.15 + brightness * 0.35,  // G: some green
            0.4 + brightness * 0.45    // B: strong blue
        );
    }

    update(time) {
        // Use force field directly as velocity (2D only)
        const force = getForceField(this.position.x, this.position.y, time);
        this.position.x += force.x * 0.01 * config.flowSpeed;
        this.position.y += force.y * 0.01 * config.flowSpeed;
        // Z stays at 0

        // Check if particle is out of bounds (2D only)
        const halfBounds = config.bounds / 2;
        if (this.position.x > halfBounds || this.position.x < -halfBounds ||
            this.position.y > halfBounds || this.position.y < -halfBounds) {
            // Teleport to random position
            this.position.set(
                (Math.random() - 0.5) * config.bounds,
                (Math.random() - 0.5) * config.bounds,
                0
            );
        }
    }
}

function init() {
    // Create scene
    scene = new THREE.Scene();

    // Orthographic camera for 2D view - pixel-based (1 world unit = 1 pixel)
    const halfWidth = window.innerWidth / 2;
    const halfHeight = window.innerHeight / 2;
    camera = new THREE.OrthographicCamera(
        -halfWidth,
        halfWidth,
        halfHeight,
        -halfHeight,
        1,
        1000
    );
    camera.position.z = 100;
    camera.lookAt(0, 0, 0);

    // Set bounds to fill the screen
    config.bounds = Math.max(window.innerWidth, window.innerHeight);

    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    renderer.autoClear = false;
    document.body.appendChild(renderer.domElement);

    // Initialize Perlin noise
    perlin = new ImprovedNoise();

    // Setup Stats
    stats = new Stats();
    document.body.appendChild(stats.dom);

    // Setup render targets for trail persistence
    setupRenderTargets();

    // Create particles
    createParticles();

    // Setup controls
    setupControls();

    // Handle window resize
    window.addEventListener('resize', onWindowResize, false);
}

function setupRenderTargets() {
    // Create two render targets for ping-pong rendering
    const renderTargetParams = {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: THREE.FloatType, // Use floating point for better precision
        stencilBuffer: false
    };

    renderTargetA = new THREE.WebGLRenderTarget(
        window.innerWidth,
        window.innerHeight,
        renderTargetParams
    );

    renderTargetB = new THREE.WebGLRenderTarget(
        window.innerWidth,
        window.innerHeight,
        renderTargetParams
    );

    // Create a scene and camera for the fade effect
    fadeScene = new THREE.Scene();
    fadeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // Create a material that renders the previous frame with linear decay
    fadeMaterial = new THREE.ShaderMaterial({
        uniforms: {
            tDiffuse: { value: null },
            trailDecay: { value: config.trailDecay * 0.0001 }
        },
        vertexShader,
        fragmentShader,
        depthWrite: false,
        depthTest: false
    });

    // Create a full-screen quad for the fade effect
    const planeGeometry = new THREE.PlaneGeometry(2, 2);
    const fadePlane = new THREE.Mesh(planeGeometry, fadeMaterial);
    fadeScene.add(fadePlane);
}

function createParticles() {
    // Create particle instances
    for (let i = 0; i < config.particleCount; i++) {
        particles.push(new Particle());
    }

    // Create circular sprite texture
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    // Create radial gradient for smooth circle
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.3)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);

    // Create geometry for all particles
    const positions = new Float32Array(config.particleCount * 3);
    const colors = new Float32Array(config.particleCount * 3);
    const sizes = new Float32Array(config.particleCount);

    for (let i = 0; i < config.particleCount; i++) {
        positions[i * 3] = particles[i].position.x;
        positions[i * 3 + 1] = particles[i].position.y;
        positions[i * 3 + 2] = particles[i].position.z;

        colors[i * 3] = particles[i].color.r;
        colors[i * 3 + 1] = particles[i].color.g;
        colors[i * 3 + 2] = particles[i].color.b;

        // Vary particle sizes
        sizes[i] = particles[i].size;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
        size: config.particleSize,
        vertexColors: true,
        transparent: true,
        opacity: 0.7,
        blending: THREE.NormalBlending,
        depthWrite: false,
        map: texture,
        sizeAttenuation: true
    });

    particleSystem = new THREE.Points(geometry, material);
    scene.add(particleSystem);
}

function getForceField(x, y, t) {
    const scale = config.perlinScale;

    // 2D Perlin noise flow field (using time as z-offset for animation)
    const noiseX = perlin.noise(x * scale, y * scale, t * 0.01);
    const noiseY = perlin.noise(x * scale + 100, y * scale, t * 0.01);

    // Convert noise (-1 to 1) to 2D force vector
    const force = new THREE.Vector2(
        noiseX * 2,
        noiseY * 2
    );

    return force;
}

function updateParticles() {
    const positions = particleSystem.geometry.attributes.position.array;

    for (let i = 0; i < config.particleCount; i++) {
        particles[i].update(time);

        positions[i * 3] = particles[i].position.x;
        positions[i * 3 + 1] = particles[i].position.y;
        positions[i * 3 + 2] = particles[i].position.z;
    }

    particleSystem.geometry.attributes.position.needsUpdate = true;
}

function setupControls() {
    const gui = new GUI();

    // Perlin Scale control
    gui.add(config, 'perlinScale', 0.001, 0.01, 0.001)
        .name('Perlin Scale')
        .onChange((value) => {
            config.perlinScale = value;
        });

    // Flow Speed control
    gui.add(config, 'flowSpeed', 0.1, 40, 0.1)
        .name('Flow Speed')
        .onChange((value) => {
            config.flowSpeed = value;
        });

    // Trail Decay control
    gui.add(config, 'trailDecay', 0.1, 50, 0.1)
        .name('Trail Decay')
        .onChange((value) => {
            config.trailDecay = value;
            fadeMaterial.uniforms.trailDecay.value = value * 0.0001;
        });

    // Particle Size control
    gui.add(config, 'particleSize', 0.5, 5.0, 0.01)
        .name('Particle Size')
        .onChange((value) => {
            config.particleSize = value;
            particleSystem.material.size = value;
        });

    // Particle Count display (read-only)
    gui.add(config, 'particleCount')
        .name('Particle Count')
        .disable();

    // Add keyboard shortcut to toggle GUI and Stats (press 'd' for debug)
    window.addEventListener('keydown', (e) => {
        if (e.key === 'd' || e.key === 'D') {
            if (gui._hidden) {
                gui.show();
                stats.dom.style.display = 'block';
            } else {
                gui.hide();
                stats.dom.style.display = 'none';
            }
        }
    });

    return gui;
}

function animate() {
    requestAnimationFrame(animate);

    stats.begin();

    time += 0.005;

    // Update particles
    updateParticles();

    // Ping-pong rendering for trail persistence
    const readBuffer = currentRenderTarget === 0 ? renderTargetA : renderTargetB;
    const writeBuffer = currentRenderTarget === 0 ? renderTargetB : renderTargetA;

    // Step 1: Render previous frame with fade to writeBuffer
    fadeMaterial.uniforms.tDiffuse.value = readBuffer.texture;
    renderer.setRenderTarget(writeBuffer);
    renderer.clear();
    renderer.render(fadeScene, fadeCamera);

    // Step 2: Render current particles on top (without clearing)
    renderer.render(scene, camera);

    // Step 3: Render final result to screen
    renderer.setRenderTarget(null);
    renderer.clear();
    fadeMaterial.uniforms.tDiffuse.value = writeBuffer.texture;
    renderer.render(fadeScene, fadeCamera);

    // Swap buffers
    currentRenderTarget = 1 - currentRenderTarget;

    stats.end();
}

function onWindowResize() {
    // Update camera to match new pixel dimensions
    const halfWidth = window.innerWidth / 2;
    const halfHeight = window.innerHeight / 2;
    camera.left = -halfWidth;
    camera.right = halfWidth;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();

    // Update bounds to fill screen
    config.bounds = Math.max(window.innerWidth, window.innerHeight);

    renderer.setSize(window.innerWidth, window.innerHeight);

    // Resize render targets
    renderTargetA.setSize(window.innerWidth, window.innerHeight);
    renderTargetB.setSize(window.innerWidth, window.innerHeight);
}

// Start the application
init();
animate();
