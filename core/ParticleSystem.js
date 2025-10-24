import * as THREE from 'three';
import { Particle } from './Particle.js';

export function createParticleSystem(scene, config) {
    const particles = [];

    // Create particle instances
    for (let i = 0; i < config.particleCount; i++) {
        particles.push(new Particle(config.bounds));
    }

    // Create circular sprite texture
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

    const particleSystem = new THREE.Points(geometry, material);
    scene.add(particleSystem);

    return { particles, particleSystem };
}

export function updateParticles(particles, particleSystem, time, config, getForceFieldFn) {
    const positions = particleSystem.geometry.attributes.position.array;

    // Hardcoded probability for random respawn (0.2% chance per frame ~= every 0.5 seconds at 60fps)
    const RESPAWN_PROBABILITY = 0.002;

    for (let i = 0; i < config.particleCount; i++) {
        // Random death and respawn
        if (Math.random() < RESPAWN_PROBABILITY) {
            particles[i].position.set(
                (Math.random() - 0.5) * config.bounds,
                (Math.random() - 0.5) * config.bounds,
                0
            );
        }

        particles[i].update(time, config.bounds, config.flowSpeed, getForceFieldFn);

        positions[i * 3] = particles[i].position.x;
        positions[i * 3 + 1] = particles[i].position.y;
        positions[i * 3 + 2] = particles[i].position.z;
    }

    particleSystem.geometry.attributes.position.needsUpdate = true;
}
