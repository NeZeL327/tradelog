import { motion } from 'framer-motion';
import TradingFramerAnimation from './TradingFramerAnimation';
import FallingCandles from './FallingCandles';
import WallpaperLineChart from './WallpaperLineChart';
import WallpaperCandlestickChart from './WallpaperCandlestickChart';

/** variant: 'candles' = spadające świece | 'lineChart' = rysująca się linia | 'candlestickChart' = wykres świecowy */
export default function TradingWallpaper({ variant = 'candles' }) {
  return (
    <div className="trading-wallpaper absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true" data-wallpaper-variant={variant}>
      {/* Ciemna baza */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900/95 to-slate-950" />

      {/* Mesh gradient – 3 orby, dobrze widoczne, wolny drift */}
      <motion.div
        className="absolute -top-[20%] -right-[15%] w-[95vmax] h-[95vmax] rounded-full bg-emerald-500/40 blur-[90px]"
        animate={{
          x: [0, 40, 0],
          y: [0, -30, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-[20%] -left-[15%] w-[85vmax] h-[85vmax] rounded-full bg-primary/20 blur-[95px]"
        animate={{
          x: [0, -35, 0],
          y: [0, 30, 0],
          scale: [1.05, 1, 1.05],
        }}
        transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute top-1/2 left-1/2 w-[75vmax] h-[75vmax] -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-500/15 blur-[85px]"
        animate={{
          scale: [1, 1.15, 1],
          opacity: [0.7, 1, 0.7],
        }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Siatka – wyraźna, animowana */}
      <div
        className="absolute inset-0 trading-wallpaper-grid-mesh"
        style={{
          backgroundImage: `
            linear-gradient(90deg, rgba(34, 211, 238, 0.14) 1px, transparent 1px),
            linear-gradient(180deg, rgba(34, 211, 238, 0.14) 1px, transparent 1px)
          `,
          backgroundSize: '56px 56px',
        }}
      />

      {/* Dwie linie trendu – dobrze widoczne */}
      <svg
        className="absolute inset-0 w-full h-full trading-wallpaper-svg"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="tw-line-pro" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(34, 211, 238, 0.35)" />
            <stop offset="50%" stopColor="rgba(16, 185, 129, 0.5)" />
            <stop offset="100%" stopColor="rgba(34, 211, 238, 0.3)" />
          </linearGradient>
          <linearGradient id="tw-line-pro-2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(16, 185, 129, 0.2)" />
            <stop offset="100%" stopColor="rgba(34, 211, 238, 0.25)" />
          </linearGradient>
        </defs>
        <path
          className="trading-wallpaper-trendline"
          d="M 0 500 Q 300 420 600 360 T 1200 280"
          fill="none"
          stroke="url(#tw-line-pro)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="1400"
          strokeDashoffset="1400"
        />
        <path
          className="trading-wallpaper-trendline trading-wallpaper-trendline-2"
          d="M 0 580 Q 400 520 800 440 T 1200 380"
          fill="none"
          stroke="url(#tw-line-pro-2)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray="1400"
          strokeDashoffset="1400"
        />
      </svg>

      {/* Spadające świece – na każdej stronie (jak na głównej) */}
      <FallingCandles />
      {/* Dodatkowy efekt wariantu – linia lub wykres świecowy */}
      {variant === 'lineChart' && <WallpaperLineChart />}
      {variant === 'candlestickChart' && <WallpaperCandlestickChart />}

      <TradingFramerAnimation />

      {/* Vignette – słabsza przy lineChart/candlestickChart, żeby efekt był widoczny */}
      <div
        className="absolute inset-0"
        style={{
          background: variant === 'lineChart' || variant === 'candlestickChart'
            ? 'radial-gradient(ellipse 95% 85% at 50% 50%, transparent 0%, rgba(2, 6, 23, 0.15) 60%, rgba(2, 6, 23, 0.5) 100%)'
            : 'radial-gradient(ellipse 95% 85% at 50% 50%, transparent 0%, rgba(2, 6, 23, 0.25) 55%, rgba(2, 6, 23, 0.7) 100%)',
        }}
      />
    </div>
  );
}
