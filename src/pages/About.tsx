import { motion } from 'motion/react';
import { Shield, Clock, Award, Star, Compass, Target } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';

export default function About() {
  const values = [
    {
      icon: <Shield className="w-6 h-6 text-gold" />,
      title: "Safety First",
      description: "Our vehicles undergo rigorous safety inspections and our chauffeurs are trained in defensive driving and first aid."
    },
    {
      icon: <Clock className="w-6 h-6 text-gold" />,
      title: "Absolute Punctuality",
      description: "We understand that time is your most valuable asset. We guarantee arriving 15 minutes before your scheduled pickup."
    },
    {
      icon: <Award className="w-6 h-6 text-gold" />,
      title: "Excellence in Service",
      description: "From the moment you book until you reach your destination, we provide a seamless, white-glove experience."
    }
  ];

  return (
    <div className="bg-black min-h-screen text-white font-sans overflow-x-hidden">
      <SEO 
        title="About Our Luxury Chauffeur Service"
        description="Merlux Chauffeur Services: A legacy of distinction in Melbourne luxury travel since 2008. Discover our story and commitment to excellence."
      />
      {/* Hero Section */}
      <section className="relative h-[50vh] flex items-center justify-center overflow-hidden pt-10">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?q=80&w=2070&auto=format&fit=crop"
            alt="Luxury Interior"
            className="w-full h-full object-cover opacity-40 scale-105"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 text-center">
          <motion.span 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-gold uppercase tracking-[0.4em] text-xs font-bold mb-6 block"
          >
            Since 2008
          </motion.span>
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl font-display leading-[0.9] mb-8"
          >
            Redefining <span className="text-gold italic">Luxury</span> Travel
          </motion.h1>
        </div>
      </section>

      {/* Story Section */}
      <section className="py-32 max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <span className="text-gold uppercase tracking-widest text-[10px] font-bold mb-4 block underline decoration-gold/30 underline-offset-8">Our Story</span>
            <h2 className="text-2xl md:text-5xl font-display mb-4 leading-tight">
              A Legacy of <span className="text-gold italic">Distinction</span> in Melbourne
            </h2>
            <div className="space-y-6 text-white/60 text-sm md:text-lg leading-relaxed">
              <p>
                Founded on the principle that travel should be more than just a transition, Merlux Chauffeur Services was established in the heart of Melbourne as the premier choice for discerning travelers.
              </p>
              <p>
                What started with a single luxury sedan has grown into a prestigious fleet and a team of dedicated professional chauffeurs. Our journey has been defined by a relentless pursuit of perfection and an unwavering commitment to our clients' needs.
              </p>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-8 border-t border-white/10 pt-12">
              <div>
                <span className="text-4xl font-display text-gold block mb-1">15k+</span>
                <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Journeys Completed</span>
              </div>
              <div>
                <span className="text-4xl font-display text-gold block mb-1">99.9%</span>
                <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold">On-Time Arrival</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="aspect-[4/5] rounded-sm overflow-hidden border border-white/10 group">
              <img 
                src="https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?q=80&w=2070&auto=format&fit=crop" 
                alt="Professional Chauffeur" 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                referrerPolicy="no-referrer"
              />
            </div>
            {/* Decal badge */}
            <div className="absolute -bottom-10 -right-10 glass p-12 border border-gold/20 hidden md:block rounded-md">
              <div className="text-center">
                <Star className="text-gold w-6 h-6 mx-auto mb-2" />
                <span className="text-4xl font-display text-white block">15+</span>
                <span className="text-[10px] uppercase tracking-widest text-gold font-bold">Years of Excellence</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-20 bg-white/[0.02] border-t border-b border-white/5 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="glass p-8 relative group overflow-hidden rounded-md"
            >
              <div className="absolute -right-8 -top-8 text-white/[0.03] rotate-12 group-hover:scale-110 transition-transform duration-700">
                <Compass size={240} />
              </div>
              <Compass className="text-gold w-10 h-10 mb-8" />
              <h3 className="text-2xl font-display mb-3">Our Mission</h3>
              <p className="text-white/60 leading-relaxed text-sm md:text-lg">
                To move our clients with unparalleled elegance and precision, setting the global benchmark for professional chauffeur services through innovation, integrity, and exceptional care.
              </p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="glass p-8 relative group overflow-hidden rounded-md"
            >
              <div className="absolute -right-8 -top-8 text-white/[0.03] rotate-12 group-hover:scale-110 transition-transform duration-700">
                <Target size={240} />
              </div>
              <Target className="text-gold w-10 h-10 mb-8" />
              <h3 className="text-2xl font-display mb-3">Our Vision</h3>
              <p className="text-white/60 leading-relaxed text-sm md:text-lg">
                To be recognized as Melbourne's most trusted luxury transportation partner, where every journey contributes to our legacy of safety, comfort, and sophisticated excellence.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Our Values */}
      <section className="py-20 max-w-7xl mx-auto px-6">
        <div className="text-center mb-20">
          <span className="text-gold uppercase tracking-widest text-[10px] font-bold mb-4 block underline decoration-gold/30 underline-offset-8">The Merlux Standard</span>
          <h2 className="text-4xl md:text-5xl font-display">Core Philosophies</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {values.map((v, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center group"
            >
              <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-full flex items-center justify-center mx-auto mb-8 group-hover:border-gold transition-colors duration-500">
                {v.icon}
              </div>
              <h4 className="text-xl font-display mb-4 text-white group-hover:text-gold transition-colors">{v.title}</h4>
              <p className="text-white/50 leading-relaxed text-sm">
                {v.description}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 border-t border-white/10">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-5xl font-display mb-12 leading-tight">
            Ready to experience <br/>
            the <span className="text-gold italic">pinnacle</span> of travel?
          </h2>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Link 
              to="/booking" 
              className="bg-gold text-black px-12 py-5 rounded-sm font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-white transition-all duration-500 w-full sm:w-auto text-center"
            >
              Book Your Chauffeur
            </Link>
            <Link 
              to="/fleet" 
              className="border border-white/20 text-white px-12 py-5 rounded-sm font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-white/10 transition-all duration-500 w-full sm:w-auto text-center"
            >
              Explore Our Fleet
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
