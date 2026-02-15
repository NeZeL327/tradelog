import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Menu, X, LogIn, UserPlus } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import LanguageToggle from '@/components/LanguageToggle';
import ThemeToggle from '@/components/ThemeToggle';

export default function PublicNavbar() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const menuItems = [
    { label: t('features') || 'Features', href: '#features' },
    { label: t('pricing') || 'Pricing', href: '#pricing' },
    { label: t('about') || 'About', href: '#about' },
    { label: t('contact') || 'Contact', href: '#contact' },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center transition-transform group-hover:scale-105">
              <span className="text-white font-bold text-lg">TJ</span>
            </div>
            <span className="font-bold text-xl bg-gradient-to-r from-emerald-400 to-blue-500 dark:from-emerald-300 dark:to-blue-400 bg-clip-text text-transparent">
              TRADE JOURNAL
            </span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-8">
            {menuItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {item.label}
              </a>
            ))}
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-3">
            <LanguageToggle />
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/Login')}
              className="gap-2"
            >
              <LogIn className="w-4 h-4" />
              {t('login') || 'Login'}
            </Button>
            <Button
              size="sm"
              onClick={() => navigate('/Register')}
              className="gap-2 bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-600 hover:to-blue-700"
            >
              <UserPlus className="w-4 h-4" />
              {t('register') || 'Sign Up'}
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
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
          <div className="md:hidden py-4 space-y-3 border-t border-border">
            {menuItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="block px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.label}
              </a>
            ))}
            <div className="flex flex-col gap-2 px-4 pt-4 border-t border-border">
              <Button
                variant="outline"
                onClick={() => {
                  navigate('/Login');
                  setMobileMenuOpen(false);
                }}
                className="w-full gap-2"
              >
                <LogIn className="w-4 h-4" />
                {t('login') || 'Login'}
              </Button>
              <Button
                onClick={() => {
                  navigate('/Register');
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
