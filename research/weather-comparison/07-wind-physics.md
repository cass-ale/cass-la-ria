# Real-World Wind Physics Research

## 1. Turbulence Model (APS Physics, Bandi 2017)
Source: https://physics.aps.org/articles/v10/s5

The wind changes from minute to minute and hour to hour. The longer the time separation (Δt), the greater the wind-speed change. This is due to correlated motion inside turbulent air masses called "eddies." Turbulence models predict that the distribution of wind-speed variations is proportional to Δt^(2/3).

Key insight for simulation: Wind speed doesn't change randomly — it follows a correlated pattern where:
- Short-term changes are small (gusts are gradual, not instant)
- Long-term changes are larger (wind can shift significantly over minutes)
- The pattern follows a power law (Δt^(2/3))

## 2. Simulation Implication: Perlin Noise
The Δt^(2/3) power law is remarkably similar to the spectral properties of Perlin noise, which also produces correlated variations over time. This is why Perlin noise is the industry standard for simulating natural wind in games and visual effects.

## Beaufort Scale (for reference — what different wind speeds look like)
- Force 0 (Calm): < 1 mph — smoke rises vertically
- Force 1 (Light air): 1-3 mph — smoke drift shows wind direction
- Force 2 (Light breeze): 4-7 mph — leaves rustle, wind felt on face
- Force 3 (Gentle breeze): 8-12 mph — leaves and small twigs in motion
- Force 4 (Moderate breeze): 13-18 mph — small branches move, dust/paper raised
- Force 5 (Fresh breeze): 19-24 mph — small trees sway
- Force 6 (Strong breeze): 25-31 mph — large branches in motion, umbrellas difficult

For our rain animation, we want to simulate Force 2-4 range (light to moderate breeze) with occasional gusts to Force 5.


## 3. Horizon Zero Dawn Wind System (Gilbert Sanders, Guerrilla Games)
Source: https://gajatixstudios.co.uk/news/bright-life-devlog-the-secrets-behind-aaa-wind-simulation-in-opengl/

The AAA standard for wind simulation uses a **three-tiered layered system**:

### Layer 1: Large-Scale Motion (Global Wind)
A sine wave driven by elapsed time creates the base wind direction. The problem with a single sine wave is uniformity — everything sways identically. Fix: use each object's position to create a unique "Wind Factor" by dividing coordinates by a Wave Length factor, so objects traverse the sine wave at different intervals. This creates a wave-like propagation effect.

### Layer 2: Medium-Scale Motion (Side-to-Side Sway)
Two additional sine waves on X and Z axes create a figure-of-eight motion pattern. This prevents the unrealistic "everything moves in one direction" look. Combined with the large-scale motion, it creates a decent-looking simulation.

### Layer 3: Small-Scale Jitter (Turbulence)
Emulates turbulence — the "rustling" effect. Uses another sine function but moves objects along their normal vector instead of the wind direction. Makes objects look like they're "breathing." Each layer is weird by itself but combined they create convincing wind.

### Breaking Uniformity: Noise
The final critical step: multiply all motion by a noise function (Perlin/Simplex noise) to break up the uniform sine wave patterns. This creates the organic, unpredictable feel of real wind where some areas gust while others are calm.

## 4. Practical Wind Simulation Formula for 2D Rain

For our 2D canvas rain, the three-tiered approach translates to:

**Layer 1 — Base Wind:** `sin(time * 0.0003) * baseStrength` — slow oscillation (period ~20 seconds)
**Layer 2 — Gusts:** `sin(time * 0.002) * gustStrength * gustEnvelope` — faster oscillation with amplitude envelope
**Layer 3 — Turbulence:** `perlinNoise(time * 0.01) * jitterStrength` — high-frequency random variation

Combined: `windForce = layer1 + layer2 + layer3`

The gust envelope is key — real gusts don't just oscillate, they build up and die down. A good pattern:
- Gust builds over 2-4 seconds
- Peaks for 1-2 seconds
- Fades over 3-5 seconds
- Calm period of 5-15 seconds before next gust


