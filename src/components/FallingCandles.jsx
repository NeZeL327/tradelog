import { motion } from 'framer-motion';

/**
 * Świece japońskie spadające w tle – ~40 typów (hammer, doji, marubozu, spinning top, itd.).
 * Proporcje na podstawie rzeczywistych formacji.
 */

const WICK_COLOR = 'rgba(148, 163, 184, 0.7)';
const GREEN_BODY = 'rgba(16, 185, 129, 0.92)';
const GREEN_BODY_BORDER = 'rgba(16, 185, 129, 0.5)';
const RED_BODY = 'rgba(239, 68, 68, 0.92)';
const RED_BODY_BORDER = 'rgba(239, 68, 68, 0.5)';

/** (upperWick, body, lowerWick) jako ułamki wysokości h */
const CANDLE_TYPES = {
  // Klasyczne pojedyncze
  hammer: (_, h) => ({ upperWick: h * 0.05, body: h * 0.2, lowerWick: h * 0.75 }),
  invertedHammer: (_, h) => ({ upperWick: h * 0.7, body: h * 0.2, lowerWick: h * 0.1 }),
  hangingMan: (_, h) => ({ upperWick: h * 0.06, body: h * 0.22, lowerWick: h * 0.72 }),
  shootingStar: (_, h) => ({ upperWick: h * 0.68, body: h * 0.2, lowerWick: h * 0.12 }),
  doji: (_, h) => ({ upperWick: h * 0.4, body: h * 0.1, lowerWick: h * 0.5 }),
  longLeggedDoji: (_, h) => ({ upperWick: h * 0.42, body: h * 0.06, lowerWick: h * 0.52 }),
  dragonflyDoji: (_, h) => ({ upperWick: 0, body: h * 0.08, lowerWick: h * 0.92 }),
  gravestoneDoji: (_, h) => ({ upperWick: h * 0.9, body: h * 0.08, lowerWick: 0 }),
  spinningTop: (_, h) => ({ upperWick: h * 0.32, body: h * 0.26, lowerWick: h * 0.42 }),
  highWave: (_, h) => ({ upperWick: h * 0.38, body: h * 0.14, lowerWick: h * 0.48 }),
  // Marubozu i grube ciała
  marubozuBull: (_, h) => ({ upperWick: h * 0.02, body: h * 0.88, lowerWick: h * 0.1 }),
  marubozuBear: (_, h) => ({ upperWick: h * 0.1, body: h * 0.88, lowerWick: h * 0.02 }),
  longBody: (_, h) => ({ upperWick: h * 0.08, body: h * 0.72, lowerWick: h * 0.2 }),
  longBodyTop: (_, h) => ({ upperWick: h * 0.04, body: h * 0.7, lowerWick: h * 0.26 }),
  longBodyBottom: (_, h) => ({ upperWick: h * 0.26, body: h * 0.7, lowerWick: h * 0.04 }),
  // Normalne / średnie
  normal: (_, h) => ({ upperWick: h * 0.18, body: h * 0.5, lowerWick: h * 0.32 }),
  normalShortBody: (_, h) => ({ upperWick: h * 0.28, body: h * 0.36, lowerWick: h * 0.36 }),
  thinBody: (_, h) => ({ upperWick: h * 0.22, body: h * 0.48, lowerWick: h * 0.3 }),
  bottomHeavy: (_, h) => ({ upperWick: h * 0.14, body: h * 0.4, lowerWick: h * 0.46 }),
  topHeavy: (_, h) => ({ upperWick: h * 0.46, body: h * 0.4, lowerWick: h * 0.14 }),
  equalWicks: (_, h) => ({ upperWick: h * 0.35, body: h * 0.2, lowerWick: h * 0.45 }),
  // Belt hold / kicking
  beltHoldBull: (_, h) => ({ upperWick: h * 0.02, body: h * 0.6, lowerWick: h * 0.38 }),
  beltHoldBear: (_, h) => ({ upperWick: h * 0.38, body: h * 0.6, lowerWick: h * 0.02 }),
  noUpperWick: (_, h) => ({ upperWick: 0, body: h * 0.55, lowerWick: h * 0.45 }),
  noLowerWick: (_, h) => ({ upperWick: h * 0.45, body: h * 0.55, lowerWick: 0 }),
  // Warianty hammer / doji
  hammerWide: (_, h) => ({ upperWick: h * 0.04, body: h * 0.28, lowerWick: h * 0.68 }),
  invHammerWide: (_, h) => ({ upperWick: h * 0.64, body: h * 0.28, lowerWick: h * 0.08 }),
  dojiStandard: (_, h) => ({ upperWick: h * 0.38, body: h * 0.08, lowerWick: h * 0.54 }),
  dojiHighWave: (_, h) => ({ upperWick: h * 0.44, body: h * 0.06, lowerWick: h * 0.5 }),
  spinningTopLong: (_, h) => ({ upperWick: h * 0.36, body: h * 0.2, lowerWick: h * 0.44 }),
  // Różne proporcje
  smallBodyUpper: (_, h) => ({ upperWick: h * 0.12, body: h * 0.25, lowerWick: h * 0.63 }),
  smallBodyLower: (_, h) => ({ upperWick: h * 0.63, body: h * 0.25, lowerWick: h * 0.12 }),
  smallBodyCenter: (_, h) => ({ upperWick: h * 0.35, body: h * 0.2, lowerWick: h * 0.45 }),
  longUpperShortLower: (_, h) => ({ upperWick: h * 0.55, body: h * 0.3, lowerWick: h * 0.15 }),
  longLowerShortUpper: (_, h) => ({ upperWick: h * 0.15, body: h * 0.3, lowerWick: h * 0.55 }),
  paperUmbrella: (_, h) => ({ upperWick: h * 0.03, body: h * 0.18, lowerWick: h * 0.79 }),
  tweezerTop: (_, h) => ({ upperWick: h * 0.5, body: h * 0.12, lowerWick: h * 0.38 }),
  tweezerBottom: (_, h) => ({ upperWick: h * 0.38, body: h * 0.12, lowerWick: h * 0.5 }),
  // Dalsze warianty
  hammerSmall: (_, h) => ({ upperWick: h * 0.08, body: h * 0.14, lowerWick: h * 0.78 }),
  invHammerSmall: (_, h) => ({ upperWick: h * 0.76, body: h * 0.14, lowerWick: h * 0.1 }),
};

