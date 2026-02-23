import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useLanguage } from '@/components/LanguageProvider';

export default function Footer({ variant = 'default' }) {
  const { t } = useLanguage();
  const isHero = variant === 'hero';
  const isApp = variant === 'app';

  const linkClassName = isHero
    ? 'inline-flex items-center text-sm text-slate-400 transition-all duration-200 hover:text-slate-100 hover:translate-x-1'
    : isApp
      ? 'inline-flex items-center text-sm text-slate-500 dark:text-slate-400 transition-all duration-200 hover:text-slate-800 dark:hover:text-slate-100 hover:translate-x-1'
    : 'inline-flex items-center text-sm text-muted-foreground transition-all duration-200 hover:text-foreground hover:translate-x-1';

  const footerClassName = isHero
    ? 'mt-auto w-full border-t border-slate-800/70 bg-gradient-to-r from-slate-950/95 via-blue-950/70 to-slate-950/95 backdrop-blur supports-[backdrop-filter]:bg-slate-950/85'
    : isApp
      ? 'mt-auto w-full border-t border-slate-200/70 dark:border-white/10 bg-gradient-to-r from-slate-50/95 via-blue-50/85 to-slate-50/95 dark:from-[#0f0f16]/95 dark:via-[#121827]/85 dark:to-[#14141f]/95 backdrop-blur supports-[backdrop-filter]:dark:bg-[#121827]/80'
      : 'mt-auto w-full border-t border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/80';
  
  return (
    <footer className={footerClassName}>
      <div className="container mx-auto px-4 py-10">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-500">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm shadow-sm">
                TL
              </div>
              <span className={isHero ? 'text-base font-semibold text-slate-100' : isApp ? 'text-base font-semibold text-slate-800 dark:text-slate-100' : 'text-base font-semibold text-foreground'}>Trade Log</span>
            </div>
            <p className={isHero ? 'max-w-xs text-sm leading-relaxed text-slate-400' : isApp ? 'max-w-xs text-sm leading-relaxed text-slate-500 dark:text-slate-400' : 'max-w-xs text-sm leading-relaxed text-muted-foreground'}>
              {t('footerTagline') || 'Professional trading journal for serious traders'}
            </p>
            <p className={isHero ? 'text-xs text-slate-500' : isApp ? 'text-xs text-slate-500/90 dark:text-slate-500' : 'text-xs text-muted-foreground/80'}>© 2026 Trade Log App</p>
          </div>

          <div className="space-y-4">
            <h3 className={isHero ? 'text-sm font-semibold tracking-wide text-slate-100' : isApp ? 'text-sm font-semibold tracking-wide text-slate-800 dark:text-slate-100' : 'text-sm font-semibold tracking-wide text-foreground'}>{t('footerNavigation') || 'Navigation'}</h3>
            <ul className="space-y-2.5">
              <li>
                <Link to="/pricing" className={linkClassName}>
                  {t('pricing') || 'Pricing'}
                </Link>
              </li>
              <li>
                <Link to="/about" className={linkClassName}>
                  {t('about') || 'About'}
                </Link>
              </li>
              <li>
                <Link to="/contact" className={linkClassName}>
                  {t('contact') || 'Contact'}
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className={isHero ? 'text-sm font-semibold tracking-wide text-slate-100' : isApp ? 'text-sm font-semibold tracking-wide text-slate-800 dark:text-slate-100' : 'text-sm font-semibold tracking-wide text-foreground'}>{t('footerAccount') || 'Account'}</h3>
            <ul className="space-y-2.5">
              <li>
                <Link to={createPageUrl("Login")} className={linkClassName}>
                  {t('login') || 'Login'}
                </Link>
              </li>
              <li>
                <Link to={createPageUrl("Register")} className={linkClassName}>
                  {t('register') || 'Sign Up'}
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className={isHero ? 'text-sm font-semibold tracking-wide text-slate-100' : isApp ? 'text-sm font-semibold tracking-wide text-slate-800 dark:text-slate-100' : 'text-sm font-semibold tracking-wide text-foreground'}>{t('footerLegal') || 'Legal'}</h3>
            <ul className="space-y-2.5">
              <li>
                <Link to="/terms" className={linkClassName}>
                  {t('termsOfService') || 'Terms of Service'}
                </Link>
              </li>
              <li>
                <Link to="/privacy" className={linkClassName}>
                  {t('privacyPolicy') || 'Privacy Policy'}
                </Link>
              </li>
              <li>
                <Link to="/cookies" className={linkClassName}>
                  {t('cookiesPolicy') || 'Cookies Policy'}
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
