import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Phone, MapPin, Send, Clock } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import PublicNavbar from '@/components/PublicNavbar';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';

const CONTACT_EMAIL = 'kontakt@aikeeptrade.pl';

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
    const subject = encodeURIComponent(formData.subject || 'Wiadomość z AIKeepTrade');
    const body = encodeURIComponent(
      `Imię: ${formData.name}\nEmail: ${formData.email}\n\n${formData.message}`
    );
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
    toast.success('Otwieram program pocztowy…');
  };

  return (
    <div className="min-h-screen flex flex-col">
      <PublicNavbar variant="hero" />
      <div className="public-trading-bg flex-1 flex flex-col pt-24 pb-12">
        <div className="container mx-auto px-4 max-w-6xl">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold fx-brand-text mb-4">
              Skontaktuj się z nami
            </h1>
            <p className="text-white/55 text-base sm:text-lg max-w-2xl mx-auto px-2">
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
              <Card className="bg-black/40 border-white/10">
                <CardHeader>
                  <CardTitle className="text-2xl text-white">Informacje kontaktowe</CardTitle>
                  <CardDescription className="text-white/55">
                    Skontaktuj się z nami w dogodny dla Ciebie sposób
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Email */}
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-md bg-muted/50 flex items-center justify-center flex-shrink-0">
                      <Mail className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white mb-1">Email</h3>
                      <p className="text-white/55">
                        <a href="mailto:kontakt@aikeeptrade.pl" className="hover:text-white">kontakt@aikeeptrade.pl</a>
                      </p>
                      <p className="text-white/55">
                        <a href="mailto:support@aikeeptrade.pl" className="hover:text-white">support@aikeeptrade.pl</a>
                      </p>
                    </div>
                  </div>

                  {/* Phone */}
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-md bg-muted/50 flex items-center justify-center flex-shrink-0">
                      <Phone className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white mb-1">Telefon</h3>
                      <p className="text-white/55">
                        <a href="tel:+48123456789" className="hover:text-white">+48 123 456 789</a>
                      </p>
                      <p className="text-white/55 text-sm">(Pon-Pt, 9:00-17:00)</p>
                    </div>
                  </div>

                  {/* Address */}
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-md bg-muted/50 flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white mb-1">Adres</h3>
                      <a
                        href="https://maps.google.com/?q=ul.+Handlowa+123,+00-001+Warszawa"
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-white"
                      >
                        <p className="text-white/55">ul. Handlowa 123</p>
                        <p className="text-white/55">00-001 Warszawa, Polska</p>
                      </a>
                    </div>
                  </div>

                  {/* Hours */}
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-md bg-muted/50 flex items-center justify-center flex-shrink-0">
                      <Clock className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white mb-1">Godziny wsparcia</h3>
                      <p className="text-white/55">Poniedziałek - Piątek: 9:00 - 17:00</p>
                      <p className="text-white/55">Sobota - Niedziela: Zamknięte</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Social Media */}
              <Card className="bg-black/40 border-white/10">
                <CardHeader>
                  <CardTitle className="text-xl text-white">Media społecznościowe</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4">
                    <a href="#" className="w-12 h-12 rounded-lg bg-black/40 border border-white/10 hover:bg-white/10 flex items-center justify-center transition-colors">
                      <span className="text-xl">📘</span>
                    </a>
                    <a href="#" className="w-12 h-12 rounded-lg bg-black/40 border border-white/10 hover:bg-white/10 flex items-center justify-center transition-colors">
                      <span className="text-xl">📷</span>
                    </a>
                    <a href="#" className="w-12 h-12 rounded-lg bg-black/40 border border-white/10 hover:bg-white/10 flex items-center justify-center transition-colors">
                      <span className="text-xl">🎵</span>
                    </a>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Contact Form */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <Card className="bg-black/40 border-white/10">
                <CardHeader>
                  <CardTitle className="text-2xl text-white">Wyślij wiadomość</CardTitle>
                  <CardDescription className="text-white/55">
                    Wypełnij formularz, a my odpowiemy tak szybko, jak to możliwe
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-white/90">Imię i nazwisko</Label>
                      <Input
                        id="name"
                        placeholder="Jan Kowalski"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="bg-black/40 border-white/10 text-white"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-white/90">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="jan@example.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="bg-black/40 border-white/10 text-white"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="subject" className="text-white/90">Temat</Label>
                      <Input
                        id="subject"
                        placeholder="W czym możemy pomóc?"
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        className="bg-black/40 border-white/10 text-white"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="message" className="text-white/90">Wiadomość</Label>
                      <Textarea
                        id="message"
                        placeholder="Opisz swoją sprawę..."
                        rows={6}
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        className="bg-black/40 border-white/10 text-white resize-none"
                        required
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full fx-cta gap-2"
                    >
                      <Send className="w-4 h-4" />
                      Wyślij wiadomość
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
      <Footer variant="hero" />
    </div>
  );
}
