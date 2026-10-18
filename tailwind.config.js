/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
  	extend: {
  		fontFamily: {
  			sans: ['Manrope', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
  			mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)',
  			'ds-xs': 'var(--ds-radius-xs)',
  			'ds-sm': 'var(--ds-radius-sm)',
  			'ds-md': 'var(--ds-radius-md)',
  			'ds-lg': 'var(--ds-radius-lg)',
  			'ds-xl': 'var(--ds-radius-xl)'
  		},
  		boxShadow: {
  			'ds-pop': 'var(--ds-shadow-pop)'
  		},
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			ds: {
  				bg: 'var(--ds-bg)',
  				s1: 'var(--ds-s1)',
  				s2: 'var(--ds-s2)',
  				s3: 'var(--ds-s3)',
  				line: 'var(--ds-line)',
  				frame: 'var(--ds-frame)',
  				text: 'var(--ds-text)',
  				text2: 'var(--ds-text2)',
  				text3: 'var(--ds-text3)',
  				accent: 'var(--ds-accent)',
  				pos: 'var(--ds-pos)',
  				neg: 'var(--ds-neg)',
  				warn: 'var(--ds-warn)',
  				sel: 'var(--ds-sel)',
  				glass: 'var(--ds-glass)',
  				skeleton: 'var(--ds-skeleton)',
  				'pos-tint': 'var(--ds-pos-tint)',
  				'neg-tint': 'var(--ds-neg-tint)',
  				'warn-tint': 'var(--ds-warn-tint)'
  			},
  			profit: 'hsl(var(--profit))',
  			loss: 'hsl(var(--loss))',
  			warning: 'hsl(var(--warning))',
  			surface: {
  				DEFAULT: 'hsl(var(--card))',
  				2: 'hsl(var(--surface-2))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			},
  			'shiny-text': {
  				'0%, 90%, 100%': { backgroundPosition: 'calc(-100% - var(--shiny-width, 120px)) 0' },
  				'30%, 60%': { backgroundPosition: 'calc(100% + var(--shiny-width, 120px)) 0' }
  			},
  			'text-pop-in': {
  				'0%': { opacity: '0', transform: 'translateY(0.4em) scale(0.96)' },
  				'100%': { opacity: '1', transform: 'translateY(0) scale(1)' }
  			},
  			'button-shine': {
  				'0%': { transform: 'translateX(-100%) skewX(-12deg)' },
  				'100%': { transform: 'translateX(200%) skewX(-12deg)' }
  			},
  			'ds-enter': {
  				from: { opacity: '0', transform: 'translateY(4px)' },
  				to: { opacity: '1', transform: 'translateY(0)' }
  			},
  			'ds-shimmer': {
  				'0%': { backgroundPosition: '-200% 0' },
  				'100%': { backgroundPosition: '200% 0' }
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			'shiny-text': 'shiny-text 6s ease-in-out infinite',
  			'text-pop-in': 'text-pop-in 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards',
  			'button-shine': 'button-shine 0.8s ease-in-out',
  			'ds-enter': 'ds-enter var(--ds-dur) var(--ds-ease) both',
  			'ds-shimmer': 'ds-shimmer 1.6s linear infinite'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}