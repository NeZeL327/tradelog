/** Warianty animacji kart na stronie Funkcje – mocne hover i ikony z życiem. */

export const mainFeaturesVariants = [
  {
    initial: { opacity: 0, x: -40 },
    hover: {
      scale: 1.03,
      translateY: -8,
      boxShadow: '0 25px 50px -12px rgba(16, 185, 129, 0.35), 0 0 0 1px rgba(16, 185, 129, 0.2)',
      transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
    },
    icon: { scale: [1, 1.12, 1], rotate: [0, -5, 5, 0], transition: { duration: 2.2, repeat: Infinity, repeatDelay: 3.5 } },
  },
  {
    initial: { opacity: 0, y: 36 },
    hover: {
      scale: 1.03,
      translateY: -10,
      boxShadow: '0 25px 50px -12px rgba(34, 211, 238, 0.4), 0 0 0 1px rgba(34, 211, 238, 0.25)',
      transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
    },
    icon: { y: [0, -5, 0], scale: [1, 1.05, 1], transition: { duration: 2, repeat: Infinity, repeatDelay: 2.5 } },
  },
  {
    initial: { opacity: 0, x: 40 },
    hover: {
      scale: 1.03,
      translateY: -8,
      boxShadow: '0 25px 50px -12px rgba(139, 92, 246, 0.35), 0 0 0 1px rgba(139, 92, 246, 0.2)',
      transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
    },
    icon: { opacity: [0.8, 1, 0.8], scale: [1, 1.08, 1], transition: { duration: 1.8, repeat: Infinity, repeatDelay: 2.5 } },
  },
];

export const moreFeaturesVariants = [
  {
    initial: { opacity: 0, y: 28 },
    hover: {
      scale: 1.03,
      translateY: -8,
      boxShadow: '0 25px 50px -12px rgba(59, 130, 246, 0.4), 0 0 0 1px rgba(59, 130, 246, 0.25)',
      transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
    },
    icon: { y: [0, -4, 0], scale: [1, 1.06, 1], transition: { duration: 2, repeat: Infinity, repeatDelay: 2.8 } },
  },
  {
    initial: { opacity: 0, scale: 0.94 },
    hover: {
      scale: 1.03,
      translateY: -6,
      boxShadow: '0 25px 50px -12px rgba(34, 211, 238, 0.4), 0 0 0 1px rgba(34, 211, 238, 0.25)',
      transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
    },
    icon: { scale: [1, 1.1, 1], rotate: [0, 3, -3, 0], transition: { duration: 2.5, repeat: Infinity, repeatDelay: 2 } },
  },
  {
    initial: { opacity: 0, x: 28 },
    hover: {
      scale: 1.03,
      translateY: -8,
      boxShadow: '0 25px 50px -12px rgba(16, 185, 129, 0.35), 0 0 0 1px rgba(16, 185, 129, 0.2)',
      transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
    },
    icon: { rotate: [0, 12, -12, 0], scale: [1, 1.05, 1], transition: { duration: 2.8, repeat: Infinity, repeatDelay: 2.5 } },
  },
];
