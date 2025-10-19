// Camera-interactive flow field visualization
import * as THREE from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import Stats from 'three/addons/libs/stats.module.js';
import { vertexShader, fragmentShader } from './shaders/fade.js';
import { vertexShader as gradientVertexShader, fragmentShader as gradientFragmentShader } from './shaders/gradient.js';

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
let video, videoTexture, prevVideoTexture;
const VIDEO_WIDTH = 80;  // Low res for performance (increase for better quality, decrease for better FPS)
const VIDEO_HEIGHT = 60;

// Gradient calculation (now motion detection)
let gradientRenderTarget;
let gradientScene, gradientCamera, gradientMaterial;
let gradientData = null;
let prevFrameRenderTarget;

// Force field visualization (arrow particles)
let arrowParticles = [];
let arrowParticleSystem;

// Configuration
const config = {
    particleCount: 50000,
    perlinScale: 0.007,
    flowSpeed: 20.0,
    trailDecay: 10, // User-friendly value (gets multiplied by 0.0001 in shader)
    particleSize: 2.0, // Smaller default size
    bounds: 0,  // Will be set dynamically based on screen size
    cameraInfluence: 3.0  // How much the camera affects the flow field
};

// Particle class
class Particle {
    constructor() {
        this.position = new THREE.Vector3(
            (Math.random() - 0.5) * config.bounds,
            (Math.random() - 0.5) * config.bounds,
            0  // 2D - all particles on the same Z plane
        );
        this.size = 0.5 + Math.random() * 2; // Less variation (3 -> 2)
        this.color = new THREE.Color();
        const sizeNormalized = (this.size - 0.5) / 2; // Adjust normalization
        const brightness = Math.pow(sizeNormalized, 2);

        this.color.setRGB(
            0.05 + brightness * 0.25,
            0.15 + brightness * 0.35,
            0.4 + brightness * 0.45
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

async function initWebcam() {
    video = document.getElementById('webcam');

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

        // Create video texture
        videoTexture = new THREE.VideoTexture(video);
        videoTexture.minFilter = THREE.LinearFilter;
        videoTexture.magFilter = THREE.LinearFilter;

        console.log('Webcam initialized and playing');
    } catch (err) {
        console.error('Error accessing webcam:', err);
        alert('Camera access denied or not available. Please allow camera access and reload.');
    }
}

function updateVideoData() {
    if (!video || video.readyState !== video.HAVE_ENOUGH_DATA || !videoTexture) return;

    // Calculate motion by comparing current frame with previous frame
    gradientMaterial.uniforms.tVideo.value = videoTexture;
    gradientMaterial.uniforms.tPrevFrame.value = prevFrameRenderTarget.texture;
    renderer.setRenderTarget(gradientRenderTarget);
    renderer.render(gradientScene, gradientCamera);

    // Copy current video frame to prevFrame buffer for next frame
    const copyScene = new THREE.Scene();
    const copyMat = new THREE.MeshBasicMaterial({ map: videoTexture });
    const copyQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), copyMat);
    copyScene.add(copyQuad);
    renderer.setRenderTarget(prevFrameRenderTarget);
    renderer.render(copyScene, gradientCamera);
    renderer.setRenderTarget(null);

    // Read back motion data to CPU for particle sampling
    const pixelBuffer = new Uint8Array(VIDEO_WIDTH * VIDEO_HEIGHT * 4);
    renderer.readRenderTargetPixels(gradientRenderTarget, 0, 0, VIDEO_WIDTH, VIDEO_HEIGHT, pixelBuffer);
    gradientData = pixelBuffer;

    // Update arrow visualization
    updateArrowVisualization();
}

