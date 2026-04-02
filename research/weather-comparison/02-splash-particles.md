# DigitalOcean Canvas Rain with Splash Particles (Joshua Hall, 2019)
Source: https://www.digitalocean.com/community/tutorials/js-canvas-animations-gravity

## Key Techniques for Splash Effects
1. **Particle class** — When a drop hits the bottom, spawn 5-15 small particles
2. **Random velocity vectors** — Each splash particle gets random dx (spread) and dy (upward arc)
3. **Gravity applied to particles** — dy increases each frame, creating natural arc trajectories
4. **Alpha fade** — Particles fade out as they age (reduce opacity over lifetime)
5. **Color variations** — Multiple shades of same color for depth illusion
6. **Ticker-based spawning** — New drops added at regular intervals using modulo counter

## Splash Implementation Pattern
```javascript
class Particle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.dx = (Math.random() - 0.5) * 4;  // random horizontal spread
    this.dy = Math.random() * -4;           // upward initial velocity
    this.gravity = 0.1;                     // gravity acceleration
    this.alpha = 1;                         // fade out
    this.radius = Math.random() * 2;
  }
  update() {
    this.dy += this.gravity;
    this.x += this.dx;
    this.y += this.dy;
    this.alpha -= 0.02;
  }
}
```

## Applicability to Our System
- Splash particles when drops hit bottom of screen — HIGH IMPACT, easy to implement
- Color variation for depth — already partially done in our system
- Gravity-based particle arcs — natural looking, low CPU cost
- Alpha fade on particles — prevents visual clutter
