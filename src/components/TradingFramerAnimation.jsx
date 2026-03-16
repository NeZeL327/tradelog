import { motion } from 'framer-motion';

/**
 * Minimalna warstwa „pro” nad tapetą: delikatna siatka kropek + jedna płynna linia.
 * Spójne z tradingiem, bez rozpraszających elementów.
 */
export default function TradingFramerAnimation() {
  return (
    <div
      className="trading-framer-animation absolute inset-0 overflow-hidden pointer-events-none"
      aria-hidden="true"
    >
      {/* Siatka kropek – widoczna, puls */}
      <div className="absolute inset-0 trading-dot-grid" />

      {/* Płynna linia – dobrze widoczna, rysuje się w pętli */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 400 300"
        preserveAspectRatio="xMidYMid slice"
        style={{ opacity: 0.65 }}
      >
        <defs>
          <linearGradient id="trading-framer-line-pro" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(34, 211, 238, 0.6)" />
            <stop offset="50%" stopColor="rgba(16, 185, 129, 0.8)" />
            <stop offset="100%" stopColor="rgba(34, 211, 238, 0.55)" />
          </linearGradient>
        </defs>
        <motion.path
          d="M 0 200 Q 100 160 200 140 T 400 100"
          fill="none"
          stroke="url(#trading-framer-line-pro)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="500"
          initial={{ strokeDashoffset: 500 }}
          animate={{ strokeDashoffset: 0 }}
          transition={{ duration: 4, repeat: Infinity, repeatDelay: 1.5, ease: 'easeInOut' }}
        />
      </svg>
    </div>
  );
}
