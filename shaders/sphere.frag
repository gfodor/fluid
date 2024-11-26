#version 300 es

precision highp float;

// Replace 'varying' with 'in' in the fragment shader
in vec3 v_viewSpacePosition;
in vec3 v_viewSpaceNormal;
in float v_speed;
in vec4 v_color;

layout(location = 0) out vec4 outColor0;
layout(location = 1) out vec4 outColor1;

void main () {
    // First output: normal and depth info
    outColor0 = vec4(v_viewSpaceNormal.x, v_viewSpaceNormal.y, v_speed, v_viewSpacePosition.z);
    
    // Second output: color
    outColor1 = v_color;
}

