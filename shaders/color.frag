precision highp float;

varying vec2 v_coordinates;

uniform sampler2D u_particleColorTexture;   // Current particle colors
uniform sampler2D u_targetColorTexture;     // Target image (cat, etc)
uniform sampler2D u_positionTexture;        // Particle positions
uniform float u_blendRate;                  // How fast to blend to target (0-1)
uniform vec3 u_gridSize;                    // To normalize coordinates
uniform int u_matched;
uniform float u_cylinderRadius;

void main() {
    float imageScaleFactor = u_cylinderRadius / 0.45;

    // Get current particle color
    vec4 currentColor = texture2D(u_particleColorTexture, v_coordinates);
    
    // Get particle position
    vec3 position = texture2D(u_positionTexture, v_coordinates).xyz;
    
    // Convert world XY position to 0-1 range for sampling target image
    vec2 targetCoord = (position.xy / u_gridSize.xy);

    targetCoord = ((targetCoord - 0.5) * (1.0 / imageScaleFactor)) + 0.5;
    
    // Sample target image with nearest neighbor
    vec4 targetColor = mix(currentColor, texture2D(u_targetColorTexture, targetCoord), float(u_matched));
    
    // Blend towards target color
    vec4 newColor = mix(currentColor, targetColor, u_blendRate);
    
    gl_FragColor = newColor;
}
