# Geoff Blair - Rain Effect in HTML5 Canvas (2016)
Source: https://www.geoffblair.com/blog/rain-effect-html5-canvas/

## Key Techniques
1. **Scale-linked properties** — velocity, length, and opacity all tied to a single random scale value
   - Fast drops = longer + more opaque (appear closer/foreground)
   - Slow drops = shorter + more transparent (appear farther/background)
   - This creates **depth illusion** without multiple canvases
2. **Wind velocity** — drops have both vx (wind) and vy (gravity) creating angled rain
3. **Object pooling** — drops are reset and reused, never destroyed/recreated (performance)
4. **Vector math for rendering** — drop line direction calculated from velocity vector, normalized and scaled
5. **compositeOperation: "lighter"** — additive blending makes overlapping drops glow brighter
6. **Linear interpolation (lerp)** — smooth scaling between min/max values for natural variation

## Critical Insight: Depth Through Correlated Properties
The single most impactful technique: using ONE random scale value to control ALL drop properties.
This creates a convincing sense of depth because our brain interprets:
- Faster + longer + brighter = closer
- Slower + shorter + dimmer = farther away

## Applicability to Our System
- **Correlated scale factor** — if not already doing this, this is a massive visual upgrade
- **Wind velocity (vx)** — adds dynamism, makes rain feel alive
- **Additive blending** — "lighter" composite operation for glow effect
- **Object pooling** — already done in our system (resetDrop pattern)


## Source Code Analysis (rain-demo.js)
Key constants and patterns from the actual source:

### Constants
- WIND_VELOCITY = -0.1 (slight leftward slant)
- DROP_COUNT = 200
- DROP_WIDTH = 1 (very thin)
- DROP_MIN/MAX_VELOCITY = 0.3 / 0.6
- DROP_MIN/MAX_LENGTH = 20 / 40
- DROP_MIN/MAX_ALPHA = 0.3 / 1.0

### Critical Pattern: Scale-Linked Properties
```javascript
var scale = Math.random(); // ONE random value
drop.vy = lerp(MIN_VEL, MAX_VEL, scale);  // speed
drop.l = lerp(MIN_LEN, MAX_LEN, scale);   // length
drop.a = lerp(MIN_ALPHA, MAX_ALPHA, scale); // opacity
```
All three properties tied to the SAME scale value = depth illusion.

### Rendering Technique
- Uses `compositeOperation = "lighter"` for additive blending (glow where drops overlap)
- Draws lines from velocity vector direction (not just vertical)
- Normalizes velocity vector then scales by length for proper angled rendering

### Fixed Timestep
- Uses FIXED_STEP = 16ms with accumulator pattern
- Prevents physics from breaking on slow frames
