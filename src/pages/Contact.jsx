import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Phone, MapPin, Send, Clock } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import PublicNavbar from '@/components/PublicNavbar';
import Footer from '@/components/Footer';
import AnimatedPublicBackground from '@/components/AnimatedPublicBackground';
import TradingWallpaper from '@/components/TradingWallpaper';
import AnimatedFeatureIcon from '@/components/AnimatedFeatureIcon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import LiveCard from '@/components/LiveCard';

export default function Contact() {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    // TODO: Implement actual form submission (np. do API / email)
    alert('Dziękujemy za wiadomość! Skontaktujemy się wkrótce.');
  };

  return (
    <>
      <PublicNavbar variant="hero" />
      <div className="public-trading-bg use-trading-wallpaper min-h-screen pt-24 pb-12 relative">
        <TradingWallpaper variant="lineChart" />
        <AnimatedPublicBackground />
        <div className="container mx-auto px-4 max-w-6xl relative z-10">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h1 className="text-5xl font-bold bg-gradient-to-r from-emerald-400 to-blue-500 bg-clip-text text-transparent mb-4">
              Skontaktuj się z nami
            </h1>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Masz pytania? Chętnie pomożemy! Napisz do nas lub skorzystaj z poniższych danych kontaktowych.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Contact Info */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="space-y-6"
            >
              <LiveCard variant="more">
              <Card className="feature-card-live feature-card-live-more bg-slate-900/50 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-2xl text-slate-100">Informacje kontaktowe</CardTitle>
                  <CardDescription className="text-slate-400">
                    Skontaktuj się z nami w dogodny dla Ciebie sposób
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Email */}
                  <div className="flex items-start gap-4">
                    <AnimatedFeatureIcon icon={Mail} variant="more" className="flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-slate-100 mb-1">Email</h3>
                      <p className="text-slate-400">kontakt@aikeeptrade.pl</p>
                      <p className="text-slate-400">support@aikeeptrade.pl</p>
                    </div>
                  </div>

                  {/* Phone */}
                  <div className="flex items-start gap-4">
                    <AnimatedFeatureIcon icon={Phone} variant="main" className="flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-slate-100 mb-1">Telefon</h3>
                      <p className="text-slate-400">+48 123 456 789</p>
                      <p className="text-slate-400 text-sm">(Pon-Pt, 9:00-17:00)</p>
                    </div>
                  </div>

                  {/* Address */}
                  <div className="flex items-start gap-4">
                    <AnimatedFeatureIcon icon={MapPin} variant="more" className="flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-slate-100 mb-1">Adres</h3>
                      <p className="text-slate-400">ul. Handlowa 123</p>
                      <p className="text-slate-400">00-001 Warszawa, Polska</p>
                    </div>
                  </div>

                  {/* Hours */}
                  <div className="flex items-start gap-4">
                    <AnimatedFeatureIcon icon={Clock} variant="more" className="flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-slate-100 mb-1">Godziny wsparcia</h3>
                      <p className="text-slate-400">Poniedziałek - Piątek: 9:00 - 17:00</p>
                      <p className="text-slate-400">Sobota - Niedziela: Zamknięte</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              </LiveCard>

              {/* Social Media */}
              <LiveCard variant="more">
              <Card className="feature-card-live feature-card-live-more bg-slate-900/50 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-xl text-slate-100">Media społecznościowe</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4">
                    <a href="#" className="w-12 h-12 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors">
                      <span className="text-xl">📘</span>
                    </a>
                    <a href="#" className="w-12 h-12 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors">
                      <span className="text-xl">📷</span>
                    </a>
                    <a href="#" className="w-12 h-12 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors">
                      <span className="text-xl">🎵</span>
                    </a>
                  </div>
                </CardContent>
              </Card>
              </LiveCard>
            </motion.div>

            {/* Contact Form */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <LiveCard variant="more">
              <Card className="feature-card-live feature-card-live-more bg-slate-900/50 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-2xl text-slate-100">Wyślij wiadomość</CardTitle>
                  <CardDescription className="text-slate-400">
                    Wypełnij formularz, a my odpowiemy tak szybko, jak to możliwe
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-slate-200">Imię i nazwisko</Label>
                      <Input
                        id="name"
                        placeholder="Jan Kowalski"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="bg-slate-800/50 border-slate-700 text-slate-100"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-slate-200">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="jan@example.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="bg-slate-800/50 border-slate-700 text-slate-100"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="subject" className="text-slate-200">Temat</Label>
                      <Input
                        id="subject"
                        placeholder="W czym możemy pomóc?"
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        className="bg-slate-800/50 border-slate-700 text-slate-100"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="message" className="text-slate-200">Wiadomość</Label>
                      <Textarea
                        id="message"
                        placeholder="Opisz swoją sprawę..."
                        rows={6}
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        className="bg-slate-800/50 border-slate-700 text-slate-100 resize-none"
                        required
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-600 hover:to-blue-700 gap-2"
                    >
                      <Send className="w-4 h-4" />
                      Wyślij wiadomość
                    </Button>
                  </form>
                </CardContent>
              </Card>
              </LiveCard>
            </motion.div>
          </div>
        </div>
      </div>
      <Footer variant="hero" />
    </>
  );
}
