import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useLanguage } from '@/components/LanguageProvider';

export default function Footer() {
  const { t } = useLanguage();
  
  return (
    <footer className="w-full border-t border-slate-800 bg-slate-950/95 backdrop-blur mt-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Sekcja 1: Logo i copyright */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">TL</span>
              </div>
              <span className="font-semibold text-lg text-white">Trade Log</span>
            </div>
            <p className="text-sm text-slate-400">
              {t('footerTagline') || 'Professional trading journal for serious traders'}
            </p>
            <p className="text-xs text-slate-500">
              © 2026 Trade Log App
            </p>
          </div>

          {/* Sekcja 2: Nawigacja */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-white">{t('footerNavigation') || 'Navigation'}</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link 
                  to="/pricing" 
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  {t('pricing') || 'Pricing'}
                </Link>
              </li>
              <li>
                <Link 
                  to="/about" 
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  {t('about') || 'About'}
                </Link>
              </li>
              <li>
                <Link 
                  to="/contact" 
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  {t('contact') || 'Contact'}
                </Link>
              </li>
            </ul>
          </div>

          {/* Sekcja 3: Konto + Legal */}
          <div className="space-y-5">
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-white">{t('footerAccount') || 'Account'}</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link 
                    to={createPageUrl("Login")} 
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    {t('login') || 'Login'}
                  </Link>
                </li>
                <li>
                  <Link 
                    to={createPageUrl("Register")} 
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    {t('register') || 'Sign Up'}
                  </Link>
                </li>
              </ul>
            </div>
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-white">{t('footerLegal') || 'Legal'}</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link 
                    to="/terms" 
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    {t('termsOfService') || 'Terms of Service'}
                  </Link>
                </li>
                <li>
                  <Link 
                    to="/privacy" 
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    {t('privacyPolicy') || 'Privacy Policy'}
                  </Link>
                </li>
                <li>
                  <Link 
                    to="/cookies" 
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    {t('cookiesPolicy') || 'Cookies Policy'}
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
