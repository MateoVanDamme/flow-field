import * as THREE from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import Stats from 'three/addons/libs/stats.module.js';
import { vertexShader, fragmentShader } from './shaders/fade-simple.js';
import { createParticleSystem, updateParticles } from './core/ParticleSystem.js';
import { setupRenderTargets, resizeRenderTargets } from './core/RenderTargets.js';
import { createOrthographicCamera, resizeCamera } from './core/Camera.js';
import { setupControls } from './core/Controls.js';

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
    trailDecay: 10,
    particleSize: 2.0,
    bounds: 0
};

function init() {
    scene = new THREE.Scene();
    config.bounds = Math.max(window.innerWidth, window.innerHeight);

    camera = createOrthographicCamera(window.innerWidth, window.innerHeight);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    renderer.autoClear = false;
    document.body.appendChild(renderer.domElement);

    perlin = new ImprovedNoise();

    stats = new Stats();
    document.body.appendChild(stats.dom);

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

    setupControls(config, stats, {
        onTrailDecayChange: (value) => {
            fadeMaterial.uniforms.trailDecay.value = value * 0.0001;
        },
        onParticleSizeChange: (value) => {
            particleSystem.material.size = value;
        }
    });

    window.addEventListener('resize', onWindowResize, false);
}


function getForceField(x, y, t) {
    const scale = config.perlinScale;
    const noiseX = perlin.noise(x * scale, y * scale, t * 0.01);
    const noiseY = perlin.noise(x * scale + 100, y * scale, t * 0.01);
    return new THREE.Vector2(noiseX * 2, noiseY * 2);
}

function animate() {
    requestAnimationFrame(animate);
    stats.begin();

    time += 0.005;

    updateParticles(particles, particleSystem, time, config, getForceField);

    const readBuffer = currentRenderTarget === 0 ? renderTargetA : renderTargetB;
    const writeBuffer = currentRenderTarget === 0 ? renderTargetB : renderTargetA;

    fadeMaterial.uniforms.tDiffuse.value = readBuffer.texture;
    renderer.setRenderTarget(writeBuffer);
    renderer.clear();
    renderer.render(fadeScene, fadeCamera);
    renderer.render(scene, camera);

    renderer.setRenderTarget(null);
    renderer.clear();
    fadeMaterial.uniforms.tDiffuse.value = writeBuffer.texture;
    renderer.render(fadeScene, fadeCamera);

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
