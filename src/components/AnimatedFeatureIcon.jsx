import { motion } from 'framer-motion';

/**
 * Nowoczesna ikona z animacją – gradientowa skrzynka, delikatny float + hover.
 * variant: 'main' (emerald) | 'more' (blue/slate)
 */
export default function AnimatedFeatureIcon({
  icon: Icon,
  variant = 'main',
  className = '',
  iconClassName = '',
  size = 'md',
  iconAnimation,
}) {
  const isMain = variant === 'main';
  const sizeClasses = size === 'sm' ? 'w-10 h-10' : size === 'lg' ? 'w-14 h-14' : 'w-12 h-12';
  const iconSizeClasses = size === 'sm' ? 'w-5 h-5' : size === 'lg' ? 'w-7 h-7' : 'w-6 h-6';

  return (
    <motion.div
      className={`
        relative rounded-2xl flex items-center justify-center
        ${isMain
          ? 'bg-primary/10 border border-primary/20'
          : 'bg-muted/60 border border-border'
        }
        ${sizeClasses}
        ${className}
      `}
      initial={{ scale: 0.94, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{
        scale: 1.05,
        boxShadow: 'none',
        transition: { duration: 0.2 },
      }}
      whileTap={{ scale: 0.98 }}
    >
      <motion.div
        className="relative flex items-center justify-center"
        animate={iconAnimation || { y: [0, -4, 0], scale: [1, 1.06, 1] }}
        transition={
          iconAnimation?.transition ?? {
            duration: 2.2,
            repeat: Infinity,
            repeatDelay: 2.5,
            ease: 'easeInOut',
          }
        }
      >
        <Icon
          className={`${isMain ? 'text-primary' : 'text-muted-foreground'} ${iconSizeClasses} ${iconClassName}`}
          strokeWidth={1.6}
        />
      </motion.div>
    </motion.div>
  );
}
