import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { User, Briefcase, Check, Star, Navigation } from 'lucide-react';
import { Link } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import SEO from '../components/SEO';

const DEFAULT_FLEET = [
  {
    id: 'sedan',
    name: 'Luxury Sedan',
    model: 'Mercedes-Benz E-Class',
    pax: 3,
    bags: 2,
    features: ['Leather Interior', 'Climate Control', 'Bottled Water', 'WiFi'],
    img: 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?q=80&w=2070&auto=format&fit=crop',
    excerpt: 'Perfect for corporate travel and airport transfers for up to 3 passengers.'
  },
  // ... other defaults if needed, but we prefer Firestore
];

export default function Fleet() {
  const [fleetList, setFleetList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFleet = async () => {
      try {
        const q = query(collection(db, 'fleet'), orderBy('name', 'asc'));
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        if (data.length > 0) {
          setFleetList(data);
        } else {
          setFleetList(DEFAULT_FLEET);
        }
      } catch (error) {
        console.error('Error fetching fleet:', error);
        setFleetList(DEFAULT_FLEET);
      } finally {
        setLoading(false);
      }
    };

    fetchFleet();
  }, []);

  return (
    <div className="pt-20 md:pt-32 pb-24 bg-black min-h-screen">
      <SEO 
        title="Our Luxury Vehicle Fleet"
        description="Experience the pinnacle of automotive engineering. Browse our meticulously maintained fleet of premium sedans, SUVs, and luxury vans for any occasion."
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-16 md:mb-20">
          <span className="text-gold uppercase tracking-[0.3em] text-[10px] md:text-xs font-bold mb-4 block">Our Fleet</span>
          <h1 className="text-4xl md:text-7xl font-display mb-6">Exquisite Vehicles</h1>
          <p className="text-white/50 max-w-2xl mx-auto font-light tracking-wide text-sm md:text-base px-2">
            Experience the pinnacle of automotive engineering with our meticulously maintained fleet of premium vehicles.
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 border-2 border-gold/20 border-t-gold rounded-full animate-spin" />
            <p className="text-gold text-[10px] uppercase tracking-widest font-bold">Preparing The Fleet...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-16 md:gap-24">
            {fleetList.map((car, i) => (
              <motion.div
                key={car.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6 }}
                className="flex flex-col gap-8"
              >
                <div className={cn(
                  "flex flex-col lg:flex-row gap-8 md:gap-12 lg:items-center",
                  i % 2 === 1 ? "lg:flex-row-reverse" : ""
                )}>
                  {/* Image & Action Section (Left Column) */}
                  <div className="flex-1 flex flex-col gap-6">
                    {/* Image Section */}
                    <div className="relative group w-full">
                      <div className="absolute -inset-2 md:-inset-4 bg-gold/10 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                      <div className="relative w-full aspect-video overflow-hidden rounded-[1.5rem] md:rounded-[2.5rem] border border-white/10 group-hover:border-gold/30 transition-colors">
                        <img
                          src={car.img || car.image}
                          alt={car.name}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />

                        {/* Top Left Overlay: Vehicle Type */}
                        <div className="absolute top-4 left-4 md:top-8 md:left-8">
                          <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 md:px-5 md:py-2.5 rounded-full border border-white/10 flex items-center gap-2">
                            <Star size={10} className="md:w-3 md:h-3 text-gold fill-gold/20" />
                            <span className="text-gold text-[8px] md:text-xs uppercase tracking-[0.2em] font-black">
                              {car.type || car.category || 'Premium'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Reserve & Price Section */}
                    <div className="border-t border-white/5 pt-6 flex flex-col sm:flex-row items-center justify-between gap-6">
                      <Link to="/booking" className="w-full sm:w-auto bg-gold text-black py-4 md:py-5 px-10 md:px-12 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] md:text-xs hover:bg-white hover:scale-105 active:scale-95 transition-all shadow-[0_10px_30px_rgba(212,175,55,0.2)] text-center">
                        Reserve Now
                      </Link>
                      <div className="flex flex-col text-center lg:text-right">
                        <span className="text-[9px] md:text-[10px] uppercase text-white/30 font-black tracking-[0.3em]">Corporate Rate From</span>
                        <span className="text-xl sm:text-2xl md:text-3xl font-display text-gold">
                          ${car.basePrice || car.price || '0.00'}
                          <sup className="text-[10px] sm:text-xs md:text-lg ml-1 opacity-60">+</sup>
                          <span className="text-[10px] sm:text-xs md:text-sm ml-1 opacity-60">/ trip</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Content Section (Right Column) */}
                  <div className="flex-1 flex flex-col justify-start py-2 md:py-4 space-y-6 lg:space-y-6 w-full">
                    <div className="space-y-4 md:space-y-6">
                      <div className="text-center lg:text-left">
                        <h2 className="text-3xl md:text-4xl lg:text-5xl font-display mb-2 lg:mb-3 tracking-tight">{car.name}</h2>
                        <p className="text-gold font-black tracking-[0.3em] uppercase text-[9px] md:text-xs">{car.model}</p>
                      </div>

                      {(car.excerpt || car.desc) && (
                        <div className="relative text-center lg:text-left">
                          <p className="text-white/60 leading-relaxed italic text-sm md:text-base font-light tracking-wide max-w-xl mx-auto lg:mx-0">
                            "{car.excerpt || car.desc}"
                          </p>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4 md:gap-6 max-w-sm mx-auto lg:mx-0">
                        <div className="flex items-center gap-3 md:gap-4 text-white/80 group">
                          <div className="w-10 h-10 md:w-12 md:h-12 bg-white/5 rounded-2xl flex items-center justify-center shrink-0 border border-white/5 group-hover:border-gold/20 transition-colors">
                            <User size={16} className="md:w-5 md:h-5 text-gold" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[9px] text-white/30 uppercase font-black tracking-widest">Capacity</span>
                            <span className="text-xs md:text-sm font-bold whitespace-nowrap">{car.pax || car.capacity || car.passengers} Passengers</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 md:gap-4 text-white/80 group">
                          <div className="w-10 h-10 md:w-12 md:h-12 bg-white/5 rounded-2xl flex items-center justify-center shrink-0 border border-white/5 group-hover:border-gold/20 transition-colors">
                            <Briefcase size={16} className="md:w-5 md:h-5 text-gold" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[9px] text-white/30 uppercase font-black tracking-widest">Luggages</span>
                            <span className="text-xs md:text-sm font-bold whitespace-nowrap">{car.bags || car.luggage || '2 Large'} Suitcases/Bags</span>
                          </div>
                        </div>
                      </div>

                      {car.bestFor && car.bestFor.length > 0 && (
                        <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
                          {car.bestFor.map((item: string, idx: number) => (
                            <span key={idx} className="bg-gold/5 text-gold text-[8px] md:text-[10px] uppercase font-black tracking-[0.15em] px-3 md:px-4 py-1.5 rounded-full border border-gold/10 flex items-center gap-2">
                              <Navigation size={8} className="md:w-2.5 md:h-2.5 rotate-45" /> {item}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="space-y-4">
                        <h4 className="text-[9px] md:text-[10px] lg:text-xs uppercase tracking-[0.3em] font-black text-white/20 border-l-2 border-gold pl-3">Premium Amenities</h4>
                        <div className="grid grid-cols-2 gap-y-3 md:gap-y-4 text-left max-w-md mx-auto lg:mx-0">
                          {(car.features || []).map((feature: string) => (
                            <div key={feature} className="flex items-center gap-2.5 text-xs md:text-sm text-white/60 hover:text-white transition-colors">
                              <Check size={12} className="md:w-4 md:h-4 text-gold shrink-0" /> {feature}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Explore More Section */}
        <div className="mt-32 max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="relative bg-black border border-white/10 rounded-[2rem] p-10 flex flex-col items-center text-center group overflow-hidden transition-all hover:border-gold/50"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <h3 className="text-3xl font-display mb-4 text-white relative z-10">Discover Tours</h3>
              <p className="text-white/60 mb-10 text-sm font-light tracking-wide relative z-10">Explore our curated luxury tour experiences.</p>
              <Link to="/tours" className="relative z-10 border border-gold text-gold hover:bg-gold hover:text-black py-4 px-10 rounded-full text-[10px] font-black uppercase tracking-[0.3em] transition-all">
                View Tours
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="relative bg-black border border-white/10 rounded-[2rem] p-10 flex flex-col items-center text-center group overflow-hidden transition-all hover:border-gold/50"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <h3 className="text-3xl font-display mb-4 text-white relative z-10">Special Offers</h3>
              <p className="text-white/60 mb-10 text-sm font-light tracking-wide relative z-10">Check out our latest premium travel deals.</p>
              <Link to="/offers" className="relative z-10 border border-gold text-gold hover:bg-gold hover:text-black py-4 px-10 rounded-full text-[10px] font-black uppercase tracking-[0.3em] transition-all">
                View Offers
              </Link>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