function updateArrowVisualization() {
    if (!gradientData || !arrowParticleSystem) return;

    const positions = arrowParticleSystem.geometry.attributes.position.array;
    const colors = arrowParticleSystem.geometry.attributes.color.array;

    let particleIndex = 0;
    const step = 50; // Sample spacing in screen pixels
    const arrowLength = 15; // Length of arrows in screen pixels

    // Cover entire screen, including edges
    for (let screenY = 0; screenY <= window.innerHeight; screenY += step) {
        for (let screenX = 0; screenX <= window.innerWidth; screenX += step) {
            if (particleIndex >= arrowParticles.length) break;

            // Convert screen coordinates to world coordinates
            const worldX = screenX - window.innerWidth / 2;
            const worldY = window.innerHeight / 2 - screenY;

            // Get gradient at this position
            const gradient = getVideoGradient(worldX, worldY);
            const magnitude = Math.sqrt(gradient.x * gradient.x + gradient.y * gradient.y);

            if (magnitude > 0.01) {
                // Normalize gradient (flip Y to fix upside-down)
                const dx = (gradient.x / magnitude) * arrowLength;
                const dy = -(gradient.y / magnitude) * arrowLength; // Flip Y here

                // Start point of arrow
                positions[particleIndex * 6] = worldX - dx / 2;
                positions[particleIndex * 6 + 1] = worldY - dy / 2;
                positions[particleIndex * 6 + 2] = 0;

                // End point of arrow
                positions[particleIndex * 6 + 3] = worldX + dx / 2;
                positions[particleIndex * 6 + 4] = worldY + dy / 2;
                positions[particleIndex * 6 + 5] = 0;

                // Color - more reddish (less green)
                const intensity = Math.min(magnitude * 0.5, 0.3); // Less green for more red
                colors[particleIndex * 6] = 1.0; // R
                colors[particleIndex * 6 + 1] = intensity; // G (reduced)
                colors[particleIndex * 6 + 2] = 0.0; // B

                colors[particleIndex * 6 + 3] = 1.0;
                colors[particleIndex * 6 + 4] = intensity;
                colors[particleIndex * 6 + 5] = 0.0;
            } else {
                // Hide this arrow by setting both points to same location
                positions[particleIndex * 6] = 0;
                positions[particleIndex * 6 + 1] = 0;
                positions[particleIndex * 6 + 2] = 0;
                positions[particleIndex * 6 + 3] = 0;
                positions[particleIndex * 6 + 4] = 0;
                positions[particleIndex * 6 + 5] = 0;
            }

            particleIndex++;
        }
    }

    arrowParticleSystem.geometry.attributes.position.needsUpdate = true;
    arrowParticleSystem.geometry.attributes.color.needsUpdate = true;
}

function getVideoGradient(x, y) {
    if (!gradientData) return new THREE.Vector2(0, 0);

    // Map 2D position to video coordinates
    const halfBounds = config.bounds / 2;
    const normalizedX = (x + halfBounds) / config.bounds;
    const normalizedY = (y + halfBounds) / config.bounds;

    // Get continuous position in video space
    const videoX = normalizedX * VIDEO_WIDTH;
    const videoY = (1.0 - normalizedY) * VIDEO_HEIGHT; // Flip Y

    // Get the 4 surrounding pixels for bilinear interpolation
    const x0 = Math.floor(videoX);
    const y0 = Math.floor(videoY);
    const x1 = Math.min(x0 + 1, VIDEO_WIDTH - 1);
    const y1 = Math.min(y0 + 1, VIDEO_HEIGHT - 1);

    // Clamp to bounds
    if (x0 < 0 || x0 >= VIDEO_WIDTH || y0 < 0 || y0 >= VIDEO_HEIGHT) {
        return new THREE.Vector2(0, 0);
    }

    // Get fractional part for interpolation
    const fx = videoX - x0;
    const fy = videoY - y0;

    // Sample 4 corners
    const getSample = (px, py) => {
        const index = (py * VIDEO_WIDTH + px) * 4;
        const gx = (gradientData[index] / 255.0) * 2.0 - 1.0;
        const gy = (gradientData[index + 1] / 255.0) * 2.0 - 1.0;
        return new THREE.Vector2(gx, -gy); // Flip Y
    };

    const v00 = getSample(x0, y0);
    const v10 = getSample(x1, y0);
    const v01 = getSample(x0, y1);
    const v11 = getSample(x1, y1);

    // Bilinear interpolation
    const vx0 = v00.x * (1 - fx) + v10.x * fx;
    const vx1 = v01.x * (1 - fx) + v11.x * fx;
    const vx = vx0 * (1 - fy) + vx1 * fy;

    const vy0 = v00.y * (1 - fx) + v10.y * fx;
    const vy1 = v01.y * (1 - fx) + v11.y * fx;
    const vy = vy0 * (1 - fy) + vy1 * fy;

    return new THREE.Vector2(vx, vy);
}

function init() {
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

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 1);
    renderer.autoClear = false;
    document.body.appendChild(renderer.domElement);

    perlin = new ImprovedNoise();

    stats = new Stats();
    document.body.appendChild(stats.dom);

    // Setup gradient calculation
    setupGradientCalculation();

    setupRenderTargets();
    createParticles();
    createArrowVisualization();
    setupControls();

    // Initialize webcam
    initWebcam();

    window.addEventListener('resize', onWindowResize, false);
}

function setupGradientCalculation() {
    // Create render target for motion detection
    gradientRenderTarget = new THREE.WebGLRenderTarget(VIDEO_WIDTH, VIDEO_HEIGHT, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType
    });

    // Create render target to store previous frame
    prevFrameRenderTarget = new THREE.WebGLRenderTarget(VIDEO_WIDTH, VIDEO_HEIGHT, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType
    });

    // Create scene for motion detection
    gradientScene = new THREE.Scene();
    gradientCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // Create motion detection shader material
    gradientMaterial = new THREE.ShaderMaterial({
        uniforms: {
            tVideo: { value: null },
            tPrevFrame: { value: prevFrameRenderTarget.texture }
        },
        vertexShader: gradientVertexShader,
        fragmentShader: gradientFragmentShader,
        depthWrite: false,
        depthTest: false
    });

    // Create fullscreen quad
    const planeGeometry = new THREE.PlaneGeometry(2, 2);
    const gradientPlane = new THREE.Mesh(planeGeometry, gradientMaterial);
    gradientScene.add(gradientPlane);

    console.log('Motion detection initialized');
}

