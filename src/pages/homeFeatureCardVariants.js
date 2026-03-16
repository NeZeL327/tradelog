/** Warianty animacji kart funkcji na stronie głównej (poza JSX, żeby uniknąć parsowania `{ y: ... }` jako etykiety). */
export const featureCardVariants = [
  {
    initial: { opacity: 0, x: -48, y: 20 },
    hover: { scale: 1.02, boxShadow: '0 20px 40px -12px rgba(16, 185, 129, 0.2)' },
    icon: { rotate: [0, -8, 8, 0], transition: { duration: 2.5, repeat: Infinity, repeatDelay: 3 } },
  },
  {
    initial: { opacity: 0, y: 40 },
    hover: { y: -6, boxShadow: '0 24px 48px -16px rgba(34, 211, 238, 0.25)' },
    icon: { y: [0, -4, 0], transition: { duration: 1.8, repeat: Infinity, repeatDelay: 2 } },
  },
  {
    initial: { opacity: 0, x: 48, scale: 0.96 },
    hover: { scale: 1.03, boxShadow: '0 20px 40px -12px rgba(139, 92, 246, 0.2)' },
    icon: { scale: [1, 1.1, 1], opacity: [0.9, 1, 0.9], transition: { duration: 2, repeat: Infinity, repeatDelay: 2.5 } },
  },
];
