//advects particle positions with second order runge kutta
//and constrains particles to a cylinder

varying vec2 v_coordinates;

uniform sampler2D u_positionsTexture;
uniform sampler2D u_randomsTexture;

uniform sampler2D u_velocityGrid;

uniform vec3 u_gridResolution;
uniform vec3 u_gridSize;

uniform float u_timeStep;

uniform float u_frameNumber;
uniform float u_cylinderRadius;
uniform int u_matched;

uniform vec2 u_particlesResolution;

float sampleXVelocity (vec3 position) {
    vec3 cellIndex = vec3(position.x, position.y - 0.5, position.z - 0.5);
    return texture3D(u_velocityGrid, (cellIndex + 0.5) / (u_gridResolution + 1.0), u_gridResolution + 1.0).x;
}

float sampleYVelocity (vec3 position) {
    vec3 cellIndex = vec3(position.x - 0.5, position.y, position.z - 0.5);
    return texture3D(u_velocityGrid, (cellIndex + 0.5) / (u_gridResolution + 1.0), u_gridResolution + 1.0).y;
}

float sampleZVelocity (vec3 position) {
    vec3 cellIndex = vec3(position.x - 0.5, position.y - 0.5, position.z);
    return texture3D(u_velocityGrid, (cellIndex + 0.5) / (u_gridResolution + 1.0), u_gridResolution + 1.0).z;
}

vec3 sampleVelocity (vec3 position) {
    vec3 gridPosition = (position / u_gridSize) * u_gridResolution;
    return vec3(sampleXVelocity(gridPosition), sampleYVelocity(gridPosition), sampleZVelocity(gridPosition));
}

// Function to constrain a point to a cylinder
vec3 constrainToCylinder(vec3 position) {
    // Calculate cylinder radius based on grid size (slightly smaller than min box width)
    float cylinderRadius = min(u_gridSize.x, u_gridSize.y) * u_cylinderRadius;
    
    // Get distance from Z axis
    float dx = position.x - u_gridSize.x * 0.5;
    float dy = position.y - u_gridSize.y * 0.5;
    float distFromCenter = sqrt(dx * dx + dy * dy);
    
    // If outside cylinder radius, project back to surface
    if (distFromCenter > cylinderRadius) {
        float angle = atan(dy, dx);
        position.x = u_gridSize.x * 0.5 + cylinderRadius * cos(angle);
        position.y = u_gridSize.y * 0.5 + cylinderRadius * sin(angle);
    }
    
    // Constrain Z position
    position.z = clamp(position.z, 0.01, u_gridSize.z - 0.01);
    
    return position;
}

void main () {
    vec3 position = texture2D(u_positionsTexture, v_coordinates).rgb;
    vec3 randomDirection = texture2D(u_randomsTexture, fract(v_coordinates + u_frameNumber / u_particlesResolution)).rgb;

    vec3 velocity = sampleVelocity(position);

    vec3 halfwayPosition = position + velocity * u_timeStep * 0.5;
    vec3 halfwayVelocity = sampleVelocity(halfwayPosition);

    vec3 step = halfwayVelocity * u_timeStep;

    step += 0.05 * randomDirection * length(velocity) * u_timeStep;

    vec3 newPosition = position + step;
   
    newPosition = mix(clamp(newPosition, vec3(0.01), u_gridSize - 0.01), constrainToCylinder(newPosition), float(u_matched));

    gl_FragColor = vec4(newPosition, 0.0);
}
