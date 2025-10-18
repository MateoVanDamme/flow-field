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
uniform sampler2D tBackground;
uniform float fadeAmount;
varying vec2 vUv;

void main() {
    // Get the background (camera force field)
    vec4 background = texture2D(tBackground, vUv);

    // Get the faded particles
    vec4 texel = texture2D(tDiffuse, vUv);
    vec3 fadedColor = texel.rgb * fadeAmount;
    fadedColor = max(fadedColor - vec3(0.003), vec3(0.0));

    // Composite: background + particles on top
    vec3 finalColor = background.rgb + fadedColor;

    gl_FragColor = vec4(finalColor, 1.0);
}
`;
