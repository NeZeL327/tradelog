import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Menu, X, LogIn, UserPlus } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import LanguageToggle from '@/components/LanguageToggle';

export default function PublicNavbar({ variant = 'default' }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isHero = variant === 'hero';

  const menuItems = [
    { label: t('features') || 'Features', href: '#features' },
    { label: t('pricing') || 'Pricing', href: '/pricing' },
    { label: t('about') || 'About', href: '/about' },
    { label: t('contact') || 'Contact', href: '/contact' },
  ];

  const navbarClassName = isHero
    ? 'fixed top-0 left-0 right-0 z-50 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-md supports-[backdrop-filter]:bg-slate-950/70 transition-colors duration-300'
    : 'fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/90 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 transition-colors duration-300';

  const menuLinkClassName = isHero
    ? 'text-sm font-medium text-slate-300 hover:text-white transition-colors'
    : 'text-sm font-medium text-muted-foreground hover:text-foreground transition-colors';

  const ghostButtonClassName = isHero
    ? 'gap-2 text-slate-300 hover:text-white hover:bg-slate-800/80'
    : 'gap-2 text-muted-foreground hover:text-foreground hover:bg-accent';

  const mobileMenuClassName = isHero
    ? 'md:hidden py-4 space-y-3 border-t border-slate-800/80 bg-slate-950/95 rounded-b-xl animate-in fade-in-0 slide-in-from-top-2 duration-300'
    : 'md:hidden py-4 space-y-3 border-t border-border bg-background/95 rounded-b-xl animate-in fade-in-0 slide-in-from-top-2 duration-300';

  const mobileLinkClassName = isHero
    ? 'block px-4 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 rounded-lg transition-colors'
    : 'block px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors';

  return (
    <nav className={navbarClassName}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="logo-arrow w-10 h-10 rounded-xl transition-transform group-hover:scale-105">
              <span className="logo-arrow-path" />
              <span className="logo-arrow-shape"><span className="logo-arrow-letter-text">A</span></span>
              <span className="logo-arrow-tip"><span className="logo-arrow-letter-text">I</span></span>
              <span className="logo-arrow-wave" />
            </div>
            <span className="font-bold text-xl bg-gradient-to-r from-emerald-400 to-blue-500 dark:from-emerald-300 dark:to-blue-400 bg-clip-text text-transparent">
              AiKeepTrade
            </span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-8">
            {menuItems.map((item) => (
              item.href.startsWith('#') ? (
                <a
                  key={item.label}
                  href={item.href}
                  className={menuLinkClassName}
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  key={item.label}
                  to={item.href}
                  className={menuLinkClassName}
                >
                  {item.label}
                </Link>
              )
            ))}
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-3">
            <LanguageToggle variant={isHero ? 'dark' : 'light'} />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/login')}
              className={ghostButtonClassName}
            >
              <LogIn className="w-4 h-4" />
              {t('login') || 'Login'}
            </Button>
            <Button
              size="sm"
              onClick={() => navigate('/register')}
              className="gap-2 bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-600 hover:to-blue-700 text-white"
            >
              <UserPlus className="w-4 h-4" />
              {t('register') || 'Sign Up'}
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <LanguageToggle variant={isHero ? 'dark' : 'light'} />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={isHero ? 'text-slate-300 hover:text-white hover:bg-slate-800/80' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className={mobileMenuClassName}>
            {menuItems.map((item) => (
              item.href.startsWith('#') ? (
                <a
                  key={item.label}
                  href={item.href}
                  className={mobileLinkClassName}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  key={item.label}
                  to={item.href}
                  className={mobileLinkClassName}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              )
            ))}
            <div className={`flex flex-col gap-2 px-4 pt-4 ${isHero ? 'border-t border-slate-800/80' : 'border-t border-border'}`}>
              <Button
                variant="outline"
                onClick={() => {
                  navigate('/login');
                  setMobileMenuOpen(false);
                }}
                className={isHero ? 'w-full gap-2 border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white' : 'w-full gap-2'}
              >
                <LogIn className="w-4 h-4" />
                {t('login') || 'Login'}
              </Button>
              <Button
                onClick={() => {
                  navigate('/register');
                  setMobileMenuOpen(false);
                }}
                className="w-full gap-2 bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-600 hover:to-blue-700"
              >
                <UserPlus className="w-4 h-4" />
                {t('register') || 'Sign Up'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
