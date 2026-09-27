---
name: Field Canvassing Ledger
colors:
  surface: '#f9faf3'
  surface-dim: '#d9dbd4'
  surface-bright: '#f9faf3'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4ed'
  surface-container: '#edeee8'
  surface-container-high: '#e8e9e2'
  surface-container-highest: '#e2e3dc'
  on-surface: '#1a1c18'
  on-surface-variant: '#4d4635'
  inverse-surface: '#2f312d'
  inverse-on-surface: '#f0f1ea'
  outline: '#7f7663'
  outline-variant: '#d1c5af'
  surface-tint: '#755b00'
  primary: '#755b00'
  on-primary: '#ffffff'
  primary-container: '#c9a227'
  on-primary-container: '#4b3a00'
  inverse-primary: '#ecc246'
  secondary: '#5b5f63'
  on-secondary: '#ffffff'
  secondary-container: '#dde0e5'
  on-secondary-container: '#606367'
  tertiary: '#4f5e81'
  on-tertiary: '#ffffff'
  tertiary-container: '#98a6cd'
  on-tertiary-container: '#2d3b5c'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffe08e'
  primary-fixed-dim: '#ecc246'
  on-primary-fixed: '#241a00'
  on-primary-fixed-variant: '#584400'
  secondary-fixed: '#e0e2e7'
  secondary-fixed-dim: '#c4c6cb'
  on-secondary-fixed: '#181c20'
  on-secondary-fixed-variant: '#44474b'
  tertiary-fixed: '#d9e2ff'
  tertiary-fixed-dim: '#b7c6ee'
  on-tertiary-fixed: '#0a1a3a'
  on-tertiary-fixed-variant: '#384668'
  background: '#f9faf3'
  on-background: '#1a1c18'
  surface-variant: '#e2e3dc'
typography:
  display:
    fontFamily: Archivo Narrow
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Archivo Narrow
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.005em
  headline-md:
    fontFamily: Archivo Narrow
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Archivo Narrow
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-default:
    fontFamily: Archivo Narrow
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-default:
    fontFamily: Archivo Narrow
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 18px
  caption:
    fontFamily: Archivo Narrow
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-mobile: 0.75rem
  margin: 1.5rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

# Design System Captain Prospectus

The visual system for Captain Prospectus — a B2B field-canvassing application in Brussels.

## Grounding & Identity
The app replaces a carnet de tournée (route notebook). The mark is a ship's wheel around a map pin.
- Navy #1B2A4A represents the ink, band, and grounding structural foundation.
- Gold #C9A227 represents the compass needle, steering direction, and primary action.
- Background #F6F7F0 is the tactile off-white ledger page.

## Color Tokens

### Light Mode
- background: #F6F7F0
- card: #FFFFFF
- card-foreground: #1B2A4A
- foreground: #1B2A4A
- muted: #E8EAEF
- muted-foreground: #5A6478
- border: #D7DAE2
- input: #D7DAE2
- primary: #C9A227
- primary-foreground: #1B2A4A
- primary-edge: #A8801A
- secondary: #E8EAEF
- secondary-foreground: #1B2A4A
- accent: #E8EAEF
- accent-foreground: #1B2A4A
- destructive: #8C2F39
- destructive-foreground: #FFFFFF
- ring: #1B2A4A
- success: #1F6F4A
- warn: #9A6B12
- sidebar: #1B2A4A
- sidebar-foreground: #EEF0F4
- sidebar-muted: #95A0B8
- sidebar-accent: rgba(255, 255, 255, 0.08)
- sidebar-border: rgba(255, 255, 255, 0.12)

### Dark Mode
- background: #101726
- card: #182031
- card-foreground: #E7EAF0
- foreground: #E7EAF0
- muted: #222B3D
- muted-foreground: #97A2B8
- border: #2B3547
- input: #2B3547
- primary: #D9B43C
- primary-foreground: #141C2E
- primary-edge: #E6C65C
- secondary: #222B3D
- secondary-foreground: #E7EAF0
- accent: #222B3D
- accent-foreground: #E7EAF0
- destructive: #D2757E
- destructive-foreground: #141C2E
- ring: #E7EAF0
- success: #4FA97D
- warn: #D98A3C
- sidebar: #0B1120
- sidebar-foreground: #EEF0F4
- sidebar-muted: #95A0B8
- sidebar-accent: rgba(255, 255, 255, 0.06)
- sidebar-border: rgba(255, 255, 255, 0.08)

### Inviolable Gold Rules
1. Gold is never text on a light surface (contrast is 2.4:1). It is always a fill with Navy #1B2A4A text on top (5.9:1).
2. Gold is never the focus ring. Focus ring points to ink (#1B2A4A light / #E7EAF0 dark).
3. A gold button always carries a 1px border `primary-edge` (#A8801A in light, #E6C65C in dark).

### Status System (Edge & Label)
- Nouveau: neutral grey (16% ink) / text-muted-foreground
- Assigné: slate (55% ink) / text-foreground
- À relancer: #9A6B12 (warn) / text-warn
- Converti: #1F6F4A (success) / text-success
- Refusé: #8C2F39 (destructive) / text-destructive

## Typography
- Font Family: Archivo Narrow, sans-serif (tabular figures enabled via .tnum / font-variant-numeric: tabular-nums)
- text-xs: 12px / 0.75rem (meta, badges, table headers)
- text-sm: 14px / 0.875rem (body, table cells, admin default)
- text-base: 16px / 1rem (field body, inputs, iOS zoom prevention)
- text-xl: 20px / 1.25rem (screen headers, titles)
- text-2xl / display: 28px / 1.75rem (KPI numbers, tallies, right-aligned)

## Component Specifications
- Radii: 8px standard (buttons, inputs, badges), 16px for cards/dialogs.
- Admin rows: 44px height, tabular numbers right-aligned, 4px leading status border on first cell.
- Field targets: 48px minimum touch target, 56px stacked buttons for outcome cards.
- French localization: Sentence case, formatted dates (DD/MM/YYYY HH:mm), spaced thousands ("1 284").