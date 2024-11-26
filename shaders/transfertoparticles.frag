precision highp float;

varying vec2 v_coordinates;

uniform sampler2D u_particlePositionTexture;
uniform sampler2D u_particleVelocityTexture;

uniform sampler2D u_gridVelocityTexture;
uniform sampler2D u_originalGridVelocityTexture;

uniform vec3 u_gridResolution;
uniform vec3 u_gridSize;

uniform float u_flipness; // Original FLIP/PIC ratio

const float MAX_VELOCITY = 50.0;

float sampleXVelocity (sampler2D texture, vec3 position) {
    vec3 cellIndex = vec3(position.x, position.y - 0.5, position.z - 0.5);
    return texture3D(texture, (cellIndex + 0.5) / (u_gridResolution + 1.0), u_gridResolution + 1.0).x;
}

float sampleYVelocity (sampler2D texture, vec3 position) {
    vec3 cellIndex = vec3(position.x - 0.5, position.y, position.z - 0.5);
    return texture3D(texture, (cellIndex + 0.5) / (u_gridResolution + 1.0), u_gridResolution + 1.0).y;
}

float sampleZVelocity (sampler2D texture, vec3 position) {
    vec3 cellIndex = vec3(position.x - 0.5, position.y - 0.5, position.z);
    return texture3D(texture, (cellIndex + 0.5) / (u_gridResolution + 1.0), u_gridResolution + 1.0).z;
}

vec3 sampleVelocity (sampler2D texture, vec3 position) {
    return vec3(sampleXVelocity(texture, position), sampleYVelocity(texture, position), sampleZVelocity(texture, position));
}

void main () {
    vec3 particlePosition = texture2D(u_particlePositionTexture, v_coordinates).rgb;
    particlePosition = (particlePosition / u_gridSize) * u_gridResolution;

    vec3 particleVelocity = texture2D(u_particleVelocityTexture, v_coordinates).rgb;

    vec3 currentVelocity = sampleVelocity(u_gridVelocityTexture, particlePosition);
    vec3 originalVelocity = sampleVelocity(u_originalGridVelocityTexture, particlePosition);

    vec3 velocityChange = currentVelocity - originalVelocity;

    // Add velocity damping
    float velocityDamping = 1.0; // Try values between 0.8 and 0.99
    velocityChange *= velocityDamping;

    // Modify FLIP/PIC ratio to favor PIC more
    float modifiedFlipness = u_flipness * 1.0; // Reduce FLIP influence by half

    vec3 flipVelocity = particleVelocity + velocityChange;
    vec3 picVelocity = currentVelocity;

    vec3 newVelocity = mix(picVelocity, flipVelocity, modifiedFlipness);

    // Add velocity clamping
    float speed = length(newVelocity);
    if (speed > MAX_VELOCITY) {
        newVelocity *= (MAX_VELOCITY / speed);
    }

    gl_FragColor = vec4(newVelocity, 0.0);
}
