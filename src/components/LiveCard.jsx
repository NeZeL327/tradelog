/**
 * Opakowanie na karty/boxy z efektami: obracająca się gradientowa obwódka,
 * glow podążający za kursorem, przesuwający się błysk (shine).
 * Użyj variant="main" (emerald/cyan) lub variant="more" (niebieski/cyan).
 */
export default function LiveCard({ variant = 'main', children, className = '' }) {
  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    e.currentTarget.style.setProperty('--mouse-x', x);
    e.currentTarget.style.setProperty('--mouse-y', y);
  };

  const variantClass = variant === 'more' ? 'feature-card-live-more' : 'feature-card-live-main';

  return (
    <div
      className={`feature-card-border-wrap ${variantClass} ${className}`.trim()}
      onMouseMove={handleMouseMove}
    >
      <div className="feature-card-glow" aria-hidden="true" />
      <div className="feature-card-rotating-border" aria-hidden="true" />
      {children}
    </div>
  );
}
