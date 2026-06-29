import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Menu, X, User } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import LanguageToggle from '@/components/LanguageToggle';

export default function PublicNavbar({ variant = 'default' }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isHero = variant === 'hero';

  const menuItems = [
    { label: t('features') || 'Features', href: '#features' },
    { label: t('about') || 'Resources', href: '/about' },
    { label: t('contact') || 'Contact', href: '/contact' },
    { label: t('pricing') || 'Pricing', href: '/pricing' },
  ];

  if (!isHero) {
    return (
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/90 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2 group">
              <img
                src="/aikeeptrade-icon-hires.png"
                alt="AiKeepTrade"
                width="36"
                height="36"
                className="h-9 w-9 object-contain transition-transform group-hover:scale-[1.03]"
              />
              <span className="text-lg font-bold tracking-tight text-foreground">AiKeepTrade</span>
            </Link>
            <div className="hidden md:flex items-center gap-3">
              <LanguageToggle variant="light" />
              <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>{t('login') || 'Sign in'}</Button>
              <Button size="sm" onClick={() => navigate('/register')} className="fx-cta px-4">{t('register') || 'Try now'}</Button>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <>
      <nav className="fx-pill-nav hidden md:block">
        <div className="fx-pill-nav-inner">
          {/* Logo (left, inside pill) */}
          <Link to="/" className="flex items-center gap-2 pl-2 pr-3 group">
            <img
              src="/aikeeptrade-icon-hires.png"
              alt="AiKeepTrade"
              width="28"
              height="28"
              className="h-7 w-7 object-contain transition-transform group-hover:scale-[1.03]"
            />
            <span className="text-base font-bold tracking-tight text-white">AiKeepTrade</span>
          </Link>

          {/* Center menu */}
          <div className="flex items-center gap-0.5 mx-2">
            {menuItems.map((item) => (
              item.href.startsWith('#') ? (
                <a key={item.label} href={item.href} className="fx-nav-link">{item.label}</a>
              ) : (
                <Link key={item.label} to={item.href} className="fx-nav-link">{item.label}</Link>
              )
            ))}
          </div>

          {/* Right actions */}
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden lg:block"><LanguageToggle variant="dark" /></div>

            <button
              type="button"
              onClick={() => navigate('/login')}
              className="fx-nav-pill"
            >
              <User className="w-3.5 h-3.5" />
              {t('login') || 'Sign in'}
            </button>

            <button
              type="button"
              onClick={() => navigate('/register')}
              className="fx-cta h-8 px-4 text-[13px]"
            >
              {t('register') || 'Try now'}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile floating header */}
      <nav className="md:hidden fx-pill-nav">
        <div className="fx-pill-nav-inner">
          <Link to="/" className="flex items-center gap-1.5 pl-1 pr-2">
            <img
              src="/aikeeptrade-icon-hires.png"
              alt="AiKeepTrade"
              width="26"
              height="26"
              className="h-[26px] w-[26px] object-contain"
            />
            <span className="text-sm font-bold tracking-tight text-white">AiKeepTrade</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <LanguageToggle variant="dark" />
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="fx-nav-pill px-2"
              aria-label="Menu"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="md:hidden fixed top-[78px] left-3 right-3 z-50 rounded-2xl border border-white/10 bg-[#0d111c]/95 backdrop-blur-xl p-3 animate-in fade-in-0 slide-in-from-top-2 duration-200 shadow-2xl">
          <div className="flex flex-col gap-1">
            {menuItems.map((item) => (
              item.href.startsWith('#') ? (
                <a key={item.label} href={item.href} className="fx-nav-link h-10 justify-start" onClick={() => setMobileMenuOpen(false)}>{item.label}</a>
              ) : (
                <Link key={item.label} to={item.href} className="fx-nav-link h-10 justify-start" onClick={() => setMobileMenuOpen(false)}>{item.label}</Link>
              )
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-white/8">
            <button
              type="button"
              onClick={() => { navigate('/login'); setMobileMenuOpen(false); }}
              className="fx-cta-outline h-10 px-4 text-sm font-medium"
            >
              {t('login') || 'Sign in'}
            </button>
            <button
              type="button"
              onClick={() => { navigate('/register'); setMobileMenuOpen(false); }}
              className="fx-cta h-10 px-4 text-sm"
            >
              {t('register') || 'Try now'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
