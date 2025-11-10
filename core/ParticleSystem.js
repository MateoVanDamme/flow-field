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

export function updateParticles(particles, particleSystem, time, config, getForceFieldFn, getVideoGradientFn) {
    const positions = particleSystem.geometry.attributes.position.array;
    const colors = particleSystem.geometry.attributes.color.array;

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

        // Update color based on camera gradient influence
        const gradient = getVideoGradientFn(particles[i].position.x, particles[i].position.y);
        const gradientMagnitude = Math.sqrt(gradient.x * gradient.x + gradient.y * gradient.y);

        // Scale gradient magnitude by camera influence to match actual effect on particles
        const cameraInfluence = gradientMagnitude * config.cameraInfluence;

        // Blend from base blue color to warm orange based on camera influence
        // Base color (low influence): bluish
        // High influence: warm orange
        const influence = Math.min(cameraInfluence * 0.15, 1.0); // Subtle effect

        const baseR = 0.05 + particles[i].baseBrightness * 0.25;
        const baseG = 0.15 + particles[i].baseBrightness * 0.35;
        const baseB = 0.4 + particles[i].baseBrightness * 0.45;

        // Warm orange target: more red, some green, less blue
        colors[i * 3] = baseR + influence * (0.9 - baseR);     // R (warm orange red)
        colors[i * 3 + 1] = baseG + influence * (0.05 - baseG); // G (orange tint)
        colors[i * 3 + 2] = baseB - influence * baseB * 0.7;    // B (reduce blue subtly)
    }

    particleSystem.geometry.attributes.position.needsUpdate = true;
    particleSystem.geometry.attributes.color.needsUpdate = true;
}
