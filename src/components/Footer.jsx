import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useLanguage } from '@/components/LanguageProvider';

export default function Footer({ variant = 'default' }) {
  const { t } = useLanguage();
  const isHero = variant === 'hero';
  const isApp = variant === 'app';

  const linkClassName = isHero
    ? 'inline-flex items-center text-sm text-white/55 transition-colors duration-200 hover:text-white'
    : isApp
      ? 'inline-flex items-center text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground'
    : 'inline-flex items-center text-sm text-muted-foreground transition-all duration-200 hover:text-foreground hover:translate-x-1';

  const footerClassName = isHero
    ? 'mt-auto w-full border-t border-white/8 bg-[#070a14]/95 backdrop-blur supports-[backdrop-filter]:bg-[#060912]/90'
    : isApp
      ? 'mt-auto w-full border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:dark:bg-background/80'
      : 'mt-auto w-full border-t border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/80';
  
  return (
    <footer className={footerClassName}>
      <div className="container mx-auto px-4 py-10">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-500">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <img
                src="/aikeeptrade-icon-hires.png"
                alt="AiKeepTrade"
                height="36"
                className="h-9 w-9 object-contain"
              />
              <span className={isHero ? 'text-lg font-bold tracking-tight text-white' : isApp ? 'text-lg font-bold tracking-tight text-foreground' : 'text-lg font-bold tracking-tight text-foreground'}>AiKeepTrade</span>
            </div>
            <p className={isHero ? 'max-w-xs text-sm leading-relaxed text-white/55' : isApp ? 'max-w-xs text-sm leading-relaxed text-muted-foreground' : 'max-w-xs text-sm leading-relaxed text-muted-foreground'}>
              {t('footerTagline') || 'Professional trading journal for serious traders'}
            </p>
            <p className={isHero ? 'text-xs text-white/40' : isApp ? 'text-xs text-muted-foreground/80' : 'text-xs text-muted-foreground/80'}>© 2026 AiKeepTrade App</p>
          </div>

          <div className="space-y-4">
            <h3 className={isHero ? 'text-sm font-semibold tracking-wide text-white' : isApp ? 'text-sm font-semibold tracking-wide text-foreground' : 'text-sm font-semibold tracking-wide text-foreground'}>{t('footerNavigation') || 'Navigation'}</h3>
            <ul className="space-y-2.5">
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
            <h3 className={isHero ? 'text-sm font-semibold tracking-wide text-white' : isApp ? 'text-sm font-semibold tracking-wide text-foreground' : 'text-sm font-semibold tracking-wide text-foreground'}>{t('footerAccount') || 'Account'}</h3>
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
            <h3 className={isHero ? 'text-sm font-semibold tracking-wide text-white' : isApp ? 'text-sm font-semibold tracking-wide text-foreground' : 'text-sm font-semibold tracking-wide text-foreground'}>{t('footerLegal') || 'Legal'}</h3>
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
