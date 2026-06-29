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
    <div className="min-h-screen flex flex-col">
      <PublicNavbar variant="hero" />
      <div className="public-trading-bg flex-1 flex flex-col pt-24 pb-12 transition-colors duration-300">
        <div className="container mx-auto px-4 max-w-6xl">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold fx-brand-text mb-4">
              O AiKeepTrade
            </h1>
            <p className="text-muted-foreground text-base sm:text-lg max-w-3xl mx-auto px-2">
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
            <Card className="fx-card-dark border-white/8 shadow-2xl  overflow-hidden">
              <CardContent className="p-12">
                <div className="flex items-center justify-center">
                  <div className="relative flex flex-col items-center gap-3">
                    <img
                      src="/aikeeptrade-icon-hires.png"
                      alt="AiKeepTrade"
                      height="160"
                      className="h-28 sm:h-36 w-auto object-contain drop-shadow-2xl"
                    />
                    <span className="text-3xl sm:text-4xl font-extrabold tracking-tight fx-brand-text">AiKeepTrade</span>
                    <div className="absolute -top-4 -right-4">
                      <Sparkles className="w-12 h-12 text-yellow-400 animate-[pulse_2.8s_ease-in-out_infinite]" />
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
            <Card className="bg-slate-950/75 border-white/8 backdrop-blur-sm">
              <CardContent className="p-8 space-y-6 text-slate-200 leading-relaxed">
                <div className="flex items-center gap-3 mb-4">
                  <Code className="w-8 h-8 text-sky-400" />
                  <h2 className="text-3xl font-bold text-foreground">Niezwykła Historia Powstania</h2>
                </div>
                
                <p className="text-lg">
                  AiKeepTrade to wyjątkowy projekt, który udowadnia, że w erze sztucznej inteligencji granice między możliwym 
                  a niemożliwym zacierają się w niesamowity sposób. Ta aplikacja powstała dzięki wizji, determinacji 
                  i... całkowitemu brakowi znajomości programowania!
                </p>

                <p className="text-lg">
                  Wyobraź sobie: osoba, która nigdy wcześniej nie napisała ani linii kodu, która nie znała różnicy między 
                  JavaScript a Java, stworzyła w pełni funkcjonalny, profesjonalny dziennik handlowy. Brzmi jak science 
                  fiction? A jednak to prawda!
                </p>

                <div className="bg-blue-500/10 border-l-4 border-lime-400/80 p-6 rounded-r-lg">
                  <p className="text-lg font-semibold text-sky-600 dark:text-sky-300 mb-2">
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
                  daje możliwości każdemu, kto ma wizję. AiKeepTrade nie jest tylko aplikacją do śledzenia transakcji. 
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

                <div className="bg-slate-900/60 p-6 rounded-lg border border-slate-700">
                  <p className="text-lg font-semibold text-blue-400 mb-3">
                    Co to oznacza dla Ciebie? 🚀
                  </p>
                  <p className="text-base">
                    Jeśli twórca AiKeepTrade mógł stworzyć profesjonalną aplikację bez znajomości programowania, 
                    Ty też możesz! Nie musisz spędzać lat na nauce składni i frameworków. Wystarczy pomysł, 
                    ciekawość i gotowość do eksperymentowania.
                  </p>
                </div>

                <p className="text-lg">
                  AiKeepTrade to więcej niż narzędzie - to inspiracja. Dowód, że w 2026 roku każdy może być 
                  twórcą oprogramowania. Nie musisz być programistą, by tworzyć rozwiązania technologiczne. 
                  Musisz tylko wiedzieć, czego chcesz, i potrafić o to poprosić.
                </p>

                <p className="text-lg font-bold text-sky-600 dark:text-sky-300">
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
              Co oferuje AiKeepTrade?
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {features.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.72 + index * 0.06 }}
                  whileHover={{ y: -3 }}
                >
                <Card className="fx-card-dark border-white/8 hover:border-blue-500/40 transition-all duration-200">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
                      <div className="text-sky-400">
                        {feature.icon}
                      </div>
                    </div>
                    <h3 className="text-xl font-semibold text-slate-100 mb-2">{feature.title}</h3>
                    <p className="text-slate-300">{feature.description}</p>
                  </CardContent>
                </Card>
                </motion.div>
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
              <Card className="fx-card-dark border-white/8 overflow-hidden">
                <CardContent className="p-0">
                  <div className="aspect-video bg-gradient-to-br from-slate-900/80 to-slate-950/80 flex items-center justify-center">
                    <div className="text-center">
                      <TrendingUp className="w-16 h-16 text-sky-400 mx-auto mb-4" />
                      <p className="text-slate-300">Dashboard z analityką</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="fx-card-dark border-white/8 overflow-hidden">
                <CardContent className="p-0">
                  <div className="aspect-video bg-gradient-to-br from-slate-900/80 to-slate-950/80 flex items-center justify-center">
                    <div className="text-center">
                      <Target className="w-16 h-16 text-blue-400 mx-auto mb-4" />
                      <p className="text-slate-300">Dziennik transakcji</p>
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
            <Card className="fx-card-dark border-blue-500/40">
              <CardContent className="p-12">
                <Rocket className="w-16 h-16 text-sky-400 mx-auto mb-4" />
                <h2 className="text-3xl font-bold text-slate-100 mb-4">
                  Gotowy, by zacząć swoją podróż?
                </h2>
                <p className="text-slate-300 mb-6 max-w-2xl mx-auto">
                  Dołącz do społeczności traderów, którzy już korzystają z AiKeepTrade. 
                  Zacznij śledzić swoje transakcje, analizować strategie i rozwijaj się jako trader!
                </p>
                <div className="flex gap-4 justify-center">
                  <a href="/register" className="px-6 py-3 fx-cta rounded-lg text-white font-semibold transition-all duration-200 hover:-translate-y-0.5">
                    Zarejestruj się za darmo
                  </a>
                  <a
                    href="/contact"
                    className="px-6 py-3 rounded-lg border border-blue-500/50 text-sky-200 font-semibold transition-all duration-200 hover:bg-blue-500/10 hover:-translate-y-0.5"
                  >
                    Skontaktuj się z nami
                  </a>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
      <Footer variant="hero" />
    </div>
  );
}
