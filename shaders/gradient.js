// Vertex Shader
export const vertexShader = `
varying vec2 vUv;

void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Fragment Shader - Spatial gradient calculation for edge detection
export const fragmentShader = `
uniform sampler2D tVideo;
uniform float motionThreshold;
varying vec2 vUv;

void main() {
    vec2 texelSize = vec2(1.0 / 80.0, 1.0 / 60.0); // Video texture resolution

    // Sample neighboring pixels to calculate spatial gradient
    float center = texture2D(tVideo, vUv).r;
    float left = texture2D(tVideo, vUv + vec2(-texelSize.x, 0.0)).r;
    float right = texture2D(tVideo, vUv + vec2(texelSize.x, 0.0)).r;
    float top = texture2D(tVideo, vUv + vec2(0.0, texelSize.y)).r;
    float bottom = texture2D(tVideo, vUv + vec2(0.0, -texelSize.y)).r;

    // Calculate gradient using Sobel operator (amplified by 3x for stronger effect)
    float gradientX = (right - left) * 1.5;
    float gradientY = (top - bottom) * 1.5;

    // Calculate gradient magnitude
    float magnitude = sqrt(gradientX * gradientX + gradientY * gradientY);

    // Apply threshold - zero out gradients below threshold
    if (magnitude < motionThreshold) {
        gradientX = 0.0;
        gradientY = 0.0;
    }

    // Store gradient as RG (red = X gradient, green = Y gradient)
    // Map from [-1, 1] to [0, 1] for storage in texture
    // Flip X to match horizontally flipped video
    gl_FragColor = vec4(-gradientX * 0.5 + 0.5, gradientY * 0.5 + 0.5, 0.0, 1.0);
}
`;