const TYPE_KEYS = Object.keys(CANDLE_TYPES);
const TYPE_COUNT = TYPE_KEYS.length;

const CANDLE_COUNT = 28;
const candles = Array.from({ length: CANDLE_COUNT }, (_, i) => {
  const isGreen = i % 3 !== 1;
  const typeKey = TYPE_KEYS[(i * 11) % TYPE_COUNT];
  const totalHeight = 36 + (i % 6) * 14;
  const bodyWidth = 6 + (i % 2) * 2;
  const wickWidth = 1.5;
  const shape = CANDLE_TYPES[typeKey](isGreen, totalHeight);
  return {
    left: `${2 + (i * 3.5) + (i % 3) * 0.5}%`,
    duration: 22 + (i % 6) + (i % 2) * 2,
    delay: (i * 0.9) % 14,
    totalHeight,
    bodyWidth,
    wickWidth,
    shape,
    isGreen,
    opacity: 0.28 + (i % 4) * 0.05,
  };
});

function CandleShape({ shape, bodyWidth, wickWidth, isGreen }) {
  const bodyColor = isGreen ? GREEN_BODY : RED_BODY;
  const borderColor = isGreen ? GREEN_BODY_BORDER : RED_BODY_BORDER;
  return (
    <div className="flex flex-col items-center" style={{ width: bodyWidth + 2 }}>
      <div
        style={{
          width: wickWidth,
          height: shape.upperWick,
          minHeight: shape.upperWick > 0 ? 2 : 0,
          background: WICK_COLOR,
          borderRadius: 1,
        }}
      />
      <div
        style={{
          width: bodyWidth,
          height: shape.body,
          minHeight: shape.body > 0 ? 3 : 0,
          background: bodyColor,
          border: `1px solid ${borderColor}`,
          borderRadius: 2,
        }}
      />
      <div
        style={{
          width: wickWidth,
          height: shape.lowerWick,
          minHeight: shape.lowerWick > 0 ? 2 : 0,
          background: WICK_COLOR,
          borderRadius: 1,
        }}
      />
    </div>
  );
}

export default function FallingCandles() {
  return (
    <div
      className="falling-candles absolute inset-0 overflow-hidden pointer-events-none"
      style={{ zIndex: 3 }}
      aria-hidden="true"
    >
      {candles.map((c, i) => (
        <motion.div
          key={i}
          className="falling-candle-item flex items-start justify-center"
          style={{
            position: 'absolute',
            left: c.left,
            top: 0,
            opacity: c.opacity,
          }}
          initial={{ y: '-20vh' }}
          animate={{ y: '125vh' }}
          transition={{
            duration: c.duration,
            delay: c.delay,
            repeat: Infinity,
            repeatDelay: 0,
          }}
        >
          <CandleShape
            shape={c.shape}
            bodyWidth={c.bodyWidth}
            wickWidth={c.wickWidth}
            isGreen={c.isGreen}
          />
        </motion.div>
      ))}
    </div>
  );
}
