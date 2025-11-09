// Vertex Shader
export const vertexShader = `
varying vec2 vUv;

void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Fragment Shader - Scale-invariant Sobel gradient
export const fragmentShader = `
uniform sampler2D tVideo;
uniform float edgeDetectionWidth;
varying vec2 vUv;

void main() {
    // Scale-invariant sampling distance (adjustable edge detection width)
    vec2 texelSize = vec2(1.0 / 640.0, 1.0 / 480.0);
    vec2 offset = texelSize * edgeDetectionWidth;

    // 3x3 Sobel operator with scaled sampling
    // Sample positions
    float tl = texture2D(tVideo, vUv + vec2(-offset.x, offset.y)).r;
    float t  = texture2D(tVideo, vUv + vec2(0.0, offset.y)).r;
    float tr = texture2D(tVideo, vUv + vec2(offset.x, offset.y)).r;

    float l  = texture2D(tVideo, vUv + vec2(-offset.x, 0.0)).r;
    float r  = texture2D(tVideo, vUv + vec2(offset.x, 0.0)).r;

    float bl = texture2D(tVideo, vUv + vec2(-offset.x, -offset.y)).r;
    float b  = texture2D(tVideo, vUv + vec2(0.0, -offset.y)).r;
    float br = texture2D(tVideo, vUv + vec2(offset.x, -offset.y)).r;

    // Sobel X kernel: [-1 0 1; -2 0 2; -1 0 1]
    float gradientX = (-tl + tr - 2.0*l + 2.0*r - bl + br) * 0.5;

    // Sobel Y kernel: [-1 -2 -1; 0 0 0; 1 2 1]
    float gradientY = (-tl - 2.0*t - tr + bl + 2.0*b + br) * 0.5;

    // Store gradient as RG (red = X gradient, green = Y gradient)
    // Map from [-1, 1] to [0, 1] for storage in texture
    // Flip X for mirrored camera, flip Y for coordinate system (texture Y down, world Y up)
    gl_FragColor = vec4(-gradientX * 0.5 + 0.5, -gradientY * 0.5 + 0.5, 0.0, 1.0);
}
`;
