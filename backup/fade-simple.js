// Vertex Shader
export const vertexShader = `
varying vec2 vUv;

void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Fragment Shader - Simple version without camera background
export const fragmentShader = `
uniform sampler2D tDiffuse;
uniform float trailDecay;
varying vec2 vUv;

void main() {
    // Get the faded particles - linear decay
    vec4 texel = texture2D(tDiffuse, vUv);

    // Subtract the decay amount directly and clamp to zero
    vec3 fadedColor = max(texel.rgb - vec3(trailDecay), vec3(0.0));

    gl_FragColor = vec4(fadedColor, 1.0);
}
`;
