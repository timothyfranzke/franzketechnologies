# Franzke Technologies - Styling Guide

This document outlines the styling approach for the Franzke Technologies website. Reference this for maintaining consistency across the site.

## Color Palette

### Primary Colors (Navy)
- `--color-navy-900: #0a0a1f` - Darkest, used for deep backgrounds
- `--color-navy-800: #12122e` - Dark backgrounds
- `--color-navy-700: #1a1a4e` - Mid-tone navy
- `--color-navy-600: #2d2d6e` - Lighter navy accents

### Accent Colors (Electric Blue)
- `--color-electric-400: #5ee7ff` - Light electric blue (hover states)
- `--color-electric-500: #00d4ff` - Primary electric blue (buttons, links, accents)
- `--color-electric-600: #00a8cc` - Darker electric blue

### Accent Colors (Purple)
- `--color-purple-400: #a78bfa` - Light purple
- `--color-purple-500: #8b5cf6` - Primary purple
- `--color-purple-600: #7c3aed` - Dark purple

### Legacy Teal (Maps to Electric Blue)
The original teal colors are mapped to electric blue for backward compatibility:
- `--color-teal-400` → `#5ee7ff`
- `--color-teal-500` → `#00d4ff`
- `--color-teal-600` → `#00a8cc`

## Typography

### Font Families
- **Display/Headings:** Bebas Neue (uppercase, letter-spacing: 0.02em)
- **Body:** Poppins (weights: 300, 400, 500, 600, 700)

### Heading Styles
All headings (h1-h6) use:
- Font: Bebas Neue
- Text transform: uppercase
- Letter spacing: 0.02em

### Section Labels
Small labels above section headings:
```css
.section-label {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: #00d4ff; /* electric blue */
}
```

## Background Patterns

### Main Hero/Site Background
The site uses a continuous dark gradient with a parallax node pattern:

```css
.hero-section {
  background: linear-gradient(135deg, #0a0a1f 0%, #1a1a4e 40%, #2d1a4e 70%, #0a0a1f 100%);
}

.hero-section::before {
  background-image: url('/bg_nodes.png');
  background-attachment: fixed; /* parallax effect */
  opacity: 0.4;
}
```

### Animated Background Shapes
Floating gradient blobs in the background:
- Electric blue and purple gradients
- Blur filter: 80px
- Opacity: 0.15
- Subtle floating animations (20-35s duration)

## Component Styles

### Service Cards (Metallic Border)
Cards use a conic gradient border for a metallic glow effect:

```css
.service-card {
  background: conic-gradient(
    from 0deg,
    rgba(255, 255, 255, 0.1) 0deg,
    rgba(0, 212, 255, 0.6) 45deg,
    rgba(255, 255, 255, 0.9) 90deg,
    rgba(139, 92, 246, 0.5) 135deg,
    rgba(255, 255, 255, 0.1) 180deg,
    rgba(0, 212, 255, 0.4) 225deg,
    rgba(255, 255, 255, 0.7) 270deg,
    rgba(139, 92, 246, 0.6) 315deg,
    rgba(255, 255, 255, 0.1) 360deg
  );
  padding: 2px; /* creates border effect */
  box-shadow:
    0 0 20px rgba(0, 212, 255, 0.2),
    0 0 40px rgba(0, 212, 255, 0.1);
}

.service-card-inner {
  background: rgba(10, 10, 31, 0.8); /* navy-900/80 */
  backdrop-filter: blur(4px);
}
```

### Buttons

**Primary Button (Solid):**
```html
<a class="rounded-full bg-teal-500 px-6 py-3 text-base font-medium text-white
   transition-all hover:bg-teal-400 hover:shadow-lg hover:shadow-teal-500/25">
```

**Secondary Button (Outline):**
```html
<a class="rounded-full border-2 border-electric-500 bg-transparent px-8 py-3
   text-base font-medium text-white transition-all hover:bg-electric-500">
```

### Cards (Dark Theme)
```html
<div class="rounded-2xl bg-navy-800/60 backdrop-blur-sm border border-white/10 p-6">
```

## Special Effects

### Lightning Text Effect
Text with background image clipped to text:
```css
.hero-lightning-text {
  background-image: url('/lightening.png');
  background-size: cover;
  background-position: center;
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
}
```

### Logo Glow Animation
Rotating glow effect around the logo:
```css
.logo-glow {
  background: radial-gradient(ellipse 60% 40% at 50% 20%,
    rgba(255, 255, 255, 0.4) 0%,
    rgba(255, 255, 255, 0.15) 40%,
    transparent 70%);
  animation: glow-rotate 6s linear infinite;
}
```

## Scroll Animations

Elements animate in on scroll using these classes:
- `.animate-on-scroll` - Base class (opacity: 0)
- `.slide-from-left` - Slides in from left
- `.slide-from-right` - Slides in from right
- `.slide-from-bottom` - Slides in from bottom
- `.is-visible` - Added via JS when element enters viewport

## Dark vs Light Variants

Many components support both dark and light variants:
- Header: `variant="dark"` or `variant="light"`
- BlogPostPreview: `variant="dark"` or `variant="light"`

## Image Assets

- `/lightening.png` - Lightning bolt image for hero text effect
- `/bg_nodes.png` - Network nodes pattern for parallax background
- `/brain.png` - AI Consulting service icon
- `/robot.png` - Custom Software service icon
- `/logo3.png` - Site logo

## Responsive Breakpoints

Using Tailwind's default breakpoints:
- `sm:` - 640px+
- `md:` - 768px+
- `lg:` - 1024px+
- `xl:` - 1280px+

## Accessibility

- Respects `prefers-reduced-motion` for animations
- Semantic HTML structure
- Proper heading hierarchy
- Focus states on interactive elements
