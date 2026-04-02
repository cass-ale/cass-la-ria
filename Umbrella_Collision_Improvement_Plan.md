# Umbrella Collision Improvement Plan

## 1. Executive Summary
The current umbrella collision system in `rain.js` uses a basic radial deflection model that pushes raindrops away from the cursor. While functional, it lacks the visual feedback and physical realism found in professional game development and high-end interactive websites. Based on research into AAA game rain systems (e.g., *Batman: Arkham Knight*, *The Cycle: Frontier*) and physics-based 2D collision models, this plan outlines a comprehensive upgrade to the umbrella interaction that will significantly enhance the realism and "wetness" of the weather system.

## 2. Research Findings & Industry Standards
Professional rain-surface interaction relies on several key visual and physical cues [1] [2]:
- **Impact Splashes:** Raindrops must generate visible micro-splashes at the exact point of collision.
- **Energy Loss (Restitution):** Surfaces absorb energy; raindrops should not bounce off an umbrella faster than they hit it.
- **Surface Flow & Edge Dripping:** Water accumulates on curved surfaces and drips from the lowest points (the rim).
- **Depth Awareness:** Background rain should not interact with foreground objects.
- **Wind Influence:** Deflection angles should be affected by the prevailing wind direction.

## 3. Current Implementation Gaps
An audit of the existing `applyUmbrellaDeflection()` function reveals several shortcomings:
- **No Visual Feedback:** Drops simply change velocity upon impact; there are no splash particles generated on the umbrella surface.
- **Unrealistic Restitution:** The current reflection multiplier is `1.6x`, which actually *adds* energy to the drops, causing them to ricochet unnaturally fast.
- **Uniform Deflection:** The random scatter (`±0.3` horizontal, `-0.1` to `+0.2` vertical) is too small and uniform, failing to account for where on the curve the drop hits.
- **No Depth Filtering:** Drops in the background layers (zLayer 0 and 1) collide with the umbrella just like foreground drops, breaking the parallax illusion.
- **Missing Edge Drips:** There is no mechanism for water to drip from the edges of the umbrella.

## 4. Proposed Improvements

### A. Physics & Deflection Upgrades
1. **Depth Filtering:** Only apply collision to foreground drops (`zLayer === 2`). Midground and background drops will pass behind the umbrella, enhancing the 3D volumetric effect.
2. **Realistic Restitution:** Reduce the reflection multiplier from `1.6` to `0.4 - 0.6`. This simulates the energy absorption of the umbrella fabric, causing drops to slide or fall more naturally after impact.
3. **Surface Normal Reflection:** Implement proper 2D surface normal reflection (`v_reflected = v - 2 * dot(v, n) * n`) so that drops hitting the top bounce upward, while drops hitting the sides deflect tangentially.
4. **Wind-Influenced Scatter:** Add the current wind velocity to the post-collision scatter, so drops are blown away from the umbrella in the direction of the wind.

### B. Visual Feedback Additions
1. **Impact Splashes:** Utilize the existing `spawnSplash()` function to generate 1-2 micro-splash particles at the exact `(x, y)` coordinate where a foreground drop hits the umbrella curve.
2. **Edge Drip Particles:** Create a new behavior where drops that hit the outer edges of the umbrella (angles close to `0` or `-Math.PI`) have a chance to spawn slow-falling "drip" particles that simulate water running off the rim.

## 5. Implementation Strategy
The changes will be localized to the `applyUmbrellaDeflection()` function in `rain.js`. The existing splash particle pool will be leveraged to minimize performance overhead.

**Step 1:** Add depth filtering (`if (drop.zLayer !== 2) return;`).
**Step 2:** Calculate the exact collision point on the umbrella circumference.
**Step 3:** Apply the updated reflection math with reduced restitution and wind influence.
**Step 4:** Trigger `spawnSplash()` at the collision point.
**Step 5:** Add logic for edge drips based on the collision angle.

## References
[1] Cyanilux. "Rain Effects Breakdown." Cyanilux Shader Tutorials. https://www.cyanilux.com/tutorials/rain-effects-breakdown/
[2] Rock Paper Shotgun. "An extremely thorough grading of the best rain in video games." https://www.rockpapershotgun.com/an-extremely-thorough-grading-of-the-best-rain-in-video-games
