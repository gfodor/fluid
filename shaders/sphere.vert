#version 300 es

precision highp float;

// Specify attribute locations (optional but recommended)
layout(location = 0) in vec3 a_vertexPosition;
layout(location = 1) in vec3 a_vertexNormal;
layout(location = 2) in vec2 a_textureCoordinates;

// Uniforms
uniform mat4 u_projectionMatrix;
uniform mat4 u_viewMatrix;
uniform sampler2D u_positionsTexture;
uniform sampler2D u_velocitiesTexture;
uniform sampler2D u_particleColorTexture;
uniform float u_sphereRadius;
uniform float u_cylinderRadius;

// Outputs to the fragment shader
out vec4 v_color;
out vec3 v_viewSpacePosition;
out vec3 v_viewSpaceNormal;
out float v_speed;

void main () {
    // Sample the sphere position from the positions texture
    vec3 spherePosition = texture(u_positionsTexture, a_textureCoordinates).rgb;

    // Calculate the world-space position
    float compressionScaleFactor = 1.0 - (u_cylinderRadius / 0.45);
    float adjustedRadius = u_sphereRadius - (compressionScaleFactor * 0.15);
    vec3 position = a_vertexPosition * adjustedRadius + spherePosition;

    // Transform position to view space
    vec4 viewSpacePos = u_viewMatrix * vec4(position, 1.0);
    v_viewSpacePosition = viewSpacePos.xyz;

    // Transform normal to view space (assuming no non-uniform scaling in the view matrix)
    vec4 viewSpaceNorm = u_viewMatrix * vec4(a_vertexNormal, 0.0);
    v_viewSpaceNormal = viewSpaceNorm.xyz;

    // Compute gl_Position
    gl_Position = u_projectionMatrix * viewSpacePos;

    // Sample and pass the particle color
    v_color = texture(u_particleColorTexture, a_textureCoordinates);

    // Sample velocity and compute speed
    vec3 velocity = texture(u_velocitiesTexture, a_textureCoordinates).rgb;
    v_speed = length(velocity);
}

