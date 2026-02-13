import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Cookie } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import Footer from '@/components/Footer';

export default function Cookies() {
  const { t, language } = useLanguage();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const isPolish = language === 'pl';

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="container mx-auto px-4 py-8 flex-1">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <Link to="/">
              <Button variant="ghost" size="sm" className="mb-4">
                <ArrowLeft className="w-4 h-4 mr-2" />
                {isPolish ? 'Powrót' : 'Back'}
              </Button>
            </Link>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <Cookie className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">
                  {isPolish ? 'Polityka Cookies' : 'Cookie Policy'}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {isPolish ? 'Ostatnia aktualizacja: 13 lutego 2026' : 'Last updated: February 13, 2026'}
                </p>
              </div>
            </div>
          </div>

          {/* Content */}
          <Card>
            <CardHeader>
              <CardTitle>
                {isPolish ? 'Jak używamy plików cookies' : 'How We Use Cookies'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 text-sm leading-relaxed">
              {/* Introduction */}
              <section>
                <p className="text-muted-foreground">
                  {isPolish
                    ? 'Ta polityka wyjaśnia, czym są pliki cookies, jak ich używamy w Trade Journal oraz jakie masz możliwości kontroli nad nimi.'
                    : 'This policy explains what cookies are, how we use them in Trade Journal, and what control options you have.'}
                </p>
              </section>

              {/* Section 1 */}
              <section>
                <h2 className="text-xl font-semibold mb-3">
                  {isPolish ? '1. Czym są pliki cookies?' : '1. What are Cookies?'}
                </h2>
                <div className="space-y-2 text-muted-foreground">
                  <p>
                    {isPolish
                      ? 'Pliki cookies to małe pliki tekstowe zapisywane na Twoim urządzeniu (komputer, smartfon, tablet) podczas korzystania ze stron internetowych. Cookies pozwalają stronie zapamiętać Twoje działania i preferencje przez określony czas.'
                      : 'Cookies are small text files stored on your device (computer, smartphone, tablet) when you browse websites. Cookies allow the site to remember your actions and preferences over time.'}
                  </p>
                  <p>
                    {isPolish
                      ? 'Używanie plików cookies jest standardową praktyką w Internecie i umożliwia poprawne funkcjonowanie wielu serwisów.'
                      : 'Using cookies is a standard practice on the Internet and enables proper functioning of many services.'}
                  </p>
                </div>
              </section>

              {/* Section 2 */}
              <section>
                <h2 className="text-xl font-semibold mb-3">
                  {isPolish ? '2. Jakie pliki cookies używamy' : '2. Types of Cookies We Use'}
                </h2>
                <div className="space-y-4 text-muted-foreground">
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">
                      {isPolish ? 'a) Cookies niezbędne (Essential Cookies)' : 'a) Essential Cookies'}
                    </h3>
                    <p>
                      {isPolish
                        ? 'Te pliki są niezbędne do działania Serwisu. Umożliwiają podstawowe funkcje, takie jak logowanie, nawigacja po stronie, dostęp do chronionych obszarów. Bez tych plików Serwis nie może działać prawidłowo.'
                        : 'These files are essential for the Service to function. They enable basic features such as login, page navigation, and access to protected areas. Without these files, the Service cannot work properly.'}
                    </p>
                    <p className="mt-2">
                      <strong>{isPolish ? 'Przykłady:' : 'Examples:'}</strong>
                    </p>
                    <ul className="list-disc list-inside space-y-1 ml-4">
                      <li>{isPolish ? 'Token sesji (session ID) – zapamiętuje, że jesteś zalogowany' : 'Session token (session ID) – remembers that you are logged in'}</li>
                      <li>{isPolish ? 'Token uwierzytelniania (auth token)' : 'Authentication token (auth token)'}</li>
                      <li>{isPolish ? 'Preferencje językowe' : 'Language preferences'}</li>
                    </ul>
                    <p className="mt-2 text-sm">
                      {isPolish
                        ? '⚠️ Nie możesz wyłączyć tych plików cookies, ponieważ są one niezbędne do działania Serwisu.'
                        : '⚠️ You cannot disable these cookies as they are essential for the Service to function.'}
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-foreground mb-2">
                      {isPolish ? 'b) Cookies funkcjonalne (Functional Cookies)' : 'b) Functional Cookies'}
                    </h3>
                    <p>
                      {isPolish
                        ? 'Te pliki pozwalają na zapamiętanie wyborów dokonanych przez Ciebie (np. motyw kolorystyczny, rozmiar czcionki) i zapewniają bardziej spersonalizowane funkcje.'
                        : 'These files allow the site to remember your choices (e.g., color theme, font size) and provide more personalized features.'}
                    </p>
                    <p className="mt-2">
                      <strong>{isPolish ? 'Przykłady:' : 'Examples:'}</strong>
                    </p>
                    <ul className="list-disc list-inside space-y-1 ml-4">
                      <li>{isPolish ? 'Motyw (jasny/ciemny)' : 'Theme (light/dark)'}</li>
                      <li>{isPolish ? 'Ustawienia wyświetlania' : 'Display settings'}</li>
                      <li>{isPolish ? 'Preferencje użytkownika' : 'User preferences'}</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-semibold text-foreground mb-2">
                      {isPolish ? 'c) Cookies analityczne (Analytics Cookies)' : 'c) Analytics Cookies'}
                    </h3>
                    <p>
                      {isPolish
                        ? 'Te pliki zbierają informacje o tym, jak użytkownicy korzystają z Serwisu (np. które strony są najczęściej odwiedzane, ile czasu spędzają na stronie). Dane są agregowane i anonimowe – nie identyfikują Ciebie osobiście.'
                        : 'These files collect information about how users interact with the Service (e.g., which pages are most visited, how long they spend on the site). Data is aggregated and anonymous – it does not identify you personally.'}
                    </p>
                    <p className="mt-2">
                      <strong>{isPolish ? 'Przykłady:' : 'Examples:'}</strong>
                    </p>
                    <ul className="list-disc list-inside space-y-1 ml-4">
                      <li>Google Analytics (opcjonalnie)</li>
                      <li>{isPolish ? 'Wewnętrzne statystyki użytkowania' : 'Internal usage statistics'}</li>
                    </ul>
                    <p className="mt-2">
                      {isPolish
                        ? 'Te pliki pomagają nam ulepszać Serwis i rozumieć, jak użytkownicy z niego korzystają.'
                        : 'These files help us improve the Service and understand how users interact with it.'}
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-foreground mb-2">
                      {isPolish ? 'd) Cookies marketingowe (Marketing Cookies)' : 'd) Marketing Cookies'}
                    </h3>
                    <p>
                      {isPolish
                        ? 'Te pliki służą do wyświetlania reklam dopasowanych do Twoich zainteresowań. Mogą być używane przez zewnętrzne firmy reklamowe.'
                        : 'These files are used to display ads tailored to your interests. They may be used by external advertising companies.'}
                    </p>
                    <p className="mt-2 text-sm">
                      {isPolish
                        ? 'ℹ️ Obecnie nie używamy plików cookies marketingowych w Trade Journal.'
                        : 'ℹ️ We currently do not use marketing cookies in Trade Journal.'}
                    </p>
                  </div>
                </div>
              </section>

              {/* Section 3 */}
              <section>
                <h2 className="text-xl font-semibold mb-3">
                  {isPolish ? '3. Cookies stron trzecich' : '3. Third-Party Cookies'}
                </h2>
                <div className="space-y-2 text-muted-foreground">
                  <p>
                    {isPolish
                      ? 'Niektóre pliki cookies mogą być ustawiane przez zewnętrzne serwisy używane w Trade Journal:'
                      : 'Some cookies may be set by external services used in Trade Journal:'}
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li><strong>Firebase</strong> – {isPolish ? 'uwierzytelnianie i baza danych' : 'authentication and database'}</li>
                    <li><strong>Stripe</strong> – {isPolish ? 'przetwarzanie płatności' : 'payment processing'}</li>
                    <li><strong>Google Analytics</strong> – {isPolish ? 'analiza ruchu (jeśli włączona)' : 'traffic analysis (if enabled)'}</li>
                  </ul>
                  <p className="mt-2">
                    {isPolish
                      ? 'Te serwisy mają własne polityki cookies i prywatności. Zalecamy ich zapoznanie się z nimi.'
                      : 'These services have their own cookie and privacy policies. We recommend reviewing them.'}
                  </p>
                </div>
              </section>

              {/* Section 4 */}
              <section>
                <h2 className="text-xl font-semibold mb-3">
                  {isPolish ? '4. Jak zarządzać plikami cookies' : '4. How to Manage Cookies'}
                </h2>
                <div className="space-y-3 text-muted-foreground">
                  <p>
                    {isPolish
                      ? 'Możesz kontrolować i zarządzać plikami cookies na kilka sposobów:'
                      : 'You can control and manage cookies in several ways:'}
                  </p>
                  
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">
                      {isPolish ? 'a) Ustawienia przeglądarki' : 'a) Browser Settings'}
                    </h3>
                    <p>
                      {isPolish
                        ? 'Większość przeglądarek automatycznie akceptuje pliki cookies, ale możesz zmienić ustawienia, aby je blokować lub usuwać.'
                        : 'Most browsers automatically accept cookies, but you can change settings to block or delete them.'}
                    </p>
                    <p className="mt-2">
                      {isPolish ? 'Instrukcje dla popularnych przeglądarek:' : 'Instructions for popular browsers:'}
                    </p>
                    <ul className="list-disc list-inside space-y-1 ml-4">
                      <li><strong>Chrome:</strong> {isPolish ? 'Ustawienia → Prywatność i bezpieczeństwo → Pliki cookie' : 'Settings → Privacy and Security → Cookies'}</li>
                      <li><strong>Firefox:</strong> {isPolish ? 'Opcje → Prywatność i bezpieczeństwo → Ciasteczka' : 'Options → Privacy & Security → Cookies'}</li>
                      <li><strong>Safari:</strong> {isPolish ? 'Preferencje → Prywatność → Pliki cookie' : 'Preferences → Privacy → Cookies'}</li>
                      <li><strong>Edge:</strong> {isPolish ? 'Ustawienia → Prywatność → Pliki cookie' : 'Settings → Privacy → Cookies'}</li>
                    </ul>
                    <p className="mt-2 text-sm">
                      {isPolish
                        ? '⚠️ Uwaga: Zablokowanie niektórych plików cookies może wpłynąć na funkcjonalność Serwisu.'
                        : '⚠️ Note: Blocking some cookies may affect the functionality of the Service.'}
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-foreground mb-2">
                      {isPolish ? 'b) Panel preferencji cookies' : 'b) Cookie Preferences Panel'}
                    </h3>
                    <p>
                      {isPolish
                        ? 'W przyszłości planujemy dodać panel zarządzania plikami cookies bezpośrednio w Serwisie, gdzie będziesz mógł włączać/wyłączać poszczególne kategorie plików cookies.'
                        : 'We plan to add a cookie management panel directly in the Service where you can enable/disable individual cookie categories.'}
                    </p>
                  </div>
                </div>
              </section>

              {/* Section 5 */}
              <section>
                <h2 className="text-xl font-semibold mb-3">
                  {isPolish ? '5. Czas przechowywania plików cookies' : '5. Cookie Retention Period'}
                </h2>
                <div className="space-y-2 text-muted-foreground">
                  <p>{isPolish ? 'Pliki cookies mogą być przechowywane przez różny czas:' : 'Cookies may be stored for varying periods:'}</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li><strong>{isPolish ? 'Cookies sesyjne' : 'Session cookies'}</strong> – {isPolish ? 'usuwane automatycznie po zamknięciu przeglądarki' : 'automatically deleted when you close the browser'}</li>
                    <li><strong>{isPolish ? 'Cookies trwałe' : 'Persistent cookies'}</strong> – {isPolish ? 'pozostają na urządzeniu przez określony czas (od kilku dni do kilku lat, w zależności od typu)' : 'remain on your device for a specified time (from a few days to several years, depending on type)'}</li>
                  </ul>
                </div>
              </section>

              {/* Section 6 */}
              <section>
                <h2 className="text-xl font-semibold mb-3">
                  {isPolish ? '6. Więcej informacji' : '6. More Information'}
                </h2>
                <div className="space-y-2 text-muted-foreground">
                  <p>
                    {isPolish
                      ? 'Jeśli masz pytania dotyczące używania plików cookies w Trade Journal, skontaktuj się z nami:'
                      : 'If you have questions about the use of cookies in Trade Journal, contact us:'}
                  </p>
                  <p className="mt-2">
                    Email: <a href="mailto:privacy@tradejournal.app" className="text-blue-500 hover:underline">privacy@tradejournal.app</a>
                  </p>
                  <p className="mt-3">
                    {isPolish
                      ? 'Więcej informacji o plikach cookies znajdziesz na stronie:'
                      : 'More information about cookies can be found at:'}
                  </p>
                  <p>
                    <a href="https://www.allaboutcookies.org" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                      www.allaboutcookies.org
                    </a>
                  </p>
                </div>
              </section>

              {/* Section 7 */}
              <section>
                <h2 className="text-xl font-semibold mb-3">
                  {isPolish ? '7. Zmiany w Polityce Cookies' : '7. Changes to Cookie Policy'}
                </h2>
                <p className="text-muted-foreground">
                  {isPolish
                    ? 'Możemy aktualizować niniejszą Politykę Cookies. Wszelkie zmiany będą publikowane na tej stronie wraz z nową datą aktualizacji.'
                    : 'We may update this Cookie Policy. Any changes will be posted on this page with a new update date.'}
                </p>
              </section>

              {/* Summary Table */}
              <section className="pt-6 border-t">
                <h2 className="text-xl font-semibold mb-3">
                  {isPolish ? 'Podsumowanie – tabela plików cookies' : 'Summary – Cookie Table'}
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border">
                    <thead className="bg-muted">
                      <tr>
                        <th className="p-2 text-left border">{isPolish ? 'Typ' : 'Type'}</th>
                        <th className="p-2 text-left border">{isPolish ? 'Cel' : 'Purpose'}</th>
                        <th className="p-2 text-left border">{isPolish ? 'Czas przechowywania' : 'Duration'}</th>
                      </tr>
                    </thead>
                    <tbody className="text-muted-foreground">
                      <tr>
                        <td className="p-2 border font-semibold">{isPolish ? 'Niezbędne' : 'Essential'}</td>
                        <td className="p-2 border">{isPolish ? 'Uwierzytelnianie, sesja' : 'Authentication, session'}</td>
                        <td className="p-2 border">{isPolish ? 'Sesja / 30 dni' : 'Session / 30 days'}</td>
                      </tr>
                      <tr>
                        <td className="p-2 border font-semibold">{isPolish ? 'Funkcjonalne' : 'Functional'}</td>
                        <td className="p-2 border">{isPolish ? 'Preferencje użytkownika' : 'User preferences'}</td>
                        <td className="p-2 border">{isPolish ? '1 rok' : '1 year'}</td>
                      </tr>
                      <tr>
                        <td className="p-2 border font-semibold">{isPolish ? 'Analityczne' : 'Analytics'}</td>
                        <td className="p-2 border">{isPolish ? 'Statystyki użytkowania' : 'Usage statistics'}</td>
                        <td className="p-2 border">{isPolish ? '2 lata' : '2 years'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            </CardContent>
          </Card>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}
