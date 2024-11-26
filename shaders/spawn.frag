precision highp float;

uniform sampler2D u_colorTexture;
uniform float u_time;
uniform int u_particlesToSpawn;
uniform vec2 u_resolution;

varying vec2 v_coordinates;

void main() {
    vec4 color = texture2D(u_colorTexture, v_coordinates);
    
    // Calculate particle index
    float index = v_coordinates.y * u_resolution.x + v_coordinates.x;
    
    // Determine if this particle should be spawned this frame
    if (index < float(u_particlesToSpawn)) {
        color.a = 1.0; // Activate particle
    } else {
        color.a = 0.0;
    }
    
    gl_FragColor = color;
}
