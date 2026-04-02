# Current rain.js System Architecture Audit

## Architecture Summary (1421 lines)
The system is a single-file, IIFE-wrapped Canvas 2D animation with:
- Simplex noise engine (Stefan Gustavson)
- 6 cloud types with domain-warped noise rendering
- 7 weather presets (gentleMist → typhoon)
- Individual cloud entities with depth, drift, collision/merging
- Unicode character-based rain drops with pre-rendered sprites
- Umbrella cursor (desktop) / touch deflection (mobile)
- Device tilt support (iOS/Android)

## Wind System Analysis (lines 1206-1216)

### Current Implementation
```javascript
function updateWind(dtFactor) {
  if (activePreset.gustEnabled) {
    var n = Math.sin(timeAccum * 0.7 * gustFreq) * 0.5 +
            Math.sin(timeAccum * 1.3 * gustFreq) * 0.3 +
            Math.sin(timeAccum * 0.3 * gustFreq) * 0.2;
    targetWind = windSpeed + n * gustStrength;
  } else {
    targetWind = windSpeed;
  }
  currentWind = lerp(currentWind, targetWind, 0.02 * dtFactor);
}
```

### Problems Identified
1. **Three sine waves sum to a predictable, periodic pattern** — the combined signal repeats every ~9 seconds (LCM of the frequencies). Real wind never repeats.
2. **No noise component** — the system already has Simplex noise but doesn't use it for wind. This is the single biggest missed opportunity.
3. **Wind is always positive** — `windSpeed` is always positive in presets (0.15 to 3.5), so rain always falls in one direction. Real wind shifts direction.
4. **Gust envelope is missing** — real gusts build up fast and decay slowly (asymmetric). The sine waves create symmetric oscillation.
5. **No lull periods** — real wind has distinct calm periods between gusts. The current system oscillates continuously.
6. **Wind gradient is linear and simple** — `heightFactor = 0.3 + 0.7 * (1 - y/H)` is reasonable but could use noise for spatial variation.

## Rain Drop Analysis (lines 915-1281)

### Current Implementation
- Object pool of `Raindrop` instances
- Each drop has: x, y, vx, vy, char, opacity, windFactor, size, virgaDrop
- Spawning from cloud density map (good!)
- Bottom fade zone (15% of viewport)
- Virga effect (drops fade before reaching ground)
- Wind angle rotation on rendering

### Problems Identified
1. **No splash/impact effects** — drops simply fade out at the bottom. Every benchmark implementation has splashes.
2. **No depth/parallax layers** — all drops are the same "distance" from the viewer. Best implementations use 2-3 depth layers with different speeds, sizes, and opacities.
3. **No streak/trail effect** — drops are rendered as single characters. Real rain at speed creates motion blur streaks.
4. **Uniform opacity per drop** — no gradient along the drop length. Best implementations fade the trail.
5. **No mist/fog layer** — heavy rain creates a visible mist near the ground. Missing entirely.
6. **Character rotation is uniform** — all drops rotate by the same windAngle. Should vary per-drop for more organic feel.
7. **Drop width is uniform** — no variation in drop thickness/weight creates a flat look.

## Cloud System Analysis (lines 441-884)

### Strengths (already good)
- Individual cloud entities with unique noise seeds ✓
- Domain-warped noise for organic shapes ✓
- Depth layers with opacity variation ✓
- Cloud merging/bridging (Westcott 1994) ✓
- Z-axis approach/recede ✓
- Size breathing ✓
- Character density mapping ✓

### Weaknesses
- Cloud rendering is already quite sophisticated — improvement here is marginal
- Could benefit from wind-responsive shape distortion (clouds stretch in wind direction)

## Visual Limitation Priority Ranking (Impact × Feasibility)

| Rank | Improvement | Impact | Effort | Score |
|------|-------------|--------|--------|-------|
| 1 | Realistic wind with Perlin noise + gust envelope | 10/10 | Medium | 95 |
| 2 | Splash/impact particles at ground level | 9/10 | Medium | 85 |
| 3 | Rain depth layers (foreground/background) | 8/10 | Low | 80 |
| 4 | Ground mist/fog layer during heavy presets | 7/10 | Medium | 70 |
| 5 | Motion blur / streak trails on drops | 7/10 | Low | 65 |
| 6 | Wind direction shifts (not always same direction) | 6/10 | Low | 60 |
| 7 | Per-drop rotation variance | 4/10 | Low | 40 |
| 8 | Cloud wind-responsive distortion | 3/10 | Medium | 25 |
