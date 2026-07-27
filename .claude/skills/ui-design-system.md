# Skill: UI Design System

## Tailwind Theme Configuration

```ts
// tailwind.config.ts — source of truth for all design tokens
export default {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#0129AC',
          secondary: '#809EFC',
          surface: '#E1ECFF',
        },
        background: {
          DEFAULT: '#FAFBFE',
          dark: '#0F1117',
        },
        card: {
          DEFAULT: '#FFFFFF',
          dark: '#1A1D27',
        },
        border: {
          DEFAULT: '#E2E8F0',
          dark: '#2A2D3A',
        },
        text: {
          primary: '#2E2E2E',
          muted: '#707070',
          'dark-primary': '#E8E8ED',
          'dark-muted': '#8B8D98',
        },
        status: {
          success: '#059669',
          warning: '#D97706',
          danger: '#DC2626',
        },
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'monospace'],
      },
      fontSize: {
        'h1': ['28px', { lineHeight: '36px', fontWeight: '600' }],
        'h2': ['22px', { lineHeight: '28px', fontWeight: '600' }],
        'h3': ['18px', { lineHeight: '24px', fontWeight: '600' }],
        'h4': ['15px', { lineHeight: '20px', fontWeight: '600' }],
        'body': ['14px', { lineHeight: '22px', fontWeight: '400' }],
        'small': ['12px', { lineHeight: '16px', fontWeight: '400' }],
        'metric': ['28px', { lineHeight: '32px', fontWeight: '600' }],
      },
      borderRadius: {
        'sm': '6px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(1,41,172,0.04), 0 1px 2px rgba(1,41,172,0.02)',
        'dropdown': '0 4px 24px rgba(1,41,172,0.08), 0 2px 8px rgba(1,41,172,0.04)',
      },
      spacing: {
        '4.5': '18px',
        '13': '52px',
        '15': '60px',
        '18': '72px',
      },
      animation: {
        'shimmer': 'shimmer 2s infinite linear',
        'fade-in': 'fadeIn 200ms ease-out',
        'slide-up': 'slideUp 200ms ease-out',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
}
```

## CSS Variables (globals.css)

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --brand-primary: #0129AC;
  --brand-secondary: #809EFC;
  --brand-surface: #E1ECFF;
  --bg: #FAFBFE;
  --card-bg: #FFFFFF;
  --border: #E2E8F0;
  --text-primary: #2E2E2E;
  --text-muted: #707070;
  --success: #059669;
  --warning: #D97706;
  --danger: #DC2626;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --shadow-card: 0 1px 3px rgba(1,41,172,0.04), 0 1px 2px rgba(1,41,172,0.02);
}

.dark {
  --brand-primary: #809EFC;
  --brand-secondary: #0129AC;
  --brand-surface: rgba(128,158,252,0.08);
  --bg: #0F1117;
  --card-bg: #1A1D27;
  --border: #2A2D3A;
  --text-primary: #E8E8ED;
  --text-muted: #8B8D98;
  --shadow-card: 0 1px 3px rgba(0,0,0,0.2), 0 1px 2px rgba(0,0,0,0.1);
}

body {
  font-family: 'Poppins', system-ui, -apple-system, sans-serif;
  background: var(--bg);
  color: var(--text-primary);
  -webkit-font-smoothing: antialiased;
}
```

## Component Patterns

### Card
```tsx
// Every card follows this exact pattern
<div className="bg-white dark:bg-card-dark border border-border dark:border-border-dark rounded-lg p-6 shadow-card">
  {children}
</div>
```

### MetricCard
```tsx
// Number + label + trend
<Card>
  <p className="text-small text-text-muted">{label}</p>
  <div className="flex items-baseline gap-2 mt-1">
    <span className="text-metric text-text-primary dark:text-text-dark-primary">{value}</span>
    <TrendIndicator value={change} />
  </div>
  <SparkLine data={trend} className="mt-3 h-8" />
</Card>
```

### Badge
```tsx
// Severity badges use semantic bg at 10% opacity
const variants = {
  critical: 'bg-status-danger/10 text-status-danger',
  warning: 'bg-status-warning/10 text-status-warning',
  info: 'bg-brand-secondary/10 text-brand-primary',
  success: 'bg-status-success/10 text-status-success',
}

