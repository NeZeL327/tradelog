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

      {/* Mesh glow — very soft cyan wash only */}
      <div className="public-mesh-glow absolute inset-0 opacity-40" />

      <motion.div
        className="absolute -top-24 -right-20 h-[32rem] w-[32rem] rounded-full bg-primary/12 blur-[90px]"
        animate={{
          x: [0, 28, 0],
          y: [0, -20, 0],
          scale: [1, 1.08, 1],
          opacity: [0.35, 0.55, 0.35],
        }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-32 -left-20 h-[30rem] w-[30rem] rounded-full bg-primary/8 blur-[100px]"
        animate={{
          x: [0, -24, 0],
          y: [0, 24, 0],
          scale: [1.05, 1, 1.05],
          opacity: [0.25, 0.4, 0.25],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Delikatny sweep – jeden pas światła */}
      <div className="public-mesh-sweep" />

      <div className="hero-vignette" />
    </div>
  );
}
