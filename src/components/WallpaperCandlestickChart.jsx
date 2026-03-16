import { motion } from 'framer-motion';

/**
 * Tło z wykresem świecowym – duży rząd japońskich świec, dobrze widoczny.
 */

const GREEN = 'rgba(16, 185, 129, 0.95)';
const RED = 'rgba(239, 68, 68, 0.95)';
const WICK = 'rgba(148, 163, 184, 0.85)';

const BARS = [
  [0.1, 0.5, 0.4], [0.05, 0.25, 0.7], [0.6, 0.2, 0.2], [0.15, 0.6, 0.25], [0.2, 0.45, 0.35],
  [0.5, 0.15, 0.35], [0.1, 0.7, 0.2], [0.3, 0.35, 0.35], [0.4, 0.2, 0.4], [0.08, 0.55, 0.37],
  [0.35, 0.4, 0.25], [0.25, 0.5, 0.25], [0.7, 0.12, 0.18], [0.12, 0.4, 0.48], [0.45, 0.3, 0.25],
  [0.2, 0.6, 0.2],
];
const COLORS = [true, false, true, true, false, true, false, true, false, true, false, true, true, false, true, false];

const CANDLE_WIDTH = 36;
const BAR_HEIGHT = 100;

export default function WallpaperCandlestickChart() {
  return (
    <div
      className="wallpaper-candlestick-chart absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center"
      style={{ zIndex: 4 }}
      aria-hidden="true"
    >
      <motion.div
        className="flex items-end gap-2"
        style={{ height: BAR_HEIGHT + 50 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        {BARS.map(([u, b, l], i) => (
          <motion.div
            key={i}
            className="flex flex-col items-center shrink-0"
            style={{ width: CANDLE_WIDTH, transformOrigin: 'bottom' }}
            initial={{ opacity: 0, scaleY: 0 }}
            animate={{ opacity: 1, scaleY: 1 }}
            transition={{ duration: 0.35, delay: i * 0.05, ease: 'easeOut' }}
          >
            <div
              style={{
                width: 2,
                height: (u / (u + b + l)) * BAR_HEIGHT,
                minHeight: 2,
                background: WICK,
                borderRadius: 1,
              }}
            />
            <div
              style={{
                width: CANDLE_WIDTH * 0.7,
                height: Math.max(6, (b / (u + b + l)) * BAR_HEIGHT),
                background: COLORS[i] ? GREEN : RED,
                border: `2px solid ${COLORS[i] ? 'rgba(16,185,129,0.6)' : 'rgba(239,68,68,0.6)'}`,
                borderRadius: 4,
              }}
            />
            <div
              style={{
                width: 2,
                height: (l / (u + b + l)) * BAR_HEIGHT,
                minHeight: 2,
                background: WICK,
                borderRadius: 1,
              }}
            />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
