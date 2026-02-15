import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Code, Rocket, Target, Users, TrendingUp } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import PublicNavbar from '@/components/PublicNavbar';
import Footer from '@/components/Footer';
import { Card, CardContent } from '@/components/ui/card';

export default function About() {
  const { t } = useLanguage();

  const features = [
    {
      icon: <Target className="w-6 h-6" />,
      title: "Analiza transakcji",
      description: "Śledź swoje wyniki i analizuj strategie handlowe"
    },
    {
      icon: <TrendingUp className="w-6 h-6" />,
      title: "Statystyki w czasie rzeczywistym",
      description: "Przegląd wydajności i postępów na bieżąco"
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: "Wspólnota traderów",
      description: "Dołącz do rosnącej społeczności profesjonalistów"
    }
  ];

  return (
    <>
      <PublicNavbar />
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pt-24 pb-12">
        <div className="container mx-auto px-4 max-w-6xl">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-emerald-400 to-blue-500 bg-clip-text text-transparent mb-4">
              O Trade Log
            </h1>
            <p className="text-slate-400 text-lg max-w-3xl mx-auto">
              Historia powstania profesjonalnego dziennika handlowego stworzonego w niekonwencjonalny sposób
            </p>
          </motion.div>

          {/* Hero Image/Logo Section */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-16"
          >
            <Card className="bg-gradient-to-br from-slate-900/80 to-slate-800/80 border-slate-700 overflow-hidden">
              <CardContent className="p-12">
                <div className="flex items-center justify-center">
                  <div className="relative">
                    <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center shadow-2xl shadow-blue-500/50">
                      <span className="text-white font-bold text-6xl">TL</span>
                    </div>
                    <div className="absolute -top-4 -right-4">
                      <Sparkles className="w-12 h-12 text-yellow-400 animate-pulse" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Story Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="space-y-8 mb-16"
          >
            <Card className="bg-slate-900/50 border-slate-800">
              <CardContent className="p-8 space-y-6 text-slate-300 leading-relaxed">
                <div className="flex items-center gap-3 mb-4">
                  <Code className="w-8 h-8 text-emerald-400" />
                  <h2 className="text-3xl font-bold text-slate-100">Niezwykła Historia Powstania</h2>
                </div>
                
                <p className="text-lg">
                  Trade Log to wyjątkowy projekt, który udowadnia, że w erze sztucznej inteligencji granice między możliwym 
                  a niemożliwym zacierają się w niesamowity sposób. Ta aplikacja powstała dzięki wizji, determinacji 
                  i... całkowitemu brakowi znajomości programowania!
                </p>

                <p className="text-lg">
                  Wyobraź sobie: osoba, która nigdy wcześniej nie napisała ani linii kodu, która nie znała różnicy między 
                  JavaScript a Java, stworzyła w pełni funkcjonalny, profesjonalny dziennik handlowy. Brzmi jak science 
                  fiction? A jednak to prawda!
                </p>

                <div className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border-l-4 border-emerald-500 p-6 rounded-r-lg">
                  <p className="text-lg font-semibold text-emerald-200 mb-2">
                    Sekret? Współpraca z AI! 🤖✨
                  </p>
                  <p className="text-base">
                    Każda funkcja, każdy komponent, każda linia kodu w tej aplikacji powstała w naturalnej konwersacji 
                    z asystentem AI. Nie było szkoleń programistycznych, kursów czy bootcampów - tylko pomysł, 
                    komunikacja i wytrwałość.
                  </p>
                </div>

                <p className="text-lg">
                  Ten projekt to dowód na rewolucję, która właśnie się dokonuje. AI nie zastępuje programistów - 
                  daje możliwości każdemu, kto ma wizję. Trade Log nie jest tylko aplikacją do śledzenia transakcji. 
                  To manifest nowej ery developmentu, gdzie bariera wejścia do świata technologii praktycznie przestaje istnieć.
                </p>

                <p className="text-lg">
                  Twórca tej aplikacji zaczynał od prostego pytania: "Jak mogę śledzić moje transakcje?" 
                  Kilka tygodni później, dzięki AI, powstała pełnoprawna platforma z:
                </p>

                <ul className="list-disc list-inside space-y-2 ml-4 text-base">
                  <li>Zaawansowaną analityką i wykresami</li>
                  <li>Systemem autoryzacji Firebase</li>
                  <li>Responsywnym interfejsem użytkownika</li>
                  <li>Integracją z bazą danych w chmurze</li>
                  <li>Wielojęzyczną obsługą</li>
                  <li>Ciemnym i jasnym motywem</li>
                </ul>

                <p className="text-lg">
                  Wszystko to bez pisania kodu ręcznie. Każda funkcjonalność powstała poprzez rozmowę: 
                  "Chciałbym dodać tę funkcję", "Mam problem z tym elementem", "Czy możemy to ulepszyć?". 
                  AI rozumiało, tłumaczyło wizję na kod i pomagało debugować problemy.
                </p>

                <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
                  <p className="text-lg font-semibold text-blue-300 mb-3">
                    Co to oznacza dla Ciebie? 🚀
                  </p>
                  <p className="text-base">
                    Jeśli twórca Trade Log mógł stworzyć profesjonalną aplikację bez znajomości programowania, 
                    Ty też możesz! Nie musisz spędzać lat na nauce składni i frameworków. Wystarczy pomysł, 
                    ciekawość i gotowość do eksperymentowania.
                  </p>
                </div>

                <p className="text-lg">
                  Trade Log to więcej niż narzędzie - to inspiracja. Dowód, że w 2026 roku każdy może być 
                  twórcą oprogramowania. Nie musisz być programistą, by tworzyć rozwiązania technologiczne. 
                  Musisz tylko wiedzieć, czego chcesz, i potrafić o to poprosić.
                </p>

                <p className="text-lg font-bold text-emerald-300">
                  Witaj w przyszłości, gdzie AI jest Twoim współprogramistą, a wyobraźnia jedynym ograniczeniem! 🌟
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Features Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="mb-16"
          >
            <h2 className="text-3xl font-bold text-slate-100 text-center mb-8">
              Co oferuje Trade Log?
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {features.map((feature, index) => (
                <Card key={index} className="bg-slate-900/50 border-slate-800 hover:border-slate-700 transition-colors">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-emerald-500/20 to-blue-500/20 flex items-center justify-center mb-4">
                      <div className="text-emerald-400">
                        {feature.icon}
                      </div>
                    </div>
                    <h3 className="text-xl font-semibold text-slate-100 mb-2">{feature.title}</h3>
                    <p className="text-slate-400">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>

          {/* App Screenshots Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="mb-16"
          >
            <h2 className="text-3xl font-bold text-slate-100 text-center mb-8">
              Zajrzyj do środka
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Screenshot placeholders */}
              <Card className="bg-slate-900/50 border-slate-800 overflow-hidden">
                <CardContent className="p-0">
                  <div className="aspect-video bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                    <div className="text-center">
                      <TrendingUp className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
                      <p className="text-slate-400">Dashboard z analityką</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/50 border-slate-800 overflow-hidden">
                <CardContent className="p-0">
                  <div className="aspect-video bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                    <div className="text-center">
                      <Target className="w-16 h-16 text-blue-400 mx-auto mb-4" />
                      <p className="text-slate-400">Dziennik transakcji</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </motion.div>

          {/* CTA Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1 }}
            className="text-center"
          >
            <Card className="bg-gradient-to-br from-emerald-500/10 to-blue-500/10 border-emerald-500/30">
              <CardContent className="p-12">
                <Rocket className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
                <h2 className="text-3xl font-bold text-slate-100 mb-4">
                  Gotowy, by zacząć swoją podróż?
                </h2>
                <p className="text-slate-300 mb-6 max-w-2xl mx-auto">
                  Dołącz do społeczności traderów, którzy już korzystają z Trade Log. 
                  Zacznij śledzić swoje transakcje, analizować strategie i rozwijaj się jako trader!
                </p>
                <div className="flex gap-4 justify-center">
                  <a href="/register" className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-600 hover:to-blue-700 rounded-lg text-white font-semibold transition-all">
                    Zarejestruj się za darmo
                  </a>
                  <a href="/contact" className="px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-white font-semibold transition-all">
                    Skontaktuj się z nami
                  </a>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
      <Footer />
    </>
  );
}
