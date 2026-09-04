/** Warianty animacji kart na stronie Funkcje – hover bez kolorowego glow. */

const quietHover = {
  scale: 1.01,
  translateY: -2,
  boxShadow: '0 8px 24px -16px rgba(0, 0, 0, 0.45), 0 0 0 1px hsl(var(--border))',
  transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] },
};

export const mainFeaturesVariants = [
  {
    initial: { opacity: 0, x: -40 },
    hover: quietHover,
    icon: { scale: [1, 1.12, 1], rotate: [0, -5, 5, 0], transition: { duration: 2.2, repeat: Infinity, repeatDelay: 3.5 } },
  },
  {
    initial: { opacity: 0, y: 36 },
    hover: { ...quietHover, translateY: -3 },
    icon: { y: [0, -5, 0], scale: [1, 1.05, 1], transition: { duration: 2, repeat: Infinity, repeatDelay: 2.5 } },
  },
  {
    initial: { opacity: 0, x: 40 },
    hover: quietHover,
    icon: { opacity: [0.8, 1, 0.8], scale: [1, 1.08, 1], transition: { duration: 1.8, repeat: Infinity, repeatDelay: 2.5 } },
  },
];

export const moreFeaturesVariants = [
  {
    initial: { opacity: 0, y: 28 },
    hover: quietHover,
    icon: { y: [0, -4, 0], scale: [1, 1.06, 1], transition: { duration: 2, repeat: Infinity, repeatDelay: 2.8 } },
  },
  {
    initial: { opacity: 0, scale: 0.94 },
    hover: { ...quietHover, translateY: -2 },
    icon: { scale: [1, 1.1, 1], rotate: [0, 3, -3, 0], transition: { duration: 2.5, repeat: Infinity, repeatDelay: 2 } },
  },
  {
    initial: { opacity: 0, x: 28 },
    hover: quietHover,
    icon: { rotate: [0, 12, -12, 0], scale: [1, 1.05, 1], transition: { duration: 2.8, repeat: Infinity, repeatDelay: 2.5 } },
  },
];
