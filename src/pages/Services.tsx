import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import SEO from '../components/SEO';
import { pagesFallback } from '../data/fallback/pagesFallback';
import { getCachedDocs } from '../lib/firestore-cache';

export default function Services() {
  const navigate = useNavigate();
  const [dynamicServices, setDynamicServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const q = query(
          collection(db, 'pages'),
          where('category', '==', 'Services')
        );
        const fetched = await getCachedDocs(q, 'services_list');
        
        // Filter in memory for maximum reliability and handle missing 'active' field
        const filtered = fetched
          .filter((p: any) => p.active !== false)
          .sort((a: any, b: any) => {
            const timeA = a.createdAt?.seconds || 0;
            const timeB = b.createdAt?.seconds || 0;
            return timeB - timeA;
          });
          
        if (filtered.length > 0) {
          setDynamicServices(filtered);
        } else {
          // Fallback to static data
          const fallbackList = pagesFallback.filter(p => p.category === 'Services' && p.active !== false);
          setDynamicServices(fallbackList);
        }
      } catch (err) {
        console.error('Error fetching dynamic services, loading fallback:', err);
        const fallbackList = pagesFallback.filter(p => p.category === 'Services' && p.active !== false);
        setDynamicServices(fallbackList);
      } finally {
        setLoading(false);
      }
    };
    fetchServices();
  }, []);

  return (
    <div className="pt-20 pb-24 bg-[#050505] min-h-screen">
      <SEO 
        title="Our Premium Chauffeur Services"
        description="Explore Melbourne's most refined transport solutions. From corporate elegance to bespoke private journeys and airport transfers."
      />
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <span className="text-gold uppercase tracking-[0.3em] text-xs font-bold mb-4 block">Excellence in Motion</span>
            <h1 className="text-5xl md:text-7xl font-display mb-6">Our Elite <span className="text-gold italic">Services</span></h1>
            <p className="text-white/50 max-w-2xl mx-auto text-lg font-light leading-relaxed">
              Experience Melbourne's most refined transport solutions. From corporate elegance to bespoke private journeys.
            </p>
          </motion.div>
        </div>
        
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-12 h-12 border-2 border-gold/20 border-t-gold rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {dynamicServices.length > 0 ? (
              dynamicServices.map((service, i) => (
                <motion.div
                  key={service.id || i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  viewport={{ once: true }}
                  onClick={() => navigate(`/${service.slug}`)}
                  className="group bg-white/[0.03] border border-white/10 rounded-[2.5rem] overflow-hidden hover:border-gold/50 transition-all duration-700 cursor-pointer flex flex-col h-full hover:shadow-[0_20px_50px_rgba(212,175,55,0.1)]"
                >
                  <div className="h-72 overflow-hidden relative">
                    <img 
                      src={service.featuredImage || 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?q=80&w=2070&auto=format&fit=crop'} 
                      alt={service.featuredImageAlt || service.title} 
                      className="w-full h-full object-cover transition-transform duration-[1.5s] group-hover:scale-110"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                    
                    <div className="absolute top-6 left-6">
                      <div className="bg-black/60 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10">
                        <p className="text-gold text-[10px] uppercase font-bold tracking-widest">{service.category}</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-8 flex flex-col flex-1">
                    <h3 className="text-3xl font-display mb-4 group-hover:text-gold transition-colors">{service.title}</h3>
                    {service.excerpt && (
                      <p className="text-white/40 text-sm leading-relaxed mb-8 line-clamp-3 italic">
                        "{service.excerpt}"
                      </p>
                    )}
                    
                    <div className="mt-auto pt-6 border-t border-white/5 flex items-center justify-between group-hover:border-gold/30">
                      <span className="text-[10px] uppercase tracking-widest font-bold text-white/30 group-hover:text-gold transition-colors">Discover Details</span>
                      <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center group-hover:bg-gold group-hover:text-black transition-all">
                        <ArrowRight size={16} />
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="col-span-full py-20 text-center glass rounded-[3rem] border border-dashed border-white/10">
                <p className="text-white/40 italic text-xl">Our specialized services are being updated. Please check back shortly.</p>
              </div>
            )}
          </div>
        )}

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-32 bg-[#0A0A0A] border border-gold/15 rounded-[3rem] p-12 md:p-24 text-center relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none text-gold/20">
            <div className="absolute top-[-50%] right-[-20%] w-[100%] h-[200%] bg-current blur-[120px] rounded-full -rotate-45" />
          </div>
          <div className="relative z-10 max-w-2xl mx-auto">
            <span className="uppercase tracking-[0.3em] text-[10px] font-bold mb-4 block text-gold">Elite Transport</span>
            <h2 className="text-4xl md:text-6xl font-display mb-8 leading-tight text-white">Experience <span className="text-gold italic">Pure Luxury</span></h2>
            <p className="text-white/50 mb-10 text-lg leading-relaxed text-balance">
              From bespoke corporate travel to specialized regional excursions, our fleet and chauffeurs are at your service for any requirement.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <Link 
                to="/booking" 
                className="bg-gold text-black px-12 py-5 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-white transition-all shadow-2xl shadow-gold/20"
              >
                Start Your Booking
              </Link>
              <Link 
                to="/offers" 
                className="bg-white/5 backdrop-blur-md border border-white/10 text-white px-12 py-5 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-gold hover:text-black transition-all"
              >
                Explore Offers
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
