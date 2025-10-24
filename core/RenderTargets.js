import * as THREE from 'three';

export function setupRenderTargets(width, height, vertexShader, fragmentShader, config) {
    const renderTargetParams = {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: THREE.FloatType,
        stencilBuffer: false
    };

    const renderTargetA = new THREE.WebGLRenderTarget(width, height, renderTargetParams);
    const renderTargetB = new THREE.WebGLRenderTarget(width, height, renderTargetParams);

    const fadeScene = new THREE.Scene();
    const fadeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const fadeMaterial = new THREE.ShaderMaterial({
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

    const planeGeometry = new THREE.PlaneGeometry(2, 2);
    const fadePlane = new THREE.Mesh(planeGeometry, fadeMaterial);
    fadeScene.add(fadePlane);

    return {
        renderTargetA,
        renderTargetB,
        fadeScene,
        fadeCamera,
        fadeMaterial
    };
}

export function resizeRenderTargets(renderTargetA, renderTargetB, width, height) {
    renderTargetA.setSize(width, height);
    renderTargetB.setSize(width, height);
}
