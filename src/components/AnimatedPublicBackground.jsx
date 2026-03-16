import { motion } from 'framer-motion';

/**
 * Animowane tło dla stron publicznych – styl profesjonalny (mesh gradient):
 * delikatna siatka, 2–3 miękkie orby, jeden przesuwający się blask. Bez pierścieni.
 */
export default function AnimatedPublicBackground() {
  return (
    <div className="animated-public-bg absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Siatka – subtelna, wolny ruch */}
      <div className="hero-grid animated-public-grid" />

      {/* Mesh glow – jeden gradient, bardzo wolna pulsacja */}
      <div className="public-mesh-glow absolute inset-0" />

      {/* Dwa orby – dobrze widoczne, wolny drift */}
      <motion.div
        className="absolute -top-24 -right-20 w-[32rem] h-[32rem] rounded-full bg-emerald-500/35 blur-[75px]"
        animate={{
          x: [0, 28, 0],
          y: [0, -20, 0],
          scale: [1, 1.08, 1],
          opacity: [0.7, 1, 0.7],
        }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-32 -left-20 w-[30rem] h-[30rem] rounded-full bg-cyan-500/30 blur-[80px]"
        animate={{
          x: [0, -24, 0],
          y: [0, 24, 0],
          scale: [1.05, 1, 1.05],
          opacity: [0.65, 0.95, 0.65],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Delikatny sweep – jeden pas światła */}
      <div className="public-mesh-sweep" />

      <div className="hero-vignette" />
    </div>
  );
}
