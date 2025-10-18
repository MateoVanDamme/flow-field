// Vertex Shader
export const vertexShader = `
varying vec2 vUv;

void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Fragment Shader
export const fragmentShader = `
uniform sampler2D tDiffuse;
uniform float fadeAmount;
varying vec2 vUv;

void main() {
    vec4 texel = texture2D(tDiffuse, vUv);
    // Fade toward black, not just multiply
    vec3 fadedColor = texel.rgb * fadeAmount;
    // Add stronger decay to ensure trails fully disappear
    fadedColor = max(fadedColor - vec3(0.003), vec3(0.0));
    gl_FragColor = vec4(fadedColor, 1.0);
}
`;
