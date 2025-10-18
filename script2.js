// Camera-interactive flow field visualization
import * as THREE from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import Stats from 'three/addons/libs/stats.module.js';
import { vertexShader, fragmentShader } from './shaders/fade.js';

// Three.js Scene Setup
let scene, camera, renderer;
let backgroundScene, backgroundCamera;
let perlin;
let time = 0;
let particles = [];
let particleSystem;

// Render targets for trail persistence
let renderTargetA, renderTargetB;
let fadeScene, fadeCamera, fadeMaterial;
let copyMaterial;
let currentRenderTarget = 0;

// Stats
let stats;

// Webcam
let video, videoCanvas, videoContext;
let videoData = null;
const VIDEO_WIDTH = 80;  // Low res for performance
const VIDEO_HEIGHT = 60;

// Force field visualization
let forceFieldCanvas, forceFieldContext;
let forceFieldTexture, forceFieldMaterial, forceFieldPlane;

// Configuration
const config = {
    particleCount: 10000,
    noiseScale: 0.003,
    flowSpeed: 0.5,
    fadeSpeed: 0.992,
    particleSize: 2,
    bounds: 500,
    cameraInfluence: 3.0  // How much the camera affects the flow field
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
        this.size = 0.5 + Math.random() * 3;
        this.color = new THREE.Color();
        const sizeNormalized = (this.size - 0.5) / 3;
        const brightness = Math.pow(sizeNormalized, 2);

        this.color.setRGB(
            0.05 + brightness * 0.25,
            0.15 + brightness * 0.35,
            0.4 + brightness * 0.45
        );
    }

    update(time) {
        const force = getForceField(this.position.x, this.position.y, this.position.z, time);
        this.velocity.add(force.multiplyScalar(0.01 * config.flowSpeed));
        this.velocity.multiplyScalar(0.97);
        this.position.add(this.velocity);

        const halfBounds = config.bounds / 2;
        if (this.position.x > halfBounds) this.position.x = -halfBounds;
        if (this.position.x < -halfBounds) this.position.x = halfBounds;
        if (this.position.y > halfBounds) this.position.y = -halfBounds;
        if (this.position.y < -halfBounds) this.position.y = halfBounds;
        if (this.position.z > halfBounds) this.position.z = -halfBounds;
        if (this.position.z < -halfBounds) this.position.z = halfBounds;
    }
}

async function initWebcam() {
    video = document.getElementById('webcam');
    videoCanvas = document.getElementById('videoCanvas');
    videoCanvas.width = VIDEO_WIDTH;
    videoCanvas.height = VIDEO_HEIGHT;
    videoContext = videoCanvas.getContext('2d', { willReadFrequently: true });

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'user'
            }
        });
        video.srcObject = stream;
        await video.play();
        console.log('Webcam initialized and playing');
    } catch (err) {
        console.error('Error accessing webcam:', err);
        alert('Camera access denied or not available. Please allow camera access and reload.');
    }
}

function updateVideoData() {
    if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) return;

    // Draw video to canvas at low resolution
    videoContext.drawImage(video, 0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
    videoData = videoContext.getImageData(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT).data;

    // Visualize the force field
    drawForceField();
}

function drawForceField() {
    if (!videoData || !forceFieldContext) return;

    // Clear the canvas
    forceFieldContext.clearRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);

    // Draw each pixel based on brightness
    for (let y = 0; y < VIDEO_HEIGHT; y++) {
        for (let x = 0; x < VIDEO_WIDTH; x++) {
            const index = (y * VIDEO_WIDTH + x) * 4;
            const r = videoData[index];
            const g = videoData[index + 1];
            const b = videoData[index + 2];

            // Calculate brightness (0-1)
            const brightness = (r + g + b) / (3 * 255);

            // Invert so darker areas show as brighter red
            const force = 1.0 - brightness;

            // Draw pixel
            if (force > 0.1) {
                const intensity = Math.floor(force * 255);
                forceFieldContext.fillStyle = `rgb(${intensity}, 0, 0)`;
                forceFieldContext.fillRect(x, y, 1, 1);
            }
        }
    }

    // Update the texture
    forceFieldTexture.needsUpdate = true;
}

function getVideoBrightness(x, y, z) {
    if (!videoData) return 0.5;

    // Map 3D position to 2D video coordinates
    const halfBounds = config.bounds / 2;
    const normalizedX = (x + halfBounds) / config.bounds;
    const normalizedY = (y + halfBounds) / config.bounds;

    const videoX = Math.floor(normalizedX * VIDEO_WIDTH);
    const videoY = Math.floor(normalizedY * VIDEO_HEIGHT);

    if (videoX < 0 || videoX >= VIDEO_WIDTH || videoY < 0 || videoY >= VIDEO_HEIGHT) {
        return 0.5;
    }

    const index = (videoY * VIDEO_WIDTH + videoX) * 4;
    const r = videoData[index];
    const g = videoData[index + 1];
    const b = videoData[index + 2];

    // Calculate brightness (0-1)
    const brightness = (r + g + b) / (3 * 255);

    // Invert so darker areas create stronger forces
    return 1.0 - brightness;
}

