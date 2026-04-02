# Surface Normal Calculation for 2D Curved Collision
Source: https://gamedev.stackexchange.com/questions/136073/

## The Reflection Formula
v_reflected = v - 2 * dot(v, n) * n

Where n is the surface normal at the collision point.

## Key Insight: For a Circle/Arc (Our Umbrella)
For a circular arc, the surface normal at any point is simply the normalized vector
from the circle center to that point. This is much simpler than for arbitrary polygons.

If umbrella center = (cx, cy) and collision point = (px, py):
  normal = normalize(px - cx, py - cy)

For our umbrella (which is an arc, not a full circle):
- The normal always points OUTWARD from the arc center
- Drops hitting the top of the arc get deflected outward/upward
- Drops hitting the sides get deflected sideways
- The deflection angle varies naturally based on WHERE on the curve the drop hits

## JavaScript Implementation (from Ryan Peschel's answer)
```javascript
function getCollisionNormal(cX, cY, rX, rY, rW, rH, rA) {
  // For a circle, this simplifies to:
  const deltaX = cX - centerX;
  const deltaY = cY - centerY;
  const magnitude = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  return { xDir: deltaX / magnitude, yDir: deltaY / magnitude };
}
```

## Application to Our Umbrella
Our umbrella is already a circle collision zone. The improvement is:
1. Instead of just pushing drops away, REFLECT their velocity using the surface normal
2. The reflection preserves momentum direction relative to the curve
3. Add energy loss (coefficient of restitution < 1) so drops slow down after deflection
4. Add tangential sliding component for drops that hit at shallow angles
