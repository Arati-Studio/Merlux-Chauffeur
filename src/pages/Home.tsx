import { useState, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronRight, ChevronLeft, Star, Shield, Clock, MapPin,
  Car, Plane, Briefcase, Heart, Wine, Camera, Send,
  ArrowRight, Calendar, User, Phone, Mail, MessageSquare,
  Map as MapIcon, UserCheck, Users, CircleArrowOutUpRight
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { cn, formatDate, getAssetPath } from '../lib/utils';
import { useSettings } from '../lib/SettingsContext';
import { collection, getDocs, query, limit, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import * as Icons from 'lucide-react';
import SEO from '../components/SEO';

const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
  e.currentTarget.src = "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?q=80&w=2070&auto=format&fit=crop";
};

const HERO_IMAGES = [
  "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?q=80&w=2070&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=2070&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?q=80&w=2070&auto=format&fit=crop"
];

const SERVICE_OPTIONS = [
  { name: 'Airport Transfer', id: 'airport', icon: 'Plane' },
  { name: 'Corporate Travel', id: 'corporate', icon: 'Briefcase' },
  { name: 'Private Tour', id: 'tour', icon: 'Map' },
  { name: 'Special Event', id: 'wedding', icon: 'Heart' }
];

export default function Home() {
  const { settings } = useSettings();
  const contact = settings?.contact || {
    address: 'Collins Street, Melbourne VIC 3000, Australia',
    phone: '+61 3 9000 0000',
    email: 'bookings@merlux.com.au',
    bookingEmail: 'bookings@merlux.com.au'
  };

  const navigate = useNavigate();
  const [currentHero, setCurrentHero] = useState(0);
  const [currentFleet, setCurrentFleet] = useState(0);
  const [selectedService, setSelectedService] = useState('airport');
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [blogsList, setBlogsList] = useState<any[]>([]);
  const [fleetList, setFleetList] = useState<any[]>([]);
  const [toursList, setToursList] = useState<any[]>([]);

  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      try {
        const blogsSnap = await getDocs(query(collection(db, 'blogs'), orderBy('createdAt', 'desc'), limit(15)));
        if (active) {
          const filteredBlogs = blogsSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter((b: any) => b.active !== false && (!b.publishAt || new Date(b.publishAt) <= new Date()))
            .slice(0, 3);
          setBlogsList(filteredBlogs);
        }

        const fleetSnap = await getDocs(collection(db, 'fleet'));
        if (active) setFleetList(fleetSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        const toursSnap = await getDocs(query(collection(db, 'tours'), orderBy('createdAt', 'desc'), limit(3)));
        if (active) setToursList(toursSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error('Error fetching home data:', err);
      }
    };
    fetchData();
    return () => { active = false; };
  }, []);

  const getStartingPrice = (tour: any) => {
    if (tour.fleets && Array.isArray(tour.fleets) && tour.fleets.length > 0) {
      const prices = tour.fleets.map((f: any) => Number(f?.salePrice || f?.standardPrice || f?.price || 0)).filter((p: number) => p > 0);
      if (prices.length > 0) return Math.min(...prices);
    }
    return tour.price || 0;
  };

  const serviceOptions = settings?.services || SERVICE_OPTIONS;

  // Hero Slider logic
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentHero((prev) => (prev + 1) % HERO_IMAGES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleContactSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // 1. Save to Firestore (messages collection - visible in Admin Dashboard under "Inquiries")
      await addDoc(collection(db, 'messages'), {
        name: contactForm.name,
        email: contactForm.email,
        subject: 'General Inquiry via Homepage Form',
        message: contactForm.message,
        status: 'new',
        createdAt: serverTimestamp(),
        type: 'inquiry'
      });

      // 2. Dispatch inquiry emails to the Contact Email and the Customer
      try {
        const { emailService } = await import('../services/emailService');
        const targetEmail = contact.email || contact.bookingEmail || 'bookings@merlux.com.au';
        
        // Admin notification email html
        const adminEmailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e4e4e7; border-radius: 12px; background-color: #ffffff; color: #09090b;">
            <div style="text-align: center; border-bottom: 2px solid #dab866; padding-bottom: 20px; margin-bottom: 25px;">
              <h2 style="color: #dab866; margin: 0; font-size: 24px; letter-spacing: 4px; font-weight: 800;">MERLUX</h2>
              <p style="color: #71717a; margin: 5px 0 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 2px;">Luxury Website Inquiry</p>
            </div>
            
            <h3 style="color: #09090b; font-size: 18px; margin-top: 0; font-weight: 600;">General Homepage Inquiry</h3>
            
            <div style="background-color: #f4f4f5; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr>
                  <td style="padding: 6px 0; color: #71717a; width: 30%; font-weight: 600;">Client Name:</td>
                  <td style="padding: 6px 0; color: #09090b; font-weight: bold;">${contactForm.name}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #71717a; font-weight: 600;">Client Email:</td>
                  <td style="padding: 6px 0; color: #dab866; font-weight: bold;"><a href="mailto:${contactForm.email}" style="color: #dab866; text-decoration: none;">${contactForm.email}</a></td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #71717a; font-weight: 600;">Received:</td>
                  <td style="padding: 6px 0; color: #09090b;">${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Melbourne' })} AEST</td>
                </tr>
              </table>
            </div>
            
            <div style="border-left: 4px solid #dab866; padding-left: 15px; margin: 20px 0;">
              <h4 style="margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #71717a;">Message Content</h4>
              <p style="margin: 0; line-height: 1.6; font-size: 14px; white-space: pre-wrap; color: #27272a;">${contactForm.message}</p>
            </div>
            
            <p style="font-size: 12px; color: #71717a; margin-top: 25px;">This inquiry is also recorded in the Admin Dashboard 'Inquiries' database table.</p>
          </div>
        `;

        // Customer receipt email html
        const customerReceiptHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e4e4e7; border-radius: 12px; background-color: #ffffff; color: #09090b;">
            <div style="text-align: center; border-bottom: 2px solid #dab866; padding-bottom: 20px; margin-bottom: 25px;">
              <h2 style="color: #dab866; margin: 0; font-size: 24px; letter-spacing: 4px; font-weight: 800;">MERLUX</h2>
              <p style="color: #71717a; margin: 5px 0 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 2px;">Luxury Chauffeur Services</p>
            </div>
            
            <h3 style="color: #09090b; font-size: 18px; margin-top: 0; font-weight: normal; line-height: 1.4;">Hello <strong>${contactForm.name}</strong>,</h3>
            
            <p style="font-size: 14px; line-height: 1.6; color: #27272a;">Thank you for getting in touch with Merlux. We have successfully received your message.</p>
            <p style="font-size: 14px; line-height: 1.6; color: #27272a;">Our dedicated 24/7 concierge desk is presently reviewing your message. A luxury travel specialist will compile the requested arrangements and contact you shortly.</p>
            
            <div style="border-left: 4px solid #dab866; padding-left: 15px; margin: 25px 0; background-color: #fafafa; padding: 15px; border-radius: 4px;">
              <h4 style="margin: 0 0 8px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #dab866; font-weight: bold;">Summary of Inquiry</h4>
              <p style="margin: 0; line-height: 1.6; font-size: 13px; white-space: pre-wrap; color: #4b5563;">${contactForm.message}</p>
            </div>
            
            <p style="font-size: 14px; line-height: 1.6; color: #27272a;">Should you require instantaneous assistance, please do not hesitate to contact our reservation hotline directly.</p>
            
            <div style="margin-top: 35px; border-top: 1px solid #e4e4e7; padding-top: 20px; text-align: center; font-size: 12px; color: #71717a;">
              <p style="margin: 0 0 5px 0; font-weight: bold; color: #09090b;">Merlux Chauffeurs Team</p>
              <p style="margin: 0;">Hotline: <a href="tel:${contact.phone}" style="color: #dab866; text-decoration: none;">${contact.phone}</a> &bull; Email: <a href="mailto:${targetEmail}" style="color: #dab866; text-decoration: none;">${targetEmail}</a></p>
            </div>
          </div>
        `;

        await emailService.sendEmail(targetEmail, `[Inquiry Received]: General Inquiry from ${contactForm.name}`, adminEmailHtml);
        await emailService.sendEmail(contactForm.email, `Inquiry Received: Merlux Support`, customerReceiptHtml);
      } catch (mailErr) {
        console.error('Email sending failed but database write succeeded:', mailErr);
      }

      setSubmitted(true);
      setContactForm({ name: '', email: '', message: '' });
      setTimeout(() => setSubmitted(false), 5000);
    } catch (err) {
      console.error('Firestore save failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative bg-black text-white overflow-x-hidden">
      <SEO />
      {/* 1. Hero Section with Image Slider */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentHero}
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "-80%" }}
            transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 z-0"
          >
            <img
              src={HERO_IMAGES[currentHero]}
              alt="Luxury Chauffeur"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </motion.div>
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/40 to-black z-[1]" />

        <div className="relative z-10 max-w-7xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <span className="text-gold uppercase tracking-[0.5em] text-xs font-bold mb-6 block">Premium Chauffeur Service</span>
            <h1 className="text-3xl sm:text-5xl lg:text-8xl font-display mb-4 leading-snug sm:leading-tight">
              Elegance in <span className="text-gold italic">Every Mile</span>
            </h1>
            <p className="text-sm sm:text-base lg:text-lg text-white/70 max-w-2xl mx-auto mb-12 font-light tracking-wide leading-relaxed">
              Experience Melbourne's most refined transport service. From airport transfers to bespoke private tours, we redefine luxury travel.
            </p>
            <div className="flex flex-col md:flex-row items-center justify-center gap-6">
              <Link to="/booking" className="bg-gold text-black px-10 py-5 rounded-full font-bold uppercase tracking-widest text-xs hover:bg-white transition-all duration-500 flex items-center gap-3 group">
                Book Your Journey <ArrowRight size={16} className="group-hover:translate-x-2 transition-transform" />
              </Link>
              <Link to="/fleet" className="bg-white/5 border border-white/10 backdrop-blur-md text-white px-10 py-5 rounded-full font-bold uppercase tracking-widest text-xs hover:bg-white/10 transition-all duration-500">
                Explore Our Fleet
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Hero Controls */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-10 flex gap-4">
          {HERO_IMAGES.map((_, i) => (
            <button
              key={`hero-dot-${i}`}
              onClick={() => setCurrentHero(i)}
              className={cn(
                "w-12 h-1 bg-white/20 transition-all duration-500",
                currentHero === i && "bg-gold w-20"
              )}
            />
          ))}
        </div>
      </section>

      {/* 2. Quick Offers & Tours Grid */}
      <section className="py-12 bg-black relative z-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Offers Card */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="group relative h-[500px] rounded-[3rem] overflow-hidden border border-white/10"
            >
              <img
                src="https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?q=80&w=2070&auto=format&fit=crop"
                alt="Offers"
                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110 opacity-60"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
              <div className="absolute bottom-12 left-8 right-8">
                <span className="text-gold uppercase tracking-[0.3em] text-xs font-bold mb-4 block">Limited Time</span>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display mb-6">Exclusive <span className="text-gold italic">Offers</span></h2>
                <p className="text-white/60 text-sm sm:text-base mb-8 max-w-md">
                  Premium airport transfers at competitive fixed rates. Experience luxury for less with our curated seasonal packages.
                </p>
                <Link to="/offers" className="bg-gold text-black px-8 py-4 rounded-full font-bold uppercase tracking-widest text-[10px] hover:bg-white transition-all duration-500">View All Offers</Link>
              </div>
            </motion.div>

            {/* Tours Card */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="group relative h-[500px] rounded-[3rem] overflow-hidden border border-white/10"
            >
              <img
                src="https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?q=80&w=2070&auto=format&fit=crop"
                alt="Tours"
                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110 opacity-60"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
              <div className="absolute bottom-12 left-8 right-8">
                <span className="text-gold uppercase tracking-[0.3em] text-xs font-bold mb-4 block">Bespoke Experiences</span>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display mb-6">Private <span className="text-gold italic">Tours</span></h2>
                <p className="text-white/60 text-sm sm:text-base mb-8 max-w-md">
                  Discover Victoria's most iconic destinations in absolute comfort. Tailored itineraries for the discerning traveler.
                </p>
                <Link to="/tours" className="bg-gold text-black px-8 py-4 rounded-full font-bold uppercase tracking-widest text-[10px] hover:bg-white transition-all duration-500">Explore Tours</Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 2. Booking First Step & Guide */}
      <section className="py-12 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div>
            {/* Heading + paragraph — full width, above the grid */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <span className="text-gold uppercase tracking-[0.3em] text-xs font-bold mb-4 block">Step 01</span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-display mb-4">
                Start Your <span className="text-gold italic">Reservation</span>
              </h2>
              <p className="text-white/60 mb-10 leading-relaxed text-base sm:text-lg">
                Begin your luxury experience by selecting your service type. Whether it's a quick airport transfer or a full-day private tour, we've got you covered.
              </p>
            </motion.div>

            {/* Grid — booking form + steps side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 xl:gap-20 items-start">

              {/* Left — Booking Form */}
              <div className="min-w-0 w-full bg-white/5 border border-white/10 p-6 md:p-8 rounded-[2rem] backdrop-blur-xl relative group/booking hover:border-gold/30 transition-all duration-700">
                <div className="absolute -inset-1 bg-gradient-to-r from-gold/20 to-transparent blur-2xl opacity-0 group-hover/booking:opacity-100 transition-opacity duration-1000" />
                <div className="relative z-10">
                  <div className="mb-10">
                    <label className="text-[10px] uppercase tracking-[0.3em] font-bold text-gold mb-6 block">Select Your Service</label>
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                      {serviceOptions.map((option: any) => {
                        const IconComponent = (Icons as any)[option.icon] || Plane;
                        return (
                          <button
                            key={option.id}
                            onClick={() => setSelectedService(option.id)}
                            className={cn(
                              "flex flex-col items-center justify-center p-4 rounded-xl border transition-all duration-500 gap-4 group/opt relative overflow-hidden",
                              selectedService === option.id
                                ? "bg-gold border-gold text-black shadow-lg shadow-gold/20"
                                : "bg-white/5 border-white/10 text-white hover:border-gold/50"
                            )}
                          >
                            {selectedService === option.id && (
                              <motion.div
                                layoutId="activeGlow"
                                className="absolute inset-0 bg-white/20 blur-xl"
                              />
                            )}
                            <div className="relative z-10 flex flex-col items-center gap-3">
                              <IconComponent
                                size={24}
                                className={cn(
                                  "transition-all duration-500 group-hover/opt:scale-110",
                                  selectedService === option.id ? "text-black" : "text-gold"
                                )}
                              />
                              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-center leading-tight">
                                {option.name}
                              </span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/booking', { state: { service: selectedService, step: 2 } })}
                    className="w-full bg-gold text-black py-5 rounded-2xl font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-white transition-all duration-500 shadow-2xl shadow-gold/20 flex items-center justify-center gap-3 group"
                  >
                    Continue to Details <ArrowRight size={14} className="group-hover:translate-x-2 transition-transform" />
                  </button>
                </div>
              </div>

              {/* Right — Steps 1–4 */}
              <div className="min-w-0 w-full space-y-12">
                {[
                  { step: '01', title: 'Choose Service', desc: 'Select from airport transfers, corporate, or private tours.' },
                  { step: '02', title: 'Select Vehicle', desc: 'Pick the perfect luxury car from our premium fleet.' },
                  { step: '03', title: 'Confirm & Pay', desc: 'Secure your booking with our easy online payment.' },
                  { step: '04', title: 'Enjoy the Ride', desc: 'Your professional chauffeur arrives on time, every time.' }
                ].map((item, i) => (
                  <motion.div
                    key={`guide-step-${i}`}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="flex gap-8 group"
                  >
                    <div className="text-gold font-display text-4xl opacity-20 group-hover:opacity-100 transition-opacity duration-500">{item.step}</div>
                    <div>
                      <h3 className="text-xl font-display mb-2">{item.title}</h3>
                      <p className="text-white/50 text-sm leading-relaxed">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Our Services */}
      <section className="py-24 bg-[#050505]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <span className="text-gold uppercase tracking-[0.3em] text-xs font-bold mb-4 block">Excellence in Motion</span>
            <h2 className="text-3xl sm:text-5xl lg:text-6xl font-display">Our Bespoke <span className="text-gold italic">Services</span></h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {serviceOptions.map((service: any, i: number) => {
              const ServiceIcon = (Icons as any)[service.icon] || Car;
              return (
                <motion.div
                  key={`service-card-${i}`}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="p-10 bg-white/5 border border-white/10 rounded-[2rem] hover:bg-gold group transition-all duration-500 cursor-pointer"
                >
                  <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-8 group-hover:bg-black transition-colors">
                    <ServiceIcon className="text-gold" size={32} />
                  </div>
                  <h3 className="text-2xl font-display mb-4 group-hover:text-black transition-colors">{service.name}</h3>
                  <p className="text-white/50 text-sm leading-relaxed mb-8 group-hover:text-black/70 transition-colors">{service.desc}</p>
                  <Link to="/booking" className="flex items-center gap-2 text-gold group-hover:text-black font-bold uppercase tracking-widest text-[10px] transition-colors">
                    Book Service <ChevronRight size={14} />
                  </Link>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* 4. Short Contact Form */}
      <section className="py-12 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="relative overflow-hidden bg-gradient-to-br from-[#1a1506] via-[#2a1f04] to-[#1a1506] border border-gold/25 rounded-[3rem] p-6 md:p-10 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

            {/* Glow effects */}
            <div className="absolute -top-20 -right-20 w-72 h-72 bg-gold/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-10 w-52 h-52 bg-gold/5 rounded-full blur-3xl pointer-events-none" />

            {/* Left */}
            <div className="relative z-10">
              <h2 className="text-3xl sm:text-5xl lg:text-6xl font-display mb-6 text-white">
                Get in <span className="italic text-gold">Touch</span>
              </h2>
              <p className="text-white/55 mb-10 text-base sm:text-lg leading-relaxed font-light">
                Have a special request or need a custom quote? Our concierge team is available 24/7 to assist you.
              </p>
              <div className="space-y-5">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 bg-gold/10 border border-gold/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <Phone size={18} className="text-gold" />
                  </div>
                  <p className="font-semibold text-white">{contact.phone}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 bg-gold/10 border border-gold/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <Mail size={18} className="text-gold" />
                  </div>
                  <p className="font-semibold text-white">{contact.bookingEmail || contact.email}</p>
                </div>
              </div>
            </div>

            {/* Right — Form */}
            <form onSubmit={handleContactSubmit} className="relative z-10 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                  <input
                    type="text"
                    placeholder="Your Name"
                    required
                    value={contactForm.name}
                    onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-11 pr-4 py-4 text-sm text-white focus:border-gold/50 outline-none transition-all placeholder:text-white/30"
                  />
                </div>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                  <input
                    type="email"
                    placeholder="Your Email"
                    required
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-11 pr-4 py-4 text-sm text-white focus:border-gold/50 outline-none transition-all placeholder:text-white/30"
                  />
                </div>
              </div>
              <div className="relative">
                <MessageSquare className="absolute left-4 top-5 text-white/30" size={16} />
                <textarea
                  placeholder="Your Message"
                  rows={4}
                  required
                  value={contactForm.message}
                  onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-11 pr-4 py-4 text-sm text-white focus:border-gold/50 outline-none transition-all placeholder:text-white/30 resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gold text-black py-5 rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-white hover:text-black transition-all flex items-center justify-center gap-3"
              >
                {isSubmitting ? <Clock className="animate-spin" size={18} /> : (submitted ? "Message Sent!" : "Send Message")}
                {!isSubmitting && !submitted && <Send size={16} />}
              </button>
            </form>

          </div>
        </div>
      </section>

      {/* 5. Our Fleet Carousel */}
      {fleetList.length > 0 && (
        <section className="py-12 bg-black overflow-hidden">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-col md:flex-row justify-between items-start mb-16 gap-6">
              <div>
                <span className="text-gold uppercase tracking-[0.3em] text-xs font-bold mb-4 block">The Collection</span>
                <h2 className="text-3xl sm:text-5xl lg:text-6xl font-display">Our Luxury <span className="text-gold italic">Fleet</span></h2>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => setCurrentFleet((prev) => (prev - 1 + fleetList.length) % fleetList.length)}
                  className="w-9 h-9 lg:w-10 lg:h-10 rounded-full border border-white/20 flex items-center justify-center hover:bg-gold hover:text-black transition-all"
                >
                  <ChevronLeft size={24} />
                </button>
                <button
                  onClick={() => setCurrentFleet((prev) => (prev + 1) % fleetList.length)}
                  className="w-9 h-9 lg:w-10 lg:h-10 rounded-full border border-white/20 flex items-center justify-center hover:bg-gold hover:text-black transition-all"
                >
                  <ChevronRight size={24} />
                </button>
              </div>
            </div>

            <div className="relative">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentFleet}
                  initial={{ opacity: 0, x: 100 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ duration: 0.5 }}
                  className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-stretch"
                >
                  <div className="rounded-[3rem] overflow-hidden h-full relative group border border-white/10 hover:border-gold/30 transition-colors">
                    <img
                      src={getAssetPath(fleetList[currentFleet]?.images?.[0] || fleetList[currentFleet]?.img)}
                      alt={fleetList[currentFleet]?.name}
                      onError={handleImageError}
                      className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/20" />
                    
                    {/* Top Left Overlay: Vehicle Type */}
                    <div className="absolute top-6 left-6 z-10">
                      <div className="bg-black/60 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/10 flex items-center gap-2.5">
                        <Star size={12} className="text-gold fill-gold/20" />
                        <span className="text-gold text-[10px] md:text-xs uppercase tracking-[0.25em] font-black">
                          {fleetList[currentFleet]?.type || fleetList[currentFleet]?.category || 'Luxury'}
                        </span>
                      </div>
                    </div>
                    {/* Top Right Overlay: Link to Fleet */}
                    <Link to="/fleet" className="absolute top-6 right-6 z-10 bg-black/60 backdrop-blur-md p-2 rounded-full border border-white/10 hover:bg-gold hover:text-black transition-all">
                      <CircleArrowOutUpRight size={16} />
                    </Link>
                  </div>
                  <div className="p-4">
                    <h3 className="text-3xl sm:text-4xl lg:text-5xl font-display mb-3">{fleetList[currentFleet]?.name}</h3>
                    
                    {fleetList[currentFleet]?.excerpt && (
                      <p className="text-white/60 mb-4 text-sm leading-relaxed max-w-md italic">
                        "{fleetList[currentFleet].excerpt}"
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-8 mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center">
                          <User className="text-gold" size={20} />
                        </div>
                        <div>
                          <p className="text-[10px] uppercase text-white/40 font-bold">Passengers</p>
                          <p className="text-lg font-bold">{fleetList[currentFleet]?.passengers || fleetList[currentFleet]?.capacity || fleetList[currentFleet]?.pax}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center">
                          <Briefcase className="text-gold" size={20} />
                        </div>
                        <div>
                          <p className="text-[10px] uppercase text-white/40 font-bold">Luggage</p>
                          <p className="text-lg font-bold">{fleetList[currentFleet]?.luggage || fleetList[currentFleet]?.bags}</p>
                        </div>
                      </div>
                    </div>

                    {fleetList[currentFleet]?.features && fleetList[currentFleet].features.length > 0 && (
                      <div className="mb-4">
                        <p className="text-[10px] uppercase text-white/40 font-bold mb-3 tracking-widest">Key Features</p>
                        <div className="flex flex-wrap gap-2">
                          {fleetList[currentFleet].features.slice(0, 4).map((f: string, idx: number) => (
                            <span key={idx} className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] text-gold/80 flex items-center gap-2">
                              <Star size={10} className="fill-gold/20" /> {f}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {fleetList[currentFleet]?.bestFor && fleetList[currentFleet].bestFor.length > 0 && (
                      <div className="mb-2">
                        <p className="text-[10px] uppercase text-white/40 font-bold mb-3 tracking-widest">Ideal For</p>
                        <div className="flex flex-wrap gap-2">
                          {fleetList[currentFleet].bestFor.map((item: string, idx: number) => (
                            <span key={idx} className="px-3 py-1 bg-gold/5 border border-gold/10 rounded-full text-[10px] text-gold font-medium">
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </section>
      )}

      {/* 6. Latest Blogs */}
      {blogsList.length > 0 && (
        <section className="py-24 bg-[#050505]">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-col md:flex-row justify-between items-start mb-12 gap-6">
              <div>
                <span className="text-gold uppercase tracking-[0.3em] text-xs font-bold mb-4 block">Insights</span>
                <h2 className="text-3xl sm:text-5xl lg:text-6xl font-display">Latest <span className="text-gold italic">Blogs</span></h2>
              </div>
              <Link to="/blog" className="text-gold text-[10px] uppercase tracking-widest font-bold flex items-center gap-2 hover:gap-4 transition-all">
                View All Articles <ArrowRight size={14} />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {blogsList.map((blog, i) => (
                <motion.div
                  key={`home-blog-${blog.id || i}`}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="group cursor-pointer bg-white/[0.03] border border-white/[0.08] rounded-[1.75rem] overflow-hidden flex flex-col hover:border-gold/40 transition-all duration-500 hover:shadow-[0_8px_40px_rgba(201,168,76,0.08)]"
                  onClick={() => navigate(`/blog/${blog.slug || blog.id || ''}`)}
                >
                  {/* Image */}
                  <div className="h-52 relative overflow-hidden">
                    <img
                      src={getAssetPath(blog.image || blog.img)}
                      alt={blog.title}
                      onError={handleImageError}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-4 left-4 bg-gold text-black px-4 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest">
                      {blog.category || 'Updates'}
                    </div>
                    <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center z-10">
                      <div className="bg-black/65 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2">
                        <Calendar size={11} className="text-gold" />
                        <p className="text-gold text-[9px] uppercase tracking-widest font-bold">
                          {formatDate(blog.createdAt || blog.date)}
                        </p>
                      </div>
                      <div className="bg-black/65 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2">
                        <Clock size={11} className="text-white/50" />
                        <p className="text-white/50 text-[9px] uppercase tracking-widest font-bold">
                          {blog.readingTime || blog.readTime || '5 MIN READ'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-5 flex flex-col flex-1 gap-3">
                    <h3 className="text-lg font-display group-hover:text-gold transition-colors line-clamp-2 min-h-[3.5rem]">
                      {blog.title}
                    </h3>
                    <div className="h-px bg-white/[0.06]" />
                    <p className="text-white/50 text-xs leading-relaxed line-clamp-3 min-h-[3.5rem] break-words overflow-hidden w-full">
                      {blog.excerpt}
                    </p>
                    <div className="flex items-center gap-2 text-white/30 uppercase tracking-widest text-[9px] font-bold group-hover:text-gold transition-colors mt-auto pt-3 border-t border-white/[0.06]">
                      Read Article <ArrowRight size={13} />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 7. Last Tour Chauffeur Transfers */}
      {toursList.length > 0 && (
        <section className="py-12 relative overflow-hidden bg-[#0A0A0A]">
          <div className="max-w-7xl mx-auto px-6 relative z-10">
            <div className="text-center mb-12">
              <span className="text-gold uppercase tracking-[0.3em] text-xs font-bold mb-4 block">Featured Experiences</span>
              <h2 className="text-3xl sm:text-5xl lg:text-7xl font-display leading-tight">Private <span className="text-gold italic">Tours</span></h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {toursList.map((tour, i) => (
                <motion.div
                  key={`tour-${tour.id || i}`}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  onClick={() => navigate(`/tours/${tour.id}`)}
                  className="group bg-white/5 border border-white/10 rounded-[2rem] overflow-hidden hover:border-gold/50 transition-all duration-700 cursor-pointer relative"
                >
                  <div className="aspect-[14/9] overflow-hidden relative">
                    <img
                      src={getAssetPath(tour.image || tour.img || "https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?q=80&w=2070&auto=format&fit=crop")}
                      alt={tour.title || tour.name}
                      onError={handleImageError}
                      className="w-full h-full object-cover transition-transform duration-[1.5s] group-hover:scale-110"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />
                    {tour.promoTag && (
                      <div className="absolute top-4 left-4 bg-gold text-black px-4 py-1.5 rounded-full font-bold text-[8px] uppercase tracking-widest border border-white/20">
                        {tour.promoTag}
                      </div>
                    )}
                    {tour.category && (
                      <div className="absolute top-4 right-4 glass bg-black/70 px-4 py-1.5 rounded-full font-bold text-[8px] uppercase tracking-widest border border-white/10 text-white/80">
                        {tour.category}
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      {tour.duration && (
                        <div className="flex items-center gap-1 text-white/30 text-[9px] uppercase tracking-widest font-bold">
                          <Clock size={12} className="text-gold" /> {tour.duration}
                        </div>
                      )}
                      {tour.ageRange && (
                        <div className="flex items-center gap-1 text-white/30 text-[9px] uppercase tracking-widest font-bold">
                          <UserCheck size={12} className="text-gold" /> {tour.ageRange}
                        </div>
                      )}
                      {tour.startPlace && (
                        <div className="flex items-center gap-1 text-white/30 text-[9px] uppercase tracking-widest font-bold">
                          <MapPin size={12} className="text-gold" /> {tour.startPlace}
                        </div>
                      )}
                      {tour.maxPeople && (
                        <div className="flex items-center gap-1 text-white/30 text-[9px] uppercase tracking-widest font-bold">
                          <Users size={12} className="text-gold" /> {tour.maxPeople} Pax
                        </div>
                      )}
                    </div>
                    <h3 className="text-2xl font-display mb-3 group-hover:text-gold transition-colors">{tour.title || tour.name}</h3>
                    <p className="text-white/40 text-xs mb-3 italic line-clamp-2 leading-relaxed">
                      "{tour.shortDescription || tour.description}"
                    </p>

                    <div className="flex items-center justify-between border-t border-white/5 pt-4 group-hover:border-gold/30">
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-widest text-white/30 font-bold mb-1">Starting At</span>
                        <span className="text-lg font-display text-gold">${getStartingPrice(tour)}</span>
                      </div>
                      <div className="w-12 h-12 rounded-full border border-gold/30 flex items-center justify-center group-hover:bg-gold group-hover:text-black transition-all">
                        <ChevronRight size={20} />
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
