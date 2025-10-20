// Vertex Shader
export const vertexShader = `
varying vec2 vUv;

void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Fragment Shader - Frame differencing for motion detection
export const fragmentShader = `
uniform sampler2D tVideo;
uniform sampler2D tPrevFrame;
uniform float motionThreshold;
varying vec2 vUv;

void main() {
    vec2 texelSize = vec2(1.0 / 80.0, 1.0 / 60.0); // Video texture resolution

    // Get current and previous frame brightness
    vec3 current = texture2D(tVideo, vUv).rgb;
    vec3 previous = texture2D(tPrevFrame, vUv).rgb;

    float currentBrightness = (current.r + current.g + current.b) / 3.0;
    float previousBrightness = (previous.r + previous.g + previous.b) / 3.0;

    // Calculate motion in local neighborhood to get direction
    float motionX = 0.0;
    float motionY = 0.0;

    // Sample 3x3 neighborhood for optical flow estimation
    for (float dy = -1.0; dy <= 1.0; dy += 1.0) {
        for (float dx = -1.0; dx <= 1.0; dx += 1.0) {
            vec2 offset = vec2(dx, dy) * texelSize;

            float currSample = texture2D(tVideo, vUv + offset).r;
            float prevSample = texture2D(tPrevFrame, vUv).r;

            float diff = currSample - prevSample;

            motionX += diff * dx;
            motionY += diff * dy;
        }
    }

    // Normalize motion vector
    motionX *= 0.5;
    motionY *= 0.5;

    // Calculate motion magnitude
    float magnitude = sqrt(motionX * motionX + motionY * motionY);

    // Apply threshold - zero out motion below threshold
    if (magnitude < motionThreshold) {
        motionX = 0.0;
        motionY = 0.0;
    }

    // Store motion as RG (red = X motion, green = Y motion)
    // Map from [-1, 1] to [0, 1] for storage in texture
    // Flip Y to match screen coordinates
    gl_FragColor = vec4(motionX * 0.5 + 0.5, -motionY * 0.5 + 0.5, 0.0, 1.0);
}
`;
