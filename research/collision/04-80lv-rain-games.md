# How Rain Works in Video Games — 80 Level
Source: https://80.lv/articles/how-rain-works-in-video-games

## Key Industry Insights

### 1. Splash on Impact is Essential
"Particles dropping from above might not be enough to create believable rain,
so make sure there's some splashing when they hit the ground."
— This applies equally to hitting an umbrella surface.

### 2. Amandine Coget's Professional Observations (Engine Programmer)
- "Code to calculate where the ground is so splashes are properly generated"
- Splashes need to be generated at the correct collision point
- Layer raindrop effects in order (depth)
- VFX and particle systems require coding assistance for proper collision

### 3. Fireblade Software's Optimization Trick (Abandon Ship)
"We spawned an insanely high amount of rain particles, took screenshots,
added this to the original texture and reimported it into the game."
— Visual density can be faked with layered rendering, not just more particles.

### 4. What Makes Rain "Great" (from the article's analysis)
- Reflections on wet surfaces
- Proper light reduction (darker atmosphere)
- Gradual wetness changes (not instant)
- Splash particles at impact points
- World reacts to rain (puddles, wet surfaces)

## Application to Our Umbrella Collision
The industry consensus is clear: collision response needs VISIBLE FEEDBACK.
When rain hits the umbrella, the player needs to SEE:
1. Impact splash at the collision point
2. Water flowing along the surface
3. Drips from the umbrella edge
4. The umbrella "blocking" rain creates a dry zone below it