## 5. Simple 1D Noise Implementation (Michael Bromley, 2014)
Source: https://www.michaelbromley.co.uk/blog/simple-1d-noise-in-javascript/

Lightweight 1D noise function perfect for wind simulation. Uses smoothstep interpolation between random values to create smooth, natural-looking variation. Key advantage: no external library needed, ~30 lines of code.

```javascript
var Simple1DNoise = function() {
  var MAX_VERTICES = 256;
  var MAX_VERTICES_MASK = MAX_VERTICES - 1;
  var amplitude = 1;
  var scale = 1;
  var r = [];
  for (var i = 0; i < MAX_VERTICES; ++i) {
    r.push(Math.random());
  }
  var getVal = function(x) {
    var scaledX = x * scale;
    var xFloor = Math.floor(scaledX);
    var t = scaledX - xFloor;
    var tRemapSmoothstep = t * t * (3 - 2 * t);
    var xMin = xFloor & MAX_VERTICES_MASK;
    var xMax = (xMin + 1) & MAX_VERTICES_MASK;
    var y = lerp(r[xMin], r[xMax], tRemapSmoothstep);
    return y * amplitude;
  };
  var lerp = function(a, b, t) {
    return a * (1 - t) + b * t;
  };
  return {
    getVal: getVal,
    setAmplitude: function(newAmplitude) { amplitude = newAmplitude; },
    setScale: function(newScale) { scale = newScale; }
  };
};
```

Usage: `var noise = new Simple1DNoise(); noise.setScale(0.01); var windValue = noise.getVal(time);`

## 6. Combined Wind Model for Our Rain System

The final wind model combines all research into a practical formula:

```
// Three layers inspired by Horizon Zero Dawn
baseWind = sin(time * 0.0003) * BASE_STRENGTH           // ~20s cycle
gustWind = sin(time * 0.002) * GUST_STRENGTH * envelope  // ~3s cycle with envelope
turbulence = noise1D(time * 0.008) * TURB_STRENGTH       // Perlin noise jitter

// Gust envelope: builds up, peaks, fades out, long pause
envelope = smoothGustCycle(time)  // 0 to 1 value

totalWind = baseWind + gustWind + turbulence
```

This creates wind that:
1. Has a slow underlying direction shift (base)
2. Has periodic gusts that build and fade naturally (gust + envelope)
3. Has constant micro-variation that prevents mechanical feel (turbulence)


## 7. Real-World Wind Gust Characteristics (Meteorological Data)

### Gust Duration
- Wind gusts are defined as short-lasting fortified winds lasting **3 to 20 seconds** [1][2]
- The standard meteorological gust measurement is a **3-second peak** [3]
- A gust is followed by a **lull** (slackening) in wind speed [2]
- Gusts must exceed sustained speed by at least **10 knots (11.5 mph)** to be classified as gusts [4]

### Gust Factor
- The **gust factor** (GF) = ratio of peak gust to sustained wind speed
- Typical GF ranges from **1.3 to 2.0** depending on terrain roughness [5]
- Over open terrain: GF ≈ 1.4-1.6
- Over rough terrain (urban): GF ≈ 1.6-2.0

### Gust Cycle Pattern (for simulation)
Based on the research, a realistic gust cycle looks like:
1. **Lull period:** 5-30 seconds of relatively calm wind
2. **Gust onset:** Wind builds over 1-3 seconds
3. **Gust peak:** Maximum speed sustained for 3-5 seconds
4. **Gust decay:** Wind drops over 2-5 seconds
5. **Return to lull**

The key insight: gusts are NOT symmetric — they tend to **build faster than they decay** (sharp onset, gradual fade).

### Sources
[1] https://fesstval.de/en/campaign/wind-gusts
[2] https://en.wikipedia.org/wiki/Wind_gust
[3] https://onlinelibrary.wiley.com/doi/10.1155/2024/9970264
[4] https://www.guidewire.com/hazardhub/wind-risk/wind-gusts-vs-wind-speed
[5] https://journals.ametsoc.org/view/journals/apme/56/12/jamc-d-17-0133.1.xml
