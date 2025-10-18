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
    // Gaussian blur on the background
    vec2 texelSize = vec2(1.0 / 80.0, 1.0 / 60.0); // Size of one pixel in the low-res texture

    // 3x3 Gaussian kernel (sigma ~= 1.0)
    // [1  2  1]
    // [2  4  2]  / 16
    // [1  2  1]

    vec3 blurred = vec3(0.0);

    blurred += texture2D(tBackground, vUv + vec2(-1.0, -1.0) * texelSize).rgb * 1.0;
    blurred += texture2D(tBackground, vUv + vec2( 0.0, -1.0) * texelSize).rgb * 2.0;
    blurred += texture2D(tBackground, vUv + vec2( 1.0, -1.0) * texelSize).rgb * 1.0;

    blurred += texture2D(tBackground, vUv + vec2(-1.0,  0.0) * texelSize).rgb * 2.0;
    blurred += texture2D(tBackground, vUv + vec2( 0.0,  0.0) * texelSize).rgb * 4.0;
    blurred += texture2D(tBackground, vUv + vec2( 1.0,  0.0) * texelSize).rgb * 2.0;

    blurred += texture2D(tBackground, vUv + vec2(-1.0,  1.0) * texelSize).rgb * 1.0;
    blurred += texture2D(tBackground, vUv + vec2( 0.0,  1.0) * texelSize).rgb * 2.0;
    blurred += texture2D(tBackground, vUv + vec2( 1.0,  1.0) * texelSize).rgb * 1.0;

    blurred /= 16.0; // Normalize by sum of weights

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
