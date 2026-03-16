import { motion } from 'framer-motion';

/**
 * Tło z wyraźnie rysującą się linią wykresu – grube, jasne linie w pętli.
 */
export default function WallpaperLineChart() {
  return (
    <div
      className="wallpaper-line-chart absolute inset-0 overflow-hidden pointer-events-none"
      style={{ zIndex: 4 }}
      aria-hidden="true"
    >
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 1200 700"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
        style={{ opacity: 0.9 }}
      >
        <defs>
          <linearGradient id="wlc-line-1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(34, 211, 238, 0.75)" />
            <stop offset="50%" stopColor="rgba(16, 185, 129, 0.9)" />
            <stop offset="100%" stopColor="rgba(34, 211, 238, 0.7)" />
          </linearGradient>
          <linearGradient id="wlc-line-2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(16, 185, 129, 0.6)" />
            <stop offset="100%" stopColor="rgba(34, 211, 238, 0.65)" />
          </linearGradient>
          <linearGradient id="wlc-line-3" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(34, 211, 238, 0.5)" />
            <stop offset="100%" stopColor="rgba(16, 185, 129, 0.55)" />
          </linearGradient>
          <filter id="wlc-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g filter="url(#wlc-glow)">
          <motion.path
            d="M 0 450 Q 200 380 400 320 T 800 220 T 1200 180"
            fill="none"
            stroke="url(#wlc-line-1)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="1800"
            initial={{ strokeDashoffset: 1800 }}
            animate={{ strokeDashoffset: 0 }}
            transition={{ duration: 4, repeat: Infinity, repeatDelay: 1.5, ease: 'easeInOut' }}
          />
          <motion.path
            d="M 0 520 Q 250 460 500 400 T 1000 320 T 1200 280"
            fill="none"
            stroke="url(#wlc-line-2)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="1600"
            initial={{ strokeDashoffset: 1600 }}
            animate={{ strokeDashoffset: 0 }}
            transition={{ duration: 5, repeat: Infinity, repeatDelay: 1, ease: 'easeInOut' }}
          />
          <motion.path
            d="M 0 620 Q 300 560 600 500 T 1200 400"
            fill="none"
            stroke="url(#wlc-line-3)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="1400"
            initial={{ strokeDashoffset: 1400 }}
            animate={{ strokeDashoffset: 0 }}
            transition={{ duration: 6, repeat: Infinity, repeatDelay: 2, ease: 'easeInOut' }}
          />
        </g>
      </svg>
    </div>
  );
}
