import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Scale } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import Footer from '@/components/Footer';

export default function Terms() {
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
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Scale className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">
                  {isPolish ? 'Regulamin Serwisu' : 'Terms of Service'}
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
                {isPolish ? 'Witamy w Trade Journal' : 'Welcome to Trade Journal'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 text-sm leading-relaxed">
              {/* Section 1 */}
              <section>
                <h2 className="text-xl font-semibold mb-3">
                  {isPolish ? '1. Zakres i akceptacja regulaminu' : '1. Scope and Acceptance'}
                </h2>
                <p className="text-muted-foreground">
                  {isPolish 
                    ? 'Niniejszy regulamin określa zasady korzystania z aplikacji Trade Journal (dalej: „Serwis"). Korzystanie z Serwisu oznacza akceptację wszystkich zawartych tu postanowień. Jeśli nie akceptujesz któregokolwiek z warunków, nie korzystaj z Serwisu.'
                    : 'These Terms of Service govern your use of the Trade Journal application (the "Service"). By accessing or using the Service, you agree to be bound by these Terms. If you do not agree to these Terms, do not use the Service.'}
                </p>
              </section>

              {/* Section 2 */}
              <section>
                <h2 className="text-xl font-semibold mb-3">
                  {isPolish ? '2. Charakter usługi – brak porad inwestycyjnych' : '2. Nature of Service – No Investment Advice'}
                </h2>
                <div className="space-y-2 text-muted-foreground">
                  <p>
                    {isPolish
                      ? 'Trade Journal jest narzędziem do prowadzenia dziennika transakcji i analizy własnych wyników tradingowych.'
                      : 'Trade Journal is a tool for maintaining a trading journal and analyzing your trading performance.'}
                  </p>
                  <p className="font-semibold text-foreground">
                    {isPolish
                      ? '⚠️ Serwis NIE świadczy porad inwestycyjnych ani usług doradztwa finansowego.'
                      : '⚠️ The Service does NOT provide investment advice or financial advisory services.'}
                  </p>
                  <p>
                    {isPolish
                      ? 'Wszelkie dane, statystyki i analizy dostępne w Serwisie mają charakter wyłącznie informacyjny i edukacyjny. Użytkownik ponosi pełną odpowiedzialność za swoje decyzje inwestycyjne.'
                      : 'All data, statistics, and analyses available in the Service are for informational and educational purposes only. You are solely responsible for your investment decisions.'}
                  </p>
                  <p>
                    {isPolish
                      ? 'Trading wiąże się z ryzykiem utraty kapitału. Wyniki historyczne nie gwarantują przyszłych zysków.'
                      : 'Trading involves the risk of capital loss. Past performance does not guarantee future results.'}
                  </p>
                </div>
              </section>

              {/* Section 3 */}
              <section>
                <h2 className="text-xl font-semibold mb-3">
                  {isPolish ? '3. Rejestracja i konto użytkownika' : '3. Registration and User Account'}
                </h2>
                <div className="space-y-2 text-muted-foreground">
                  <p>
                    {isPolish
                      ? 'Aby korzystać z pełnej funkcjonalności Serwisu, musisz utworzyć konto. Zobowiązujesz się podać prawdziwe, aktualne i kompletne dane.'
                      : 'To access the full functionality of the Service, you must create an account. You agree to provide accurate, current, and complete information.'}
                  </p>
                  <p>
                    {isPolish
                      ? 'Jesteś odpowiedzialny za zachowanie poufności swojego hasła i za wszelkie działania podejmowane za pośrednictwem Twojego konta.'
                      : 'You are responsible for maintaining the confidentiality of your password and for all activities that occur under your account.'}
                  </p>
                  <p>
                    {isPolish
                      ? 'Musisz mieć ukończone 18 lat, aby korzystać z Serwisu.'
                      : 'You must be at least 18 years old to use the Service.'}
                  </p>
                </div>
              </section>

              {/* Section 4 */}
              <section>
                <h2 className="text-xl font-semibold mb-3">
                  {isPolish ? '4. Subskrypcje i płatności' : '4. Subscriptions and Payments'}
                </h2>
                <div className="space-y-2 text-muted-foreground">
                  <p>
                    {isPolish
                      ? 'Serwis oferuje płatne plany subskrypcyjne. Szczegóły planów i cennik dostępne są na stronie Cennik.'
                      : 'The Service offers paid subscription plans. Details of plans and pricing are available on the Pricing page.'}
                  </p>
                  <p>
                    {isPolish
                      ? 'Płatności są przetwarzane przez zewnętrznego dostawcę usług płatniczych (Stripe). Składając zamówienie, akceptujesz również warunki tego dostawcy.'
                      : 'Payments are processed by a third-party payment provider (Stripe). By placing an order, you also accept the terms of that provider.'}
                  </p>
                  <p>
                    {isPolish
                      ? 'Subskrypcje odnawiają się automatycznie. Możesz anulować subskrypcję w dowolnym momencie w panelu ustawień konta.'
                      : 'Subscriptions renew automatically. You can cancel your subscription at any time in your account settings panel.'}
                  </p>
                  <p>
                    {isPolish
                      ? 'Nie oferujemy zwrotów za niewykorzystane okresy subskrypcji, chyba że prawo lokalne stanowi inaczej.'
                      : 'We do not offer refunds for unused subscription periods unless required by local law.'}
                  </p>
                </div>
              </section>

              {/* Section 5 */}
              <section>
                <h2 className="text-xl font-semibold mb-3">
                  {isPolish ? '5. Dane użytkownika i prywatność' : '5. User Data and Privacy'}
                </h2>
                <div className="space-y-2 text-muted-foreground">
                  <p>
                    {isPolish
                      ? 'Przetwarzamy Twoje dane osobowe zgodnie z naszą Polityką Prywatności i przepisami RODO (Ogólne Rozporządzenie o Ochronie Danych).'
                      : 'We process your personal data in accordance with our Privacy Policy and GDPR (General Data Protection Regulation).'}
                  </p>
                  <p>
                    {isPolish
                      ? 'Masz prawo dostępu do swoich danych, ich poprawiania, usunięcia oraz przenoszenia. Szczegóły w Polityce Prywatności.'
                      : 'You have the right to access, correct, delete, and port your data. Details are in the Privacy Policy.'}
                  </p>
                  <p>
                    {isPolish
                      ? 'Twoje dane transakcyjne są przechowywane w bezpieczny sposób i nie są udostępniane osobom trzecim bez Twojej zgody.'
                      : 'Your trading data is stored securely and is not shared with third parties without your consent.'}
                  </p>
                </div>
              </section>

              {/* Section 6 */}
              <section>
                <h2 className="text-xl font-semibold mb-3">
                  {isPolish ? '6. Usuwanie konta' : '6. Account Deletion'}
                </h2>
                <div className="space-y-2 text-muted-foreground">
                  <p>
                    {isPolish
                      ? 'Możesz w dowolnym momencie usunąć swoje konto poprzez panel ustawień.'
                      : 'You can delete your account at any time through the settings panel.'}
                  </p>
                  <p>
                    {isPolish
                      ? 'Po usunięciu konta wszystkie Twoje dane osobowe i transakcje zostaną trwale usunięte z naszych serwerów w ciągu 30 dni.'
                      : 'After deleting your account, all your personal data and transactions will be permanently deleted from our servers within 30 days.'}
                  </p>
                  <p>
                    {isPolish
                      ? 'Możemy zachować niektóre dane przez dłuższy czas, jeśli jest to wymagane przez prawo (np. dla celów księgowych lub podatkowych).'
                      : 'We may retain some data for a longer period if required by law (e.g., for accounting or tax purposes).'}
                  </p>
                </div>
              </section>

              {/* Section 7 */}
              <section>
                <h2 className="text-xl font-semibold mb-3">
                  {isPolish ? '7. Zakazy i ograniczenia użytkowania' : '7. Prohibited Uses'}
                </h2>
                <div className="space-y-2 text-muted-foreground">
                  <p>{isPolish ? 'Zabrania się:' : 'You are prohibited from:'}</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>{isPolish ? 'Używania Serwisu w celach nielegalnych' : 'Using the Service for illegal purposes'}</li>
                    <li>{isPolish ? 'Próby uzyskania nieautoryzowanego dostępu do systemów Serwisu' : 'Attempting to gain unauthorized access to the Service systems'}</li>
                    <li>{isPolish ? 'Udostępniania swoich danych logowania osobom trzecim' : 'Sharing your login credentials with third parties'}</li>
                    <li>{isPolish ? 'Wprowadzania fałszywych lub wprowadzających w błąd informacji' : 'Providing false or misleading information'}</li>
                    <li>{isPolish ? 'Kopiowania, modyfikowania lub dystrybucji zawartości Serwisu bez zgody' : 'Copying, modifying, or distributing Service content without permission'}</li>
                  </ul>
                </div>
              </section>

              {/* Section 8 */}
              <section>
                <h2 className="text-xl font-semibold mb-3">
                  {isPolish ? '8. Odpowiedzialność i wyłączenia' : '8. Liability and Disclaimers'}
                </h2>
                <div className="space-y-2 text-muted-foreground">
                  <p>
                    {isPolish
                      ? 'Serwis dostarczany jest "tak jak jest" bez żadnych gwarancji. Nie gwarantujemy nieprzerwanego ani bezbłędnego działania Serwisu.'
                      : 'The Service is provided "as is" without any warranties. We do not guarantee uninterrupted or error-free operation of the Service.'}
                  </p>
                  <p>
                    {isPolish
                      ? 'Nie ponosimy odpowiedzialności za straty wynikające z korzystania lub niemożności korzystania z Serwisu.'
                      : 'We are not liable for losses resulting from the use or inability to use the Service.'}
                  </p>
                  <p>
                    {isPolish
                      ? 'Nie ponosimy odpowiedzialności za decyzje inwestycyjne podejmowane na podstawie danych z Serwisu.'
                      : 'We are not responsible for investment decisions made based on data from the Service.'}
                  </p>
                </div>
              </section>

              {/* Section 9 */}
              <section>
                <h2 className="text-xl font-semibold mb-3">
                  {isPolish ? '9. Zmiany regulaminu' : '9. Changes to Terms'}
                </h2>
                <p className="text-muted-foreground">
                  {isPolish
                    ? 'Zastrzegamy sobie prawo do zmiany niniejszego regulaminu w dowolnym momencie. O istotnych zmianach powiadomimy Cię drogą mailową lub poprzez powiadomienie w Serwisie. Dalsze korzystanie z Serwisu po wprowadzeniu zmian oznacza ich akceptację.'
                    : 'We reserve the right to modify these Terms at any time. We will notify you of significant changes via email or through a notification in the Service. Continued use of the Service after changes are made constitutes acceptance of those changes.'}
                </p>
              </section>

              {/* Section 10 */}
              <section>
                <h2 className="text-xl font-semibold mb-3">
                  {isPolish ? '10. Prawo właściwe i jurysdykcja' : '10. Governing Law and Jurisdiction'}
                </h2>
                <p className="text-muted-foreground">
                  {isPolish
                    ? 'Niniejszy regulamin podlega prawu polskiemu. Wszelkie spory będą rozstrzygane przez sądy właściwe dla siedziby dostawcy Serwisu.'
                    : 'These Terms are governed by Polish law. Any disputes shall be resolved by courts having jurisdiction over the Service provider\'s seat.'}
                </p>
              </section>

              {/* Contact */}
              <section className="pt-6 border-t">
                <h2 className="text-xl font-semibold mb-3">
                  {isPolish ? '11. Kontakt' : '11. Contact'}
                </h2>
                <p className="text-muted-foreground">
                  {isPolish
                    ? 'W razie pytań dotyczących niniejszego regulaminu, skontaktuj się z nami:'
                    : 'If you have any questions about these Terms, please contact us:'}
                </p>
                <p className="text-muted-foreground mt-2">
                  Email: <a href="mailto:support@tradejournal.app" className="text-blue-500 hover:underline">support@tradejournal.app</a>
                </p>
              </section>
            </CardContent>
          </Card>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}