<span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-sm text-small font-medium', variants[variant])}>
  {children}
</span>
```

### Button
```tsx
const variants = {
  primary: 'bg-brand-primary text-white hover:bg-brand-primary/90',
  secondary: 'bg-transparent border border-border text-text-primary hover:bg-brand-surface/50',
  ghost: 'bg-transparent text-text-muted hover:bg-brand-surface/50 hover:text-text-primary',
  danger: 'bg-status-danger text-white hover:bg-status-danger/90',
}

<button className={cn(
  'inline-flex items-center justify-center h-9 px-4 rounded-md text-[13px] font-medium transition-all duration-200',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary/30',
  'active:scale-[0.98]',
  variants[variant]
)}>
  {children}
</button>
```

### Skeleton Loader
```tsx
<div className="animate-shimmer bg-gradient-to-r from-border/40 via-border/10 to-border/40 bg-[length:200%_100%] rounded-md h-4 w-full" />
```

### Table Row Hover
```tsx
<tr className="border-b border-border/50 hover:bg-brand-surface/30 dark:hover:bg-brand-surface transition-colors duration-150">
```

### Empty State
```tsx
<div className="flex flex-col items-center justify-center py-16 text-center">
  <div className="w-12 h-12 rounded-xl bg-brand-surface flex items-center justify-center mb-4">
    <Icon className="w-6 h-6 text-brand-primary" />
  </div>
  <h3 className="text-h4 text-text-primary mb-1">{title}</h3>
  <p className="text-small text-text-muted mb-6 max-w-sm">{description}</p>
  <Button variant="primary">{action}</Button>
</div>
```

## Sidebar Navigation Pattern

```tsx
// Active item: brand surface bg, primary text, left border accent
// Inactive: transparent, muted text, hover surface bg

const navItemBase = 'flex items-center gap-3 px-3 py-2 rounded-md text-[13px] font-medium transition-all duration-150'
const navItemActive = 'bg-brand-surface/60 text-brand-primary border-l-2 border-brand-primary'
const navItemInactive = 'text-text-muted hover:bg-brand-surface/30 hover:text-text-primary border-l-2 border-transparent'
```

## Chart Styling (Recharts)

```tsx
// Area chart with brand gradient
<defs>
  <linearGradient id="brandGradient" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stopColor="#0129AC" stopOpacity={0.15} />
    <stop offset="100%" stopColor="#0129AC" stopOpacity={0} />
  </linearGradient>
</defs>
<Area stroke="#0129AC" strokeWidth={2} fill="url(#brandGradient)" />

// Grid lines: minimal, light
<CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" opacity={0.5} />

// Axis labels
<XAxis tick={{ fontSize: 12, fill: '#707070' }} axisLine={false} tickLine={false} />

// Custom tooltip: card-styled
const CustomTooltip = ({ active, payload, label }) => {
  if (!active) return null
  return (
    <div className="bg-white dark:bg-card-dark border border-border rounded-lg shadow-dropdown p-3">
      <p className="text-small text-text-muted mb-1">{label}</p>
      {payload.map(entry => (
        <p key={entry.name} className="text-body font-medium" style={{ color: entry.color }}>
          {entry.name}: {entry.value.toLocaleString()}
        </p>
      ))}
    </div>
  )
}
```

## Animation Patterns (Framer Motion)

```tsx
// Page transition wrapper
<motion.div
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.2, ease: 'easeOut' }}
>

// Staggered list items
<motion.div
  initial={{ opacity: 0, y: 4 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: index * 0.03 }}
>

// Card hover lift (CSS only — no framer for simple hovers)
className="transition-all duration-200 hover:shadow-dropdown hover:-translate-y-0.5"
```

## Responsive Breakpoints
- Sidebar collapses to icon-only at < 1024px
- Metric cards: 4 columns -> 2 columns at < 768px
- Dashboard two-column grid: stacks at < 1024px
- Tables get horizontal scroll wrapper at < 640px

## Dark Mode Implementation
- Toggle lives in Header, persists to localStorage
- Body gets class 'dark' via useTheme hook
- Every component uses dark: variants
- Charts switch grid/axis colors via CSS variables
- Status colors (success/warning/danger) stay the same in both modes
- Brand primary shifts to secondary (#809EFC) in dark mode for better contrast