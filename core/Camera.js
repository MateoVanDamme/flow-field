import * as THREE from 'three';

export function createOrthographicCamera(width, height) {
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    const camera = new THREE.OrthographicCamera(
        -halfWidth,
        halfWidth,
        halfHeight,
        -halfHeight,
        1,
        1000
    );
    camera.position.z = 100;
    camera.lookAt(0, 0, 0);
    return camera;
}

export function resizeCamera(camera, width, height) {
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    camera.left = -halfWidth;
    camera.right = halfWidth;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
}
