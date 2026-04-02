# Cyanilux Rain Effects Breakdown — Professional Rain-Surface Interaction
Source: https://www.cyanilux.com/tutorials/rain-effects-breakdown/

## Key Techniques for Rain-Surface Interaction

### 1. Umbrella Rim Drip Particles
"The umbrella mesh has a small rim with another similar Particle System that spawns dripping raindrops.
It's the same setup, but I additionally used the Force Over Lifetime module with a Curve on the Y axis
to better control how the water drops (slower at beginning)."

Key insight: After rain hits the umbrella, it should DRIP from the edges. The drip starts slow
(surface tension holds it) then accelerates as gravity takes over. This is a Force Over Lifetime
curve — not instant velocity.

### 2. Surface Interaction Shader
"The umbrella shader has some dots & scrolling lines to suggest the rain is interacting with it."

Key insight: Even without complex physics, visual cues like dots appearing at impact points and
lines scrolling down the surface create the illusion of water flowing on the umbrella surface.

### 3. Water Ripples at Impact
Uses Voronoi-based ripple generation — each impact creates expanding circular ripples.
For our 2D canvas, this translates to: small expanding circles at impact points that fade out.

### 4. Splash Sub-Emitters
"While we could add collision to our particle system and use a sub-emitter to create ripple particles..."
Standard technique: when a rain particle collides with a surface, spawn child particles
(splash/ripple) at the collision point.

## Applicable to Our 2D Canvas System
1. **Edge drip particles** — When drops hit the umbrella, spawn slow-falling drip particles at the umbrella edge
2. **Impact micro-splashes** — Small upward particles at the collision point on the umbrella surface
3. **Surface flow lines** — Visual suggestion of water flowing down the umbrella curve
4. **Rim accumulation** — Drops collect at the lowest points of the umbrella rim before dripping