function init() {
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        1,
        1000
    );
    camera.position.z = 300;
    camera.position.y = 50;
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 1);
    renderer.autoClear = false;
    document.body.appendChild(renderer.domElement);

    perlin = new ImprovedNoise();

    stats = new Stats();
    document.body.appendChild(stats.dom);

    // Setup force field visualization canvas (offscreen)
    forceFieldCanvas = document.createElement('canvas');
    forceFieldCanvas.width = VIDEO_WIDTH;
    forceFieldCanvas.height = VIDEO_HEIGHT;
    forceFieldContext = forceFieldCanvas.getContext('2d');

    // Create a texture from the canvas
    forceFieldTexture = new THREE.CanvasTexture(forceFieldCanvas);

    // Create orthographic background scene for force field
    backgroundScene = new THREE.Scene();
    backgroundCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // Create a fullscreen quad to show the force field
    const planeGeometry = new THREE.PlaneGeometry(2, 2);
    forceFieldMaterial = new THREE.MeshBasicMaterial({
        map: forceFieldTexture,
        transparent: true,
        depthWrite: false,
        depthTest: false
    });
    forceFieldPlane = new THREE.Mesh(planeGeometry, forceFieldMaterial);
    backgroundScene.add(forceFieldPlane);

    console.log('Force field visualization initialized');

    setupRenderTargets();
    createParticles();
    setupControls();

    // Initialize webcam
    initWebcam();

    window.addEventListener('resize', onWindowResize, false);
}

function setupRenderTargets() {
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

    fadeScene = new THREE.Scene();
    fadeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    fadeMaterial = new THREE.ShaderMaterial({
        uniforms: {
            tDiffuse: { value: null },
            tBackground: { value: forceFieldTexture },
            fadeAmount: { value: config.fadeSpeed }
        },
        vertexShader,
        fragmentShader,
        depthWrite: false,
        depthTest: false
    });

    // Simple copy shader (no fading)
    copyMaterial = new THREE.ShaderMaterial({
        uniforms: {
            tDiffuse: { value: null }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform sampler2D tDiffuse;
            varying vec2 vUv;
            void main() {
                gl_FragColor = texture2D(tDiffuse, vUv);
            }
        `,
        depthWrite: false,
        depthTest: false
    });

    const planeGeometry = new THREE.PlaneGeometry(2, 2);
    const fadePlane = new THREE.Mesh(planeGeometry, fadeMaterial);
    fadeScene.add(fadePlane);
}

function createParticles() {
    for (let i = 0; i < config.particleCount; i++) {
        particles.push(new Particle());
    }

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.3)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);

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

    // Base Perlin noise flow field
    const noiseX = perlin.noise(x * scale, y * scale, z * scale + t);
    const noiseY = perlin.noise(x * scale + 100, y * scale, z * scale + t);
    const noiseZ = perlin.noise(x * scale, y * scale + 100, z * scale + t);

    // Get brightness from camera feed
    const brightness = getVideoBrightness(x, y, z);

    // Darker areas (higher brightness value after inversion) create stronger forces
    const cameraForce = brightness * config.cameraInfluence;

    // Combine noise with camera influence
    const force = new THREE.Vector3(
        noiseX * 2 + cameraForce * noiseX,
        noiseY * 2 + cameraForce * noiseY,
        noiseZ * 2 + cameraForce * noiseZ
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

    gui.add(config, 'noiseScale', 0.001, 0.01, 0.001)
        .name('Noise Scale')
        .onChange((value) => {
            config.noiseScale = value;
        });

    gui.add(config, 'flowSpeed', 0.1, 2, 0.1)
        .name('Flow Speed')
        .onChange((value) => {
            config.flowSpeed = value;
        });

    gui.add(config, 'fadeSpeed', 0.97, 0.9999, 0.0001)
        .name('Trail Length')
        .onChange((value) => {
            config.fadeSpeed = value;
            fadeMaterial.uniforms.fadeAmount.value = value;
        });

    gui.add(config, 'particleSize', 0.5, 5, 0.5)
        .name('Particle Size')
        .onChange((value) => {
            config.particleSize = value;
            particleSystem.material.size = value;
        });

    // Camera influence control
    gui.add(config, 'cameraInfluence', 0, 10, 0.1)
        .name('Camera Influence');

    gui.add(config, 'particleCount')
        .name('Particle Count')
        .disable();

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

    // Update video data every frame
    updateVideoData();

    time += 0.005;

    updateParticles();

    // Ping-pong rendering for trail persistence
    const readBuffer = currentRenderTarget === 0 ? renderTargetA : renderTargetB;
    const writeBuffer = currentRenderTarget === 0 ? renderTargetB : renderTargetA;

    // Step 1: Render particles to writeBuffer (just particles, no background)
    renderer.setRenderTarget(writeBuffer);
    renderer.clear();

    // Render previous frame with fade (background will be added in final render)
    fadeMaterial.uniforms.tDiffuse.value = readBuffer.texture;
    fadeMaterial.uniforms.tBackground.value = null; // No background in the buffer
    renderer.render(fadeScene, fadeCamera);

    // Render current particles on top
    renderer.render(scene, camera);

    // Step 2: Render final result to screen with background composited
    renderer.setRenderTarget(null);
    renderer.clear();

    // Render with background + faded particles in ONE shader pass
    fadeMaterial.uniforms.tDiffuse.value = writeBuffer.texture;
    fadeMaterial.uniforms.tBackground.value = forceFieldTexture;
    renderer.render(fadeScene, fadeCamera);

    currentRenderTarget = 1 - currentRenderTarget;

    stats.end();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);

    renderTargetA.setSize(window.innerWidth, window.innerHeight);
    renderTargetB.setSize(window.innerWidth, window.innerHeight);
}

// Start the application
init();
animate();
