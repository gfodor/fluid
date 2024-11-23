precision highp float;

varying vec2 v_coordinates;
uniform float u_frameNumber;

uniform sampler2D u_velocityTexture;

uniform vec3 u_gridResolution;

void main () {
    vec3 velocity = texture2D(u_velocityTexture, v_coordinates).rgb;
    vec3 cellIndex = floor(get3DFragCoord(u_gridResolution + 1.0));

    if (mod(u_frameNumber, 2000.0) > 1000.0) {
      // Calculate position in grid space
      vec3 position = cellIndex / u_gridResolution;
      
      // Calculate distance from center axis
      float dx = position.x - 0.5;
      float dy = position.y - 0.5;
      float distFromCenter = sqrt(dx * dx + dy * dy);
      
      // Calculate cylinder radius (slightly smaller than grid bounds)
      float cylinderRadius = 0.45;
      
      // If near cylinder wall, modify velocities
      if (distFromCenter > cylinderRadius - 0.02) {
          // Calculate normal vector pointing inward from cylinder wall
          vec2 normal = normalize(vec2(-dx, -dy));
          
          // Project velocity onto cylinder surface
          vec2 velocityXY = vec2(velocity.x, velocity.y);
          float dotProduct = dot(velocityXY, normal);
          
          // Calculate tangential component
          vec2 tangential = velocityXY - dotProduct * normal;
          
          // Apply damping to both normal and tangential components
          float normalDamping = 0.7;  // Slightly less bounce damping
          float tangentialDamping = 0.1; // Less friction - allow more sliding

          if (mod(u_frameNumber, 2000.0) > 1000.0) {
             normalDamping = 1.0;  // Slightly less bounce damping
             tangentialDamping = 1.0; // Less friction - allow more sliding
          }
          
          if (dotProduct < 0.0) {
              // For incoming velocity, reflect and damp
              velocityXY = tangential * tangentialDamping - dotProduct * normal * normalDamping;
          } else {
              // For parallel motion, apply reduced friction
              velocityXY = tangential * tangentialDamping;
          }
          
          velocity.x = velocityXY.x;
          velocity.y = velocityXY.y;
          
          // Reduced damping of z velocity near walls
          velocity.z *= 0.95;
      }
      
      // Handle Z boundaries with reduced friction
      if (cellIndex.z < 0.5) {
          velocity.z = max(velocity.z * 0.2, 0.0); // Less damping at bottom
          velocity.xy *= 0.85; // Reduced friction with bottom
      }
      if (cellIndex.z > u_gridResolution.z - 0.5) {
          velocity.z = min(velocity.z * 0.2, 0.0); // Less damping at top
          velocity.xy *= 0.85; // Reduced friction with top
      }
    } else {
      if (cellIndex.x < 0.5) {
          velocity.x = 0.0;
      }

      if (cellIndex.x > u_gridResolution.x - 0.5) {
          velocity.x = 0.0;
      }

      if (cellIndex.y < 0.5) {
          velocity.y = 0.0;
      }

      if (cellIndex.y > u_gridResolution.y - 0.5) {
          velocity.y = min(velocity.y, 0.0);
      }

      if (cellIndex.z < 0.5) {
          velocity.z = 0.0;
      }

      if (cellIndex.z > u_gridResolution.z - 0.5) {
          velocity.z = 0.0;
      }
    }
    
    gl_FragColor = vec4(velocity, 0.0);
}
