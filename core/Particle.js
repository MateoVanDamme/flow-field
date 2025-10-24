import * as THREE from 'three';

export class Particle {
    constructor(bounds) {
        this.position = new THREE.Vector3(
            (Math.random() - 0.5) * bounds,
            (Math.random() - 0.5) * bounds,
            0  // 2D - all particles on the same Z plane
        );
        this.size = 0.5 + Math.random() * 2;
        this.color = new THREE.Color();
        const sizeNormalized = (this.size - 0.5) / 2;
        const brightness = Math.pow(sizeNormalized, 2);

        this.color.setRGB(
            0.05 + brightness * 0.25,
            0.15 + brightness * 0.35,
            0.4 + brightness * 0.45
        );
    }

    update(time, bounds, flowSpeed, getForceFieldFn) {
        // Use force field directly as velocity (2D only)
        const force = getForceFieldFn(this.position.x, this.position.y, time);
        this.position.x += force.x * 0.01 * flowSpeed;
        this.position.y += force.y * 0.01 * flowSpeed;
        // Z stays at 0

        // Check if particle is out of bounds (2D only)
        const halfBounds = bounds / 2;
        if (this.position.x > halfBounds || this.position.x < -halfBounds ||
            this.position.y > halfBounds || this.position.y < -halfBounds) {
            // Teleport to random position
            this.position.set(
                (Math.random() - 0.5) * bounds,
                (Math.random() - 0.5) * bounds,
                0
            );
        }
    }
}
