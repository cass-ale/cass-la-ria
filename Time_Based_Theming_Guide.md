# Time-Based Color Theming Guide

This document outlines the design, color theory, and technical implementation plan for introducing time-dependent color schemes to the Cass la Ria website. The goal is to create a dynamic, living environment that shifts its mood throughout the day while maintaining the core elegant, rose-tinted aesthetic.

## Color Theory and Atmospheric Scattering

The progression of colors throughout the day is driven by Rayleigh scattering. As the sun approaches the horizon at dawn and dusk, its light passes through a thicker layer of the Earth's atmosphere. Shorter blue wavelengths are scattered away, leaving longer warm wavelengths (reds, oranges, and yellows) to reach the observer [1]. 

To translate this physical phenomenon into a cohesive digital design system, the proposed palettes treat the site's current signature rose pink (`#f2d4d7`) as the "High Noon" baseline. From there, the palettes shift cooler (lavender/mauve) during low-light transitions and warmer (amber/coral) during direct-sun transitions, eventually inverting contrast entirely for the night hours.

## The 8-Phase Daily Cycle

The day is divided into eight distinct atmospheric phases. Each phase maintains the core structural contrast required for readability while shifting the emotional tone.

### 1. Witching Hour (1:00 AM – 5:00 AM)
The deepest, most mysterious part of the night. The background is near-black with subtle violet undertones (`#120e18`), while the text and accents glow in muted, pale rose (`#d8c8d0`). This creates maximum contrast inversion without resorting to harsh pure black and white.

### 2. Dawn (5:00 AM – 7:00 AM)
The sky before sunrise, characterized by cool, purple-grey light filtering through clouds. The background shifts to a cool lavender mist (`#e0d4e8`), with deep violet-black text (`#2d2235`) and muted purple accents (`#7b4a8a`).

### 3. Morning (7:00 AM – 11:00 AM)
Warm golden light washing over the landscape. The palette warms up significantly to a peach-pink (`#f5ddd4`), paired with warm dark brown text (`#2d221f`) and terracotta rose accents (`#a0523c`).

### 4. Midday (11:00 AM – 3:00 PM)
The current default palette. Bright, clear, and fully saturated in the signature soft blush pink (`#f2d4d7`) with deep plum text (`#2a1f2d`) and dark magenta accents (`#8b3a62`).

### 5. Golden Hour (3:00 PM – 5:00 PM)
Late afternoon sun painting everything in warm gold. The background deepens to a rich amber-rose (`#f0d0b8`), with deep warm brown text (`#2e1f18`) and burnt sienna accents (`#a04428`).

### 6. Sunset (5:00 PM – 7:00 PM)
The most dramatic daytime phase. The sky is on fire before darkness falls. The palette shifts to deep coral and burnt rose (`#e8c0b0`), with near-black warm text (`#2a1818`) and deep coral-red accents (`#a83030`).

### 7. Dusk / Twilight (7:00 PM – 9:00 PM)
The last light fading into purple shadows. The background cools into a dusty mauve (`#c8b0c8`), with deep blue-violet text (`#1e1828`) and twilight purple accents (`#6e3878`).

### 8. Night (9:00 PM – 1:00 AM)
True darkness falls. The contrast inverts again, with a deep plum-navy background (`#1e1828`) and light rose-white text (`#e0d0d8`). The accents become a glowing neon rose (`#c070a0`).

## Technical Implementation Plan

The implementation relies entirely on native CSS Custom Properties (variables) and a lightweight JavaScript controller, avoiding any external libraries or heavy frameworks [2].

### Step 1: CSS Architecture

The current `variables.css` file will be restructured. The `:root` selector will define the default (Midday) variables, while data attributes on the `<html>` element will override these variables for specific times of day.

```css
/* Default (Midday) */
:root {
  --color-bg: #f2d4d7;
  --color-text: #2a1f2d;
  --color-accent: #8b3a62;
  /* ... other variables ... */
}

/* Dawn Override */
html[data-time-theme="dawn"] {
  --color-bg: #e0d4e8;
  --color-text: #2d2235;
  --color-accent: #7b4a8a;
}

/* Night Override */
html[data-time-theme="night"] {
  --color-bg: #1e1828;
  --color-text: #e0d0d8;
  --color-accent: #c070a0;
}
```

### Step 2: Smooth Transitions

To ensure the site doesn't abruptly snap between colors if a user is browsing exactly when a time boundary is crossed, a global transition will be applied to the background and text colors.

```css
body {
  background-color: var(--color-bg);
  color: var(--color-text);
  transition: background-color 3s ease, color 3s ease;
}
```

### Step 3: JavaScript Controller

A lightweight script will run immediately in the `<head>` to prevent a flash of incorrect colors (FOUC) on initial load. It will check the user's local time and apply the correct data attribute.

```javascript
(function() {
  function updateTimeTheme() {
    const hour = new Date().getHours();
    let theme = 'midday'; // default
    
    if (hour >= 1 && hour < 5) theme = 'witching-hour';
    else if (hour >= 5 && hour < 7) theme = 'dawn';
    else if (hour >= 7 && hour < 11) theme = 'morning';
    else if (hour >= 11 && hour < 15) theme = 'midday';
    else if (hour >= 15 && hour < 17) theme = 'golden-hour';
    else if (hour >= 17 && hour < 19) theme = 'sunset';
    else if (hour >= 19 && hour < 21) theme = 'dusk';
    else if (hour >= 21 || hour < 1) theme = 'night';
    
    document.documentElement.setAttribute('data-time-theme', theme);
  }
  
  // Run immediately
  updateTimeTheme();
  
  // Check every minute in case the user leaves the tab open
  setInterval(updateTimeTheme, 60000);
})();
```

## Performance and Accessibility Considerations

This approach is highly performant. Changing CSS custom properties does not trigger layout recalculations, only repaints, which are handled efficiently by modern browsers [3]. 

From an accessibility standpoint, every proposed palette has been designed to maintain a minimum contrast ratio of 4.5:1 between the text and background colors, ensuring compliance with WCAG AA standards for normal text. The inversion of contrast during the Night and Witching Hour phases also acts as a natural "Dark Mode," reducing eye strain for users browsing in low-light environments.

---

## References

[1] User Experience Stack Exchange. "What algorithm to use to change colors on dusk / dawn?" https://ux.stackexchange.com/questions/49063/what-algorithm-to-use-to-change-colors-on-dusk-dawn

[2] DEV Community. "Set the theme of a website based on the time of the day (no external library)." https://dev.to/mohsenkamrani/set-the-theme-of-a-website-based-on-the-time-of-the-day-no-external-library-5ank

[3] Smashing Magazine. "CSS GPU Animation: Doing It Right." https://www.smashingmagazine.com/2016/12/gpu-animation-doing-it-right/
