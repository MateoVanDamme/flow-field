// Use three.js ImprovedNoise implementation
import * as THREE from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { vertexShader, fragmentShader } from './shaders/fade.js';

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

// Configuration
const config = {
    particleCount: 3000,
    noiseScale: 0.003,
    flowSpeed: 0.5,
    fadeSpeed: 0.992, // Higher = slower fade (0.95 = fast, 0.99 = very slow)
    particleSize: 2,
    bounds: 500
};

// Particle class
class Particle {
    constructor() {
        this.position = new THREE.Vector3(
            (Math.random() - 0.5) * config.bounds,
            (Math.random() - 0.5) * config.bounds,
            (Math.random() - 0.5) * config.bounds
        );
        this.velocity = new THREE.Vector3(0, 0, 0);

        // Random size - bigger particles are slightly brighter blue
        this.size = 0.5 + Math.random() * 3;

        // Color - all dark blue range, no white
        this.color = new THREE.Color();
        const sizeNormalized = (this.size - 0.5) / 3; // 0 to 1

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
        // Get force from flow field
        const force = getForceField(this.position.x, this.position.y, this.position.z, time);

        // Update velocity with force
        this.velocity.add(force.multiplyScalar(0.01 * config.flowSpeed));

        // Apply damping
        this.velocity.multiplyScalar(0.97);

        // Update position
        this.position.add(this.velocity);

        // Wrap around bounds
        const halfBounds = config.bounds / 2;
        if (this.position.x > halfBounds) this.position.x = -halfBounds;
        if (this.position.x < -halfBounds) this.position.x = halfBounds;
        if (this.position.y > halfBounds) this.position.y = -halfBounds;
        if (this.position.y < -halfBounds) this.position.y = halfBounds;
        if (this.position.z > halfBounds) this.position.z = -halfBounds;
        if (this.position.z < -halfBounds) this.position.z = halfBounds;
    }
}

function init() {
    // Create scene
    scene = new THREE.Scene();

    // Create camera
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        1,
        1000
    );
    camera.position.z = 300;
    camera.position.y = 50;
    camera.lookAt(0, 0, 0);

    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    renderer.autoClear = false;
    document.body.appendChild(renderer.domElement);

    // Initialize Perlin noise
    perlin = new ImprovedNoise();

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

    // Create a material that renders the previous frame with slight transparency
    fadeMaterial = new THREE.ShaderMaterial({
        uniforms: {
            tDiffuse: { value: null },
            fadeAmount: { value: config.fadeSpeed }
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

function getForceField(x, y, z, t) {
    const scale = config.noiseScale;

    // Use 4D noise (x, y, z, time) for animated flow field
    const noiseX = perlin.noise(x * scale, y * scale, z * scale + t);
    const noiseY = perlin.noise(x * scale + 100, y * scale, z * scale + t);
    const noiseZ = perlin.noise(x * scale, y * scale + 100, z * scale + t);

    // Convert noise (-1 to 1) to force vector
    const force = new THREE.Vector3(
        noiseX * 2,
        noiseY * 2,
        noiseZ * 2
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
    const noiseScale = document.getElementById('noiseScale');
    const noiseScaleValue = document.getElementById('noiseScaleValue');
    noiseScale.addEventListener('input', (e) => {
        config.noiseScale = parseFloat(e.target.value);
        noiseScaleValue.textContent = config.noiseScale.toFixed(3);
    });

    const flowSpeed = document.getElementById('flowSpeed');
    const flowSpeedValue = document.getElementById('flowSpeedValue');
    flowSpeed.addEventListener('input', (e) => {
        config.flowSpeed = parseFloat(e.target.value);
        flowSpeedValue.textContent = config.flowSpeed.toFixed(1);
    });

    const trailLength = document.getElementById('trailLength');
    const trailLengthValue = document.getElementById('trailLengthValue');
    trailLength.min = '0.97';
    trailLength.max = '0.9999';
    trailLength.step = '0.0001';
    trailLength.value = config.fadeSpeed.toString();
    trailLengthValue.textContent = 'Long';

    trailLength.addEventListener('input', (e) => {
        config.fadeSpeed = parseFloat(e.target.value);
        fadeMaterial.uniforms.fadeAmount.value = config.fadeSpeed;

        // Update label based on fade speed
        if (config.fadeSpeed < 0.980) {
            trailLengthValue.textContent = 'Short';
        } else if (config.fadeSpeed < 0.990) {
            trailLengthValue.textContent = 'Medium';
        } else if (config.fadeSpeed < 0.995) {
            trailLengthValue.textContent = 'Long';
        } else if (config.fadeSpeed < 0.998) {
            trailLengthValue.textContent = 'Very Long';
        } else if (config.fadeSpeed < 0.9995) {
            trailLengthValue.textContent = 'Extreme';
        } else {
            trailLengthValue.textContent = 'Infinite';
        }
    });

    const trailOpacity = document.getElementById('trailOpacity');
    const trailOpacityValue = document.getElementById('trailOpacityValue');
    trailOpacity.addEventListener('input', (e) => {
        const size = parseFloat(e.target.value);
        config.particleSize = size;
        particleSystem.material.size = size;
        trailOpacityValue.textContent = size.toFixed(1);
    });
}

function animate() {
    requestAnimationFrame(animate);

    time += 0.005;

    // Rotate camera slowly
    camera.position.x = Math.sin(time * 0.1) * 300;
    camera.position.z = Math.cos(time * 0.1) * 300;
    camera.lookAt(0, 0, 0);

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
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Resize render targets
    renderTargetA.setSize(window.innerWidth, window.innerHeight);
    renderTargetB.setSize(window.innerWidth, window.innerHeight);
}

// Start the application
init();
animate();
