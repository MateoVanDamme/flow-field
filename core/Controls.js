import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

export function setupControls(config, stats, callbacks = {}) {
    const gui = new GUI();

    gui.add(config, 'perlinScale', 0.001, 0.01, 0.001)
        .name('Perlin Scale')
        .onChange((value) => {
            config.perlinScale = value;
            callbacks.onPerlinScaleChange?.(value);
        });

    gui.add(config, 'flowSpeed', 0.1, 40, 0.1)
        .name('Flow Speed')
        .onChange((value) => {
            config.flowSpeed = value;
            callbacks.onFlowSpeedChange?.(value);
        });

    gui.add(config, 'trailDecay', 0.1, 50, 0.1)
        .name('Trail Decay')
        .onChange((value) => {
            config.trailDecay = value;
            callbacks.onTrailDecayChange?.(value);
        });

    gui.add(config, 'particleSize', 0.5, 5.0, 0.01)
        .name('Particle Size')
        .onChange((value) => {
            config.particleSize = value;
            callbacks.onParticleSizeChange?.(value);
        });

    // Camera influence control (optional, only if present in config)
    if ('cameraInfluence' in config) {
        gui.add(config, 'cameraInfluence', 0, 10, 0.1)
            .name('Camera Influence');
    }

    // Motion threshold control (optional)
    if ('motionThreshold' in config) {
        gui.add(config, 'motionThreshold', 0.0, 1.0, 0.01)
            .name('Motion Threshold')
            .onChange((value) => {
                config.motionThreshold = value;
                callbacks.onMotionThresholdChange?.(value);
            });
    }

    // Arrow visualization toggle (optional)
    if ('showArrows' in config) {
        gui.add(config, 'showArrows')
            .name('Show Arrows')
            .onChange((value) => {
                config.showArrows = value;
                callbacks.onShowArrowsChange?.(value);
            });
    }

    gui.add(config, 'particleCount')
        .name('Particle Count')
        .disable();

    // Keyboard shortcut to toggle GUI and Stats
    window.addEventListener('keydown', (e) => {
        if (e.key === 'd' || e.key === 'D') {
            if (gui._hidden) {
                gui.show();
                stats.dom.style.display = 'block';
            } else {
                gui.hide();
                stats.dom.style.display = 'none';
            }
        }
    });

    return gui;
}
