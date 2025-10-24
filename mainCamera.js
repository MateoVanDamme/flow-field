import * as THREE from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import Stats from 'three/addons/libs/stats.module.js';
import { vertexShader, fragmentShader } from './shaders/fade.js';
import { vertexShader as gradientVertexShader, fragmentShader as gradientFragmentShader } from './shaders/gradient.js';
import { createParticleSystem, updateParticles } from './core/ParticleSystem.js';
import { setupRenderTargets, resizeRenderTargets } from './core/RenderTargets.js';
import { createOrthographicCamera, resizeCamera } from './core/Camera.js';
import { setupControls } from './core/Controls.js';

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
    cameraInfluence: 3.0,  // How much the camera affects the flow field
    showArrows: false,  // Toggle arrow visualization
    motionThreshold: 0.1  // Minimum motion magnitude to register (0-1)
};


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

    // Only read back motion data to CPU if arrows are visible (expensive operation!)
    if (config.showArrows) {
        const pixelBuffer = new Uint8Array(VIDEO_WIDTH * VIDEO_HEIGHT * 4);
        renderer.readRenderTargetPixels(gradientRenderTarget, 0, 0, VIDEO_WIDTH, VIDEO_HEIGHT, pixelBuffer);
        gradientData = pixelBuffer;

        // Update arrow visualization
        updateArrowVisualization();
    }
}

function updateArrowVisualization() {
    if (!gradientData || !arrowParticleSystem) return;

    const positions = arrowParticleSystem.geometry.attributes.position.array;
    const colors = arrowParticleSystem.geometry.attributes.color.array;

    let particleIndex = 0;
    const step = 50; // Sample spacing in screen pixels
    const maxArrowLength = 30; // Maximum length of arrows in screen pixels

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

            // Only show arrows with motion above threshold (using same threshold as shader)
            if (magnitude > config.motionThreshold) {
                // Scale arrow length proportionally to magnitude
                const arrowLength = magnitude * maxArrowLength;

                // Normalize gradient
                const dx = (gradient.x / magnitude) * arrowLength;
                const dy = (gradient.y / magnitude) * arrowLength;

                // Start point of arrow
                positions[particleIndex * 6] = worldX - dx / 2;
                positions[particleIndex * 6 + 1] = worldY - dy / 2;
                positions[particleIndex * 6 + 2] = 0;

                // End point of arrow
                positions[particleIndex * 6 + 3] = worldX + dx / 2;
                positions[particleIndex * 6 + 4] = worldY + dy / 2;
                positions[particleIndex * 6 + 5] = 0;

                // Color - pure red
                colors[particleIndex * 6] = 1.0; // R
                colors[particleIndex * 6 + 1] = 0.0; // G
                colors[particleIndex * 6 + 2] = 0.0; // B

                colors[particleIndex * 6 + 3] = 1.0;
                colors[particleIndex * 6 + 4] = 0.0;
                colors[particleIndex * 6 + 5] = 0.0;
            } else {
                // Hide arrow by collapsing it to a point
                positions[particleIndex * 6] = 0;
                positions[particleIndex * 6 + 1] = 0;
                positions[particleIndex * 6 + 2] = 0;
                positions[particleIndex * 6 + 3] = 0;
                positions[particleIndex * 6 + 4] = 0;
                positions[particleIndex * 6 + 5] = 0;

                // Make it invisible
                colors[particleIndex * 6] = 0.0;
                colors[particleIndex * 6 + 1] = 0.0;
                colors[particleIndex * 6 + 2] = 0.0;
                colors[particleIndex * 6 + 3] = 0.0;
                colors[particleIndex * 6 + 4] = 0.0;
                colors[particleIndex * 6 + 5] = 0.0;
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
        return new THREE.Vector2(gx, gy);
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
    config.bounds = Math.max(window.innerWidth, window.innerHeight);

    camera = createOrthographicCamera(window.innerWidth, window.innerHeight);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 1);
    renderer.autoClear = false;
    document.body.appendChild(renderer.domElement);

    perlin = new ImprovedNoise();

    stats = new Stats();
    document.body.appendChild(stats.dom);

    setupGradientCalculation();

    const renderTargets = setupRenderTargets(
        window.innerWidth,
        window.innerHeight,
        vertexShader,
        fragmentShader,
        config
    );
    renderTargetA = renderTargets.renderTargetA;
    renderTargetB = renderTargets.renderTargetB;
    fadeScene = renderTargets.fadeScene;
    fadeCamera = renderTargets.fadeCamera;
    fadeMaterial = renderTargets.fadeMaterial;

    const particleSystemData = createParticleSystem(scene, config);
    particles = particleSystemData.particles;
    particleSystem = particleSystemData.particleSystem;

    createArrowVisualization();

    setupControls(config, stats, {
        onTrailDecayChange: (value) => {
            fadeMaterial.uniforms.trailDecay.value = value * 0.0001;
        },
        onParticleSizeChange: (value) => {
            particleSystem.material.size = value;
        },
        onMotionThresholdChange: (value) => {
            gradientMaterial.uniforms.motionThreshold.value = value;
        },
        onShowArrowsChange: (value) => {
            arrowParticleSystem.visible = value;
        }
    });

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
            tPrevFrame: { value: prevFrameRenderTarget.texture },
            motionThreshold: { value: config.motionThreshold }
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
        opacity: 0.9,
        linewidth: 3,
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


function animate() {
    requestAnimationFrame(animate);
    stats.begin();

    updateVideoData();
    time += 0.005;

    updateParticles(particles, particleSystem, time, config, getForceField);

    const readBuffer = currentRenderTarget === 0 ? renderTargetA : renderTargetB;
    const writeBuffer = currentRenderTarget === 0 ? renderTargetB : renderTargetA;

    const arrowsWereVisible = arrowParticleSystem.visible;
    arrowParticleSystem.visible = false;

    renderer.setRenderTarget(writeBuffer);
    renderer.clear();

    fadeMaterial.uniforms.tDiffuse.value = readBuffer.texture;
    fadeMaterial.uniforms.tBackground.value = null;
    renderer.render(fadeScene, fadeCamera);
    renderer.render(scene, camera);

    renderer.setRenderTarget(null);
    renderer.clear();

    fadeMaterial.uniforms.tDiffuse.value = writeBuffer.texture;
    fadeMaterial.uniforms.tBackground.value = null;
    renderer.render(fadeScene, fadeCamera);

    if (arrowsWereVisible) {
        arrowParticleSystem.visible = true;
        renderer.render(scene, camera);
    }

    arrowParticleSystem.visible = arrowsWereVisible;
    currentRenderTarget = 1 - currentRenderTarget;
    stats.end();
}

function onWindowResize() {
    resizeCamera(camera, window.innerWidth, window.innerHeight);
    config.bounds = Math.max(window.innerWidth, window.innerHeight);
    renderer.setSize(window.innerWidth, window.innerHeight);
    resizeRenderTargets(renderTargetA, renderTargetB, window.innerWidth, window.innerHeight);
}

// Start the application
init();
animate();
