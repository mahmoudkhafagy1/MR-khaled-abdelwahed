---
name: Liquid Arabic
colors:
  surface: '#101415'
  surface-dim: '#101415'
  surface-bright: '#363a3b'
  surface-container-lowest: '#0b0f10'
  surface-container-low: '#191c1e'
  surface-container: '#1d2022'
  surface-container-high: '#272a2c'
  surface-container-highest: '#323537'
  on-surface: '#e0e3e5'
  on-surface-variant: '#c6c6cd'
  inverse-surface: '#e0e3e5'
  inverse-on-surface: '#2d3133'
  outline: '#909097'
  outline-variant: '#45464d'
  surface-tint: '#bec6e0'
  primary: '#bec6e0'
  on-primary: '#283044'
  primary-container: '#0f172a'
  on-primary-container: '#798098'
  inverse-primary: '#565e74'
  secondary: '#d2bbff'
  on-secondary: '#3f008e'
  secondary-container: '#6001d1'
  on-secondary-container: '#c9aeff'
  tertiary: '#4cd7f6'
  on-tertiary: '#003640'
  tertiary-container: '#001b21'
  on-tertiary-container: '#008da5'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#eaddff'
  secondary-fixed-dim: '#d2bbff'
  on-secondary-fixed: '#25005a'
  on-secondary-fixed-variant: '#5a00c6'
  tertiary-fixed: '#acedff'
  tertiary-fixed-dim: '#4cd7f6'
  on-tertiary-fixed: '#001f26'
  on-tertiary-fixed-variant: '#004e5c'
  background: '#101415'
  on-background: '#e0e3e5'
  surface-variant: '#323537'
typography:
  headline-xl:
    fontFamily: Lexend
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Lexend
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.3'
  headline-md:
    fontFamily: Lexend
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Lexend
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Lexend
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-sm:
    fontFamily: Lexend
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 48px
  xl: 80px
  gutter: 24px
  margin: 32px
---

## Brand & Style

The design system is centered on the concept of "Liquid Glass," a visual metaphor for the fluid and flowing nature of the Arabic script. The personality is sophisticated, innovative, and academically prestigious yet accessible. It targets students seeking a premium digital learning environment that feels more like an immersive experience than a traditional classroom.

The UI utilizes heavy glassmorphism to create a sense of depth and transparency. The emotional response is one of clarity and focus, achieved through blurred background layers that reduce cognitive load, while vibrant, organic "liquid" shapes pulse behind the interface to maintain energy and engagement.

## Colors

The palette is anchored in a deep, nocturnal base to allow the glass effects to shimmer effectively.

- **Primary (Deep Navy):** Used for the core background environment, providing a stable foundation for translucent layers.
- **Secondary (Royal Purple):** Represents growth and wisdom; used for primary actions and highlights.
- **Tertiary (Electric Cyan):** Used for interactive states, progress indicators, and "active" learning modules.
- **Accent (Magenta):** Reserved for high-importance call-outs, achievement badges, and celebratory UI moments.
- **Surface:** Semi-transparent variants of the primary and secondary colors (e.g., `rgba(255, 255, 255, 0.05)`) are used for glass cards to ensure readability against the fluid background shapes.

## Typography

This design system uses Lexend for its high readability and clear geometric forms, which pair exceptionally well with Arabic counterparts like Tajawal or IBM Plex Sans Arabic in a multi-lingual context. 

- **Headlines:** Use Bold and Semi-Bold weights to create a strong hierarchy against the soft glass backgrounds.
- **Body Text:** Maintain a 1.6 line height to ensure maximum legibility for educational content.
- **Arabic Integration:** When rendering Arabic text, ensure the `lang="ar"` attribute is set to trigger correct script shaping. Vertical metrics should be slightly adjusted (increased line height) to prevent clipping of diacritics (Harakaat).

## Layout & Spacing

The layout follows a fluid grid system to accommodate the organic background shapes. A 12-column grid is utilized for desktop layouts, while a single-column layout with generous side margins is used for mobile.

- **Rhythm:** Spacing follows an 8px base unit.
- **Breathability:** Educational content requires significant whitespace (or "glass-space") to prevent the vibrant backgrounds from becoming distracting.
- **Alignment:** While the background elements are fluid and organic, the UI components must remain strictly aligned to the grid to maintain professional credibility.

## Elevation & Depth

Depth is not communicated through traditional black shadows, but through "Environmental Light" and "Backdrop Blurs."

- **The Glass Layer:** Every card must have a `backdrop-filter: blur(20px)` and a subtle white inner border (1px, 15% opacity) on the top and left sides to simulate a light source hitting the edge of the glass.
- **Shadows:** Use colored shadows (glows) that inherit the tint of the background shapes (e.g., a cyan glow when the card sits over a cyan blob).
- **Z-Index:** Content layers are stacked such that the "Liquid" shapes sit at `z-index: -1`, the glass containers at `z: 1`, and interactive elements (buttons/modals) at `z: 10+`.

## Shapes

The shape language is a contrast between structural containers and organic background elements.

- **UI Containers:** Use the `Rounded` setting (0.5rem - 1.5rem) to maintain a modern, friendly feel that isn't too juvenile.
- **Fluid Blobs:** Background shapes should use `border-radius` values exceeding 50% with `blob` animations (CSS `clip-path` or SVG morphing) to create the "liquid" effect.
- **Interactive Elements:** Buttons and inputs should match the `rounded-lg` (1rem) specification to distinguish them from the larger card structures.

## Components

### Buttons
Primary buttons use a vibrant Cyan-to-Purple gradient with a subtle outer glow. Text is white and bold. Secondary buttons are "Ghost Glass"—transparent with only a subtle 1px border and a backdrop blur.

### Glass Cards
The core of the design system. Cards must have a 10% opacity white background and a 20px blur. Padding should be generous (`md` or 24px) to ensure the content doesn't feel cramped against the rounded corners.

### Form Inputs
Inputs are translucent dark wells. On focus, the border glows with the Cyan tertiary color, and the background blur intensity increases.

### Progress Trackers
Essential for an educational platform. These should be rendered as fluid "tubes" where the progress fill has a "liquid" animation, appearing to wave or ripple as it fills.

### Navigation (RTL Optimized)
Sidebars and headers must support Right-to-Left (RTL) orientation flawlessly. The glass sidebar should have a frosted effect that distinguishes it from the main content area, with active links highlighted by a magenta vertical bar on the right side.