function setupRenderTargets() {
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

    fadeScene = new THREE.Scene();
    fadeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    fadeMaterial = new THREE.ShaderMaterial({
        uniforms: {
            tDiffuse: { value: null },
            tBackground: { value: null },
            trailDecay: { value: config.trailDecay * 0.0001 }
        },
        vertexShader,
        fragmentShader,
        transparent: true,
        blending: THREE.AdditiveBlending,
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

function getForceField(x, y, t) {
    const scale = config.perlinScale;

    // 2D Perlin noise flow field (using time as z-offset for animation)
    const noiseX = perlin.noise(x * scale, y * scale, t);
    const noiseY = perlin.noise(x * scale + 100, y * scale, t);

    // Get gradient from camera feed
    const gradient = getVideoGradient(x, y);

    // Add gradient force to the base perlin noise
    // Gradient points from dark to bright, so particles flow along edges
    const force = new THREE.Vector2(
        noiseX * 2 + gradient.x * config.cameraInfluence,
        noiseY * 2 + gradient.y * config.cameraInfluence
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

function createArrowVisualization() {
    // Calculate number of arrows needed
    const step = 50; // Sample spacing in pixels
    const arrowsX = Math.ceil(window.innerWidth / step);
    const arrowsY = Math.ceil(window.innerHeight / step);
    const arrowCount = arrowsX * arrowsY;

    // Each arrow is a line segment = 2 vertices
    const positions = new Float32Array(arrowCount * 2 * 3);
    const colors = new Float32Array(arrowCount * 2 * 3);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.6,
        linewidth: 2,
        depthTest: false,
        depthWrite: false
    });

    arrowParticleSystem = new THREE.LineSegments(geometry, material);
    arrowParticleSystem.visible = false; // Hidden by default, toggle with 'd' key
    scene.add(arrowParticleSystem);

    // Store arrow count for update function
    arrowParticles = new Array(arrowCount);

    console.log(`Created ${arrowCount} arrow visualizations`);
}

function setupControls() {
    const gui = new GUI();

    gui.add(config, 'perlinScale', 0.001, 0.01, 0.001)
        .name('Perlin Scale')
        .onChange((value) => {
            config.perlinScale = value;
        });

    gui.add(config, 'flowSpeed', 0.1, 40, 0.1)
        .name('Flow Speed')
        .onChange((value) => {
            config.flowSpeed = value;
        });

    gui.add(config, 'trailDecay', 0.1, 50, 0.1)
        .name('Trail Decay')
        .onChange((value) => {
            config.trailDecay = value;
            fadeMaterial.uniforms.trailDecay.value = value * 0.0001;
        });

    gui.add(config, 'particleSize', 0.5, 5.0, 0.01)
        .name('Particle Size')
        .onChange((value) => {
            config.particleSize = value;
            particleSystem.material.size = value;
        });

    // Camera influence control
    gui.add(config, 'cameraInfluence', 0, 100, 0.1)
        .name('Camera Influence');

    gui.add(config, 'particleCount')
        .name('Particle Count')
        .disable();

    window.addEventListener('keydown', (e) => {
        if (e.key === 'd' || e.key === 'D') {
            if (gui._hidden) {
                gui.show();
                stats.dom.style.display = 'block';
                arrowParticleSystem.visible = true;
            } else {
                gui.hide();
                stats.dom.style.display = 'none';
                arrowParticleSystem.visible = false;
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

    // Step 1: Render particles to writeBuffer (NO arrows in the buffer)
    const arrowsWereVisible = arrowParticleSystem.visible;
    arrowParticleSystem.visible = false;

    renderer.setRenderTarget(writeBuffer);
    renderer.clear();

    // Render previous frame with fade
    fadeMaterial.uniforms.tDiffuse.value = readBuffer.texture;
    fadeMaterial.uniforms.tBackground.value = null;
    renderer.render(fadeScene, fadeCamera);

    // Render current particles on top
    renderer.render(scene, camera);

    // Step 2: Render final result to screen
    renderer.setRenderTarget(null);
    renderer.clear();

    // First: render fresh arrows every frame if visible (no fade)
    if (arrowsWereVisible) {
        arrowParticleSystem.visible = true;
        renderer.render(scene, camera);
    }

    // Second: composite faded particle trails on top
    fadeMaterial.uniforms.tDiffuse.value = writeBuffer.texture;
    fadeMaterial.uniforms.tBackground.value = null;
    renderer.render(fadeScene, fadeCamera);

    // Restore arrow visibility state
    arrowParticleSystem.visible = arrowsWereVisible;

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

    renderTargetA.setSize(window.innerWidth, window.innerHeight);
    renderTargetB.setSize(window.innerWidth, window.innerHeight);
}

// Start the application
init();
animate();
