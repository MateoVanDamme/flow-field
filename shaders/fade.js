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
    // Simple box blur on the background
    vec2 texelSize = vec2(1.0 / 80.0, 1.0 / 60.0); // Size of one pixel in the low-res texture
    vec3 blurred = vec3(0.0);

    // 3x3 blur kernel
    for (float y = -1.0; y <= 1.0; y++) {
        for (float x = -1.0; x <= 1.0; x++) {
            vec2 offset = vec2(x, y) * texelSize;
            blurred += texture2D(tBackground, vUv + offset).rgb;
        }
    }
    blurred /= 9.0; // Average of 9 samples

    vec3 background = blurred * 0.3; // Darken the red camera preview

    // Get the faded particles
    vec4 texel = texture2D(tDiffuse, vUv);
    vec3 fadedColor = texel.rgb * fadeAmount;
    fadedColor = max(fadedColor - vec3(0.003), vec3(0.0));

    // Composite: background + particles on top
    vec3 finalColor = background + fadedColor;

    gl_FragColor = vec4(finalColor, 1.0);
}
`;
