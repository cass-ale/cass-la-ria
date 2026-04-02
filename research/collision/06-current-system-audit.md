# Current Umbrella Collision System — Detailed Audit

## Architecture
- Umbrella is a CSS-styled Unicode character (☂, font-size 48px) positioned at mouse cursor
- Collision zone is a circle: center = (mouseX, mouseY), radius = 55px
- Only active on desktop (isDesktop = true)
- Mobile uses touch deflection (radial force push, no arc collision)

## Current applyUmbrellaDeflection() (lines 1413-1432)
```javascript
function applyUmbrellaDeflection(drop) {
    if (!mouseActive) return;
    var dx = drop.x - mouseX, dy = drop.y - mouseY;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > UMBRELLA_RADIUS || dist < 1) return;

    var angle = Math.atan2(dy, dx);
    if (angle > -Math.PI && angle < 0) {  // only top half of circle
      var nx = dx / dist, ny = dy / dist;
      var dot = drop.vx * nx + drop.vy * ny;
      if (dot < 0) {  // only if moving toward center
        drop.vx -= 1.6 * dot * nx;  // reflection with 1.6x restitution
        drop.vy -= 1.6 * dot * ny;
        drop.vx += randomRange(-0.3, 0.3);  // tiny random scatter
        drop.vy += randomRange(-0.1, 0.2);
        drop.x = mouseX + nx * (UMBRELLA_RADIUS + 2);  // push outside
        drop.y = mouseY + ny * (UMBRELLA_RADIUS + 2);
      }
    }
}
```

## Identified Weaknesses

### 1. NO VISUAL FEEDBACK ON IMPACT
- Drop just changes velocity — no splash, no drip, no visual cue
- Industry standard: impact should spawn micro-splash particles
- The splash system already exists (spawnSplash) but is ONLY used for ground impact

### 2. UNIFORM RESTITUTION (1.6x for all drops)
- Every drop bounces with exactly the same energy multiplier
- Real umbrella fabric absorbs some energy — coefficient should be < 1.0
- The 1.6x actually ADDS energy (drops speed up after hitting umbrella)
- Should vary based on impact angle (glancing vs direct hit)

### 3. ONLY TOP HALF COLLISION
- `angle > -Math.PI && angle < 0` means only the upper semicircle deflects
- This is correct for an umbrella (rain hits the top), but the boundary is sharp
- Drops at the equator (angle ≈ 0 or -π) pass through without any interaction
- Should have a soft transition zone at the edges

### 4. NO EDGE DRIP EFFECT
- When rain hits a real umbrella, water flows to the rim and DRIPS off the edge
- Currently: drops bounce away and continue falling as normal rain
- Missing: drip particles spawning at the umbrella rim (bottom edge of the arc)

### 5. RANDOM SCATTER IS TOO SMALL
- ±0.3 horizontal, -0.1 to +0.2 vertical
- This creates nearly uniform deflection regardless of where on the arc the drop hits
- Should vary based on collision position (center = more upward, edge = more sideways)

### 6. NO DEPTH LAYER AWARENESS
- Background drops (zLayer 0,1) are deflected the same as foreground drops
- Background drops should pass behind the umbrella (parallax) or have reduced interaction

### 7. NO WIND-RESPONSIVE DEFLECTION
- Deflection angle is purely based on collision normal
- Real deflection would be influenced by current wind direction
- Drops hitting the windward side should scatter differently than leeward side

### 8. TOUCH DEFLECTION IS BASIC RADIAL PUSH
- `force = (TOUCH_RADIUS - dist) / TOUCH_RADIUS` — linear falloff
- No arc collision, no splash, no drip
- Just pushes drops away from touch point

## Improvement Priority (by visual impact)
1. **Umbrella splash particles** — reuse existing splash system at collision point
2. **Edge drip particles** — new slow-falling particles from umbrella rim
3. **Proper reflection physics** — coefficient of restitution < 1, position-based angle
4. **Depth layer filtering** — background drops pass behind umbrella
5. **Wind-influenced deflection** — scatter follows wind direction
6. **Soft edge transition** — gradual interaction at arc boundary
