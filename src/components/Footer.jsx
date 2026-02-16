import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useLanguage } from '@/components/LanguageProvider';
import { Instagram, Facebook } from 'lucide-react';

export default function Footer() {
  const { t } = useLanguage();
  
  return (
    <footer className="w-full border-t border-slate-800 bg-slate-950/95 backdrop-blur mt-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
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
                  to={createPageUrl("Dashboard")} 
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  {t('dashboard') || 'Dashboard'}
                </Link>
              </li>
              <li>
                <Link 
                  to={createPageUrl("Billing")} 
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  {t('pricing') || 'Pricing'}
                </Link>
              </li>
              <li>
                <a 
                  href="#faq" 
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  FAQ
                </a>
              </li>
              <li>
                <a 
                  href="#contact" 
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  {t('contact') || 'Contact'}
                </a>
              </li>
            </ul>
          </div>

          {/* Sekcja 3: Konto */}
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
              <li>
                <Link 
                  to="/reset-password" 
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  {t('resetPassword') || 'Reset Password'}
                </Link>
              </li>
            </ul>
          </div>

          {/* Sekcja 4: Legal & Social */}
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
            
            {/* Social Media Icons */}
            <div className="pt-4">
              <h4 className="font-semibold text-sm text-white mb-3">{t('footerFollowUs') || 'Follow Us'}</h4>
              <div className="flex gap-3">
                <a 
                  href="#" 
                  className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors text-slate-300"
                  aria-label="Instagram"
                >
                  <Instagram className="w-4 h-4" />
                </a>
                <a 
                  href="#" 
                  className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors text-slate-300"
                  aria-label="Facebook"
                >
                  <Facebook className="w-4 h-4" />
                </a>
                <a 
                  href="#" 
                  className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors text-slate-300"
                  aria-label="TikTok"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 pt-6 border-t border-slate-800 text-center">
          <p className="text-xs text-slate-500">
            {t('footerDisclaimer') || 'This application does not provide investment advice. Trading involves risk. Past performance is not indicative of future results.'}
          </p>
        </div>
      </div>
    </footer>
  );
}
