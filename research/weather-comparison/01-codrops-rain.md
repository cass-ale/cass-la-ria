# Codrops Rain & Water Effect (Lucas Bebber, 2015)
Source: https://tympanus.net/codrops/2015/11/04/rain-water-effect-experiments/

## Key Techniques That Make It Impressive
1. **Refraction simulation** — Raindrops flip/distort the background image behind them using normal-mapping-like technique
2. **Two-layer system** — Large drops tracked individually, small drops rendered on separate canvas (thousands of them)
3. **Drop merging physics** — Drops that are close merge together, and oversized drops fall leaving trails
4. **WebGL shaders** — Uses GLSL fragment shaders for per-pixel refraction calculation
5. **Alpha channel gooey effect** — Drops stick together using alpha blending technique
6. **Color-coded normals** — Red channel = Y position, Green channel = X position for refraction lookup

## What Makes It Better Than Basic Canvas Rain
- Background distortion through drops (not just opaque streaks)
- Drop-to-drop interaction (merging)
- Gravity-driven trail behavior
- Separate rendering layers for performance
- GPU-accelerated via WebGL

## Applicability to Our System
- Our system uses 2D Canvas, not WebGL — can't do refraction
- BUT: We can learn from the layering approach (separate small/large drops)
- The trail behavior and drop merging concepts could be adapted
- The performance optimization of not tracking small drops individually is smart
