# Lightning Storm with Rain - Canvas (Nvagelis, CodePen)
Source: https://codepen.io/Nvagelis/pen/yaQGAL

## Key Architecture: 3 Separate Canvases
- canvas1: Background rain layer (500 "rain trough" drops — thin, fast, background)
- canvas2: Foreground rain layer (500 drops — thicker, slower, foreground)
- canvas3: Lightning flashes (separate layer for compositing)

## Key Techniques
1. **Dual rain layers** — "RainTrough" (background, speed 25) vs "Rain" (foreground, different params)
   - Creates parallax depth without complex math
2. **Lightning as separate canvas** — Can use different blend modes and opacity
3. **Lightning timing** — lightTimeCurrent vs lightTimeTotal for random flash intervals
4. **CSS body class "thunder"** — CSS animation for screen flash effect during lightning

## Critical Insight: Layer Separation
Using multiple canvases is a common pattern in high-quality rain effects:
- Each layer can have different composite operations
- Layers can be independently cleared/updated
- Background rain can be lower fidelity (thinner, faster) for performance
- Foreground rain gets more detail (thicker, slower, more visible)

## Applicability
- Our system uses a single canvas — could benefit from foreground/background rain layers
- Lightning flashes could be a dramatic addition (optional)
- The dual-layer approach is the simplest way to add depth perception
