import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Shield } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import Footer from '@/components/Footer';

export default function Privacy() {
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
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">
                  {isPolish ? 'Polityka Prywatności' : 'Privacy Policy'}
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
                {isPolish ? 'Twoja prywatność ma dla nas znaczenie' : 'Your Privacy Matters to Us'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 text-sm leading-relaxed">
              {/* Introduction */}
              <section>
                <p className="text-muted-foreground">
                  {isPolish
                    ? 'Niniejsza Polityka Prywatności wyjaśnia, jakie dane zbieramy, w jaki sposób je wykorzystujemy i jakie masz prawa w związku z przetwarzaniem Twoich danych osobowych. Zobowiązujemy się chronić Twoją prywatność zgodnie z RODO (Rozporządzenie o Ochronie Danych Osobowych UE 2016/679).'
                    : 'This Privacy Policy explains what data we collect, how we use it, and what rights you have regarding the processing of your personal data. We are committed to protecting your privacy in accordance with GDPR (General Data Protection Regulation EU 2016/679).'}
                </p>
              </section>

              {/* Section 1 */}
              <section>
                <h2 className="text-xl font-semibold mb-3">
                  {isPolish ? '1. Administrator danych' : '1. Data Controller'}
                </h2>
                <div className="space-y-2 text-muted-foreground">
                  <p>
                    {isPolish
                      ? 'Administratorem Twoich danych osobowych jest operator serwisu Trade Journal.'
                      : 'The data controller of your personal data is the operator of Trade Journal.'}
                  </p>
                  <p>
                    {isPolish ? 'Dane kontaktowe:' : 'Contact details:'}
                  </p>
                  <p className="ml-4">
                    Email: <a href="mailto:privacy@tradejournal.app" className="text-blue-500 hover:underline">privacy@tradejournal.app</a>
                  </p>
                </div>
              </section>

              {/* Section 2 */}
              <section>
                <h2 className="text-xl font-semibold mb-3">
                  {isPolish ? '2. Jakie dane zbieramy' : '2. What Data We Collect'}
                </h2>
                <div className="space-y-3 text-muted-foreground">
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">
                      {isPolish ? 'Dane podane przez Ciebie:' : 'Data you provide:'}
                    </h3>
                    <ul className="list-disc list-inside space-y-1 ml-4">
                      <li>{isPolish ? 'Adres email (wymagany do rejestracji)' : 'Email address (required for registration)'}</li>
                      <li>{isPolish ? 'Imię i nazwisko (opcjonalne)' : 'Full name (optional)'}</li>
                      <li>{isPolish ? 'Hasło (przechowywane w bezpiecznej, zaszyfrowanej formie)' : 'Password (stored in secure, encrypted form)'}</li>
                      <li>{isPolish ? 'Dane transakcyjne wprowadzane przez Ciebie (daty, instrumenty, wyniki transakcji, notatki)' : 'Trading data you enter (dates, instruments, trade results, notes)'}</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">
                      {isPolish ? 'Dane zbierane automatycznie:' : 'Automatically collected data:'}
                    </h3>
                    <ul className="list-disc list-inside space-y-1 ml-4">
                      <li>{isPolish ? 'Adres IP' : 'IP address'}</li>
                      <li>{isPolish ? 'Typ przeglądarki i system operacyjny' : 'Browser type and operating system'}</li>
                      <li>{isPolish ? 'Informacje o urządzeniu' : 'Device information'}</li>
                      <li>{isPolish ? 'Dane o korzystaniu z Serwisu (np. czas sesji, odwiedzone strony)' : 'Service usage data (e.g., session time, visited pages)'}</li>
                      <li>{isPolish ? 'Pliki cookies (szczegóły w Polityce Cookies)' : 'Cookies (details in Cookie Policy)'}</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-semibold text-foreground mb-2">
                      {isPolish ? 'Dane płatności:' : 'Payment data:'}
                    </h3>
                    <p>
                      {isPolish
                        ? 'Płatności są przetwarzane przez zewnętrznego dostawcę (Stripe). Nie przechowujemy pełnych danych Twojej karty płatniczej. Stripe przechowuje dane płatnicze zgodnie z PCI DSS.'
                        : 'Payments are processed by a third-party provider (Stripe). We do not store your full payment card data. Stripe stores payment data in compliance with PCI DSS.'}
                    </p>
                  </div>
                </div>
              </section>

              {/* Section 3 */}
              <section>
                <h2 className="text-xl font-semibold mb-3">
                  {isPolish ? '3. W jakim celu przetwarzamy dane' : '3. Purpose of Data Processing'}
                </h2>
                <div className="space-y-2 text-muted-foreground">
                  <p>{isPolish ? 'Twoje dane osobowe przetwarzamy w następujących celach:' : 'We process your personal data for the following purposes:'}</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>{isPolish ? 'Świadczenie usług – umożliwienie korzystania z funkcji Serwisu' : 'Service provision – enabling you to use Service features'}</li>
                    <li>{isPolish ? 'Obsługa konta użytkownika – rejestracja, logowanie, zarządzanie profilem' : 'User account management – registration, login, profile management'}</li>
                    <li>{isPolish ? 'Przetwarzanie subskrypcji i płatności' : 'Processing subscriptions and payments'}</li>
                    <li>{isPolish ? 'Komunikacja z użytkownikami – odpowiedzi na pytania, wsparcie techniczne' : 'User communication – answering questions, technical support'}</li>
                    <li>{isPolish ? 'Bezpieczeństwo – ochrona przed nadużyciami, wykrywanie podejrzanych działań' : 'Security – protection against abuse, detecting suspicious activities'}</li>
                    <li>{isPolish ? 'Analiza i ulepszanie Serwisu – statystyki użytkowania (anonimowe)' : 'Service analysis and improvement – usage statistics (anonymous)'}</li>
                    <li>{isPolish ? 'Marketing (za Twoją zgodą) – wysyłanie newsletterów, ofert promocyjnych' : 'Marketing (with your consent) – sending newsletters, promotional offers'}</li>
                  </ul>
                </div>
              </section>

              {/* Section 4 */}
              <section>
                <h2 className="text-xl font-semibold mb-3">
                  {isPolish ? '4. Podstawa prawna przetwarzania' : '4. Legal Basis for Processing'}
                </h2>
                <div className="space-y-2 text-muted-foreground">
                  <p>{isPolish ? 'Przetwarzamy Twoje dane na podstawie:' : 'We process your data based on:'}</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li><strong>{isPolish ? 'Umowa' : 'Contract'}</strong> – {isPolish ? 'wykonanie umowy o świadczenie usług (art. 6 ust. 1 lit. b RODO)' : 'performance of service contract (Art. 6(1)(b) GDPR)'}</li>
                    <li><strong>{isPolish ? 'Zgoda' : 'Consent'}</strong> – {isPolish ? 'wyrażona przez Ciebie zgoda na przetwarzanie (art. 6 ust. 1 lit. a RODO)' : 'your explicit consent (Art. 6(1)(a) GDPR)'}</li>
                    <li><strong>{isPolish ? 'Prawnie uzasadniony interes' : 'Legitimate interest'}</strong> – {isPolish ? 'np. zapewnienie bezpieczeństwa Serwisu (art. 6 ust. 1 lit. f RODO)' : 'e.g., ensuring Service security (Art. 6(1)(f) GDPR)'}</li>
                    <li><strong>{isPolish ? 'Obowiązek prawny' : 'Legal obligation'}</strong> – {isPolish ? 'np. przechowywanie danych księgowych (art. 6 ust. 1 lit. c RODO)' : 'e.g., storing accounting records (Art. 6(1)(c) GDPR)'}</li>
                  </ul>
                </div>
              </section>

              {/* Section 5 */}
              <section>
                <h2 className="text-xl font-semibold mb-3">
                  {isPolish ? '5. Udostępnianie danych osobom trzecim' : '5. Sharing Data with Third Parties'}
                </h2>
                <div className="space-y-2 text-muted-foreground">
                  <p>
                    {isPolish
                      ? 'Nie sprzedajemy ani nie udostępniamy Twoich danych osobowych osobom trzecim w celach marketingowych.'
                      : 'We do not sell or share your personal data with third parties for marketing purposes.'}
                  </p>
                  <p>{isPolish ? 'Udostępniamy dane wyłącznie:' : 'We share data only:'}</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>{isPolish ? 'Dostawcom usług technicznych (hosting, bazy danych, przetwarzanie płatności – Stripe, Firebase)' : 'Technical service providers (hosting, databases, payment processing – Stripe, Firebase)'}</li>
                    <li>{isPolish ? 'W przypadku wymogu prawnego (np. organy ścigania, sąd)' : 'In case of legal requirement (e.g., law enforcement, court)'}</li>
                    <li>{isPolish ? 'Za Twoją wyraźną zgodą' : 'With your explicit consent'}</li>
                  </ul>
                  <p className="mt-2">
                    {isPolish
                      ? 'Wszyscy nasi partnerzy są zobowiązani do ochrony danych zgodnie z RODO i mają podpisane umowy powierzenia przetwarzania danych.'
                      : 'All our partners are required to protect data in accordance with GDPR and have signed data processing agreements.'}
                  </p>
                </div>
              </section>

              {/* Section 6 */}
              <section>
                <h2 className="text-xl font-semibold mb-3">
                  {isPolish ? '6. Jak długo przechowujemy dane' : '6. Data Retention Period'}
                </h2>
                <div className="space-y-2 text-muted-foreground">
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>{isPolish ? 'Dane konta użytkownika – do momentu usunięcia konta lub wycofania zgody' : 'User account data – until account deletion or consent withdrawal'}</li>
                    <li>{isPolish ? 'Dane transakcyjne – przez okres aktywności konta' : 'Trading data – for the duration of account activity'}</li>
                    <li>{isPolish ? 'Dane księgowe i płatnicze – przez okres wymagany prawem (do 5 lat)' : 'Accounting and payment data – as required by law (up to 5 years)'}</li>
                    <li>{isPolish ? 'Dane marketingowe – do momentu wycofania zgody' : 'Marketing data – until consent withdrawal'}</li>
                    <li>{isPolish ? 'Logi bezpieczeństwa – do 12 miesięcy' : 'Security logs – up to 12 months'}</li>
                  </ul>
                  <p className="mt-2">
                    {isPolish
                      ? 'Po upływie okresu przechowywania dane są automatycznie usuwane lub anonimizowane.'
                      : 'After the retention period, data is automatically deleted or anonymized.'}
                  </p>
                </div>
              </section>

              {/* Section 7 */}
              <section>
                <h2 className="text-xl font-semibold mb-3">
                  {isPolish ? '7. Twoje prawa (RODO)' : '7. Your Rights (GDPR)'}
                </h2>
                <div className="space-y-2 text-muted-foreground">
                  <p>{isPolish ? 'Zgodnie z RODO masz prawo do:' : 'Under GDPR, you have the right to:'}</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li><strong>{isPolish ? 'Dostępu' : 'Access'}</strong> – {isPolish ? 'uzyskania informacji o przetwarzanych danych' : 'obtain information about processed data'}</li>
                    <li><strong>{isPolish ? 'Sprostowania' : 'Rectification'}</strong> – {isPolish ? 'poprawiania nieprawidłowych danych' : 'correct inaccurate data'}</li>
                    <li><strong>{isPolish ? 'Usunięcia' : 'Erasure'}</strong> – {isPolish ? 'usunięcia danych ("prawo do bycia zapomnianym")' : 'delete data ("right to be forgotten")'}</li>
                    <li><strong>{isPolish ? 'Ograniczenia przetwarzania' : 'Restriction'}</strong> – {isPolish ? 'ograniczenia sposobu przetwarzania' : 'limit the way data is processed'}</li>
                    <li><strong>{isPolish ? 'Przenoszenia danych' : 'Data portability'}</strong> – {isPolish ? 'otrzymania danych w formacie umożliwiającym przeniesienie' : 'receive data in a portable format'}</li>
                    <li><strong>{isPolish ? 'Sprzeciwu' : 'Objection'}</strong> – {isPolish ? 'wniesienia sprzeciwu wobec przetwarzania' : 'object to data processing'}</li>
                    <li><strong>{isPolish ? 'Wycofania zgody' : 'Withdraw consent'}</strong> – {isPolish ? 'w dowolnym momencie' : 'at any time'}</li>
                    <li><strong>{isPolish ? 'Skargi' : 'Complaint'}</strong> – {isPolish ? 'wniesienia skargi do organu nadzorczego (UODO w Polsce)' : 'lodge a complaint with supervisory authority'}</li>
                  </ul>
                  <p className="mt-3">
                    {isPolish
                      ? 'Aby skorzystać ze swoich praw, skontaktuj się z nami: '
                      : 'To exercise your rights, contact us: '}
                    <a href="mailto:privacy@tradejournal.app" className="text-blue-500 hover:underline">privacy@tradejournal.app</a>
                  </p>
                </div>
              </section>

              {/* Section 8 */}
              <section>
                <h2 className="text-xl font-semibold mb-3">
                  {isPolish ? '8. Bezpieczeństwo danych' : '8. Data Security'}
                </h2>
                <div className="space-y-2 text-muted-foreground">
                  <p>
                    {isPolish
                      ? 'Stosujemy odpowiednie środki techniczne i organizacyjne, aby chronić Twoje dane przed nieautoryzowanym dostępem, utratą lub zniszczeniem:'
                      : 'We implement appropriate technical and organizational measures to protect your data against unauthorized access, loss, or destruction:'}
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>{isPolish ? 'Szyfrowanie połączeń SSL/TLS' : 'SSL/TLS connection encryption'}</li>
                    <li>{isPolish ? 'Szyfrowanie haseł (hashing)' : 'Password encryption (hashing)'}</li>
                    <li>{isPolish ? 'Zapory sieciowe (firewall)' : 'Firewalls'}</li>
                    <li>{isPolish ? 'Regularne kopie zapasowe' : 'Regular backups'}</li>
                    <li>{isPolish ? 'Kontrola dostępu – tylko uprawnieni pracownicy mają dostęp do danych' : 'Access control – only authorized personnel have data access'}</li>
                  </ul>
                </div>
              </section>

              {/* Section 9 */}
              <section>
                <h2 className="text-xl font-semibold mb-3">
                  {isPolish ? '9. Zmiany w Polityce Prywatności' : '9. Changes to Privacy Policy'}
                </h2>
                <p className="text-muted-foreground">
                  {isPolish
                    ? 'Możemy aktualizować niniejszą Politykę Prywatności. O istotnych zmianach powiadomimy Cię przez email lub powiadomienie w Serwisie. Zalecamy regularne sprawdzanie tej strony.'
                    : 'We may update this Privacy Policy. We will notify you of significant changes via email or Service notification. We recommend checking this page regularly.'}
                </p>
              </section>

              {/* Contact */}
              <section className="pt-6 border-t">
                <h2 className="text-xl font-semibold mb-3">
                  {isPolish ? '10. Kontakt' : '10. Contact'}
                </h2>
                <p className="text-muted-foreground">
                  {isPolish
                    ? 'W razie pytań dotyczących przetwarzania danych osobowych:'
                    : 'If you have questions about personal data processing:'}
                </p>
                <div className="mt-2 space-y-1">
                  <p className="text-muted-foreground">
                    Email: <a href="mailto:privacy@tradejournal.app" className="text-blue-500 hover:underline">privacy@tradejournal.app</a>
                  </p>
                  <p className="text-muted-foreground">
                    {isPolish ? 'Odpowiemy na Twoje zapytanie w ciągu 30 dni.' : 'We will respond to your inquiry within 30 days.'}
                  </p>
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
