import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Briefcase, Check, Star, Navigation, X, Gauge, ShieldCheck, Zap, Fuel, Activity, Compass, Calendar, MapPin, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, getDocs, query } from 'firebase/firestore';
import { fleetFallback } from '../data/fallback/fleetFallback';
import { cn, getAssetPath } from '../lib/utils';
import SEO from '../components/SEO';

// Detailed specifications and availability status resolver for fleet showcase
function getVehicleSpecs(car: any) {
  const modelName = (car.model || car.name || '').toLowerCase();
  const type = (car.type || car.category || '').toLowerCase();
  
  // Default specs
  let specs = {
    engine: "2.0L TwinPower Turbo 4-Cylinder",
    power: "255 hp @ 5,800 rpm",
    torque: "400 Nm @ 1,550 rpm",
    transmission: "9-Speed Automatic Transmission",
    drivetrain: "All-Wheel Drive (AWD)",
    acceleration: "6.2 seconds",
    topSpeed: "250 km/h",
    fuelEconomy: "7.8 L / 100 km",
    suspension: "Multi-link Front & Rear Suspension",
    soundSystem: "Premium Surround Sound System",
    climate: "3-Zone Automatic Climate Control",
    seats: "Nappa Leather Active Contour Seats",
    availability: "Available",
    station: "Main Terminal Lounge",
    nextSlot: "Immediate Booking Available",
    sanitized: "Certified & Fully Detailed",
    activeTrips: "420+ Completed Trips",
    rating: "4.98 / 5.0"
  };

  if (modelName.includes('e-class') || type.includes('sedan') && !modelName.includes('s-class')) {
    specs = {
      engine: "2.0L Inline-4 Turbocharged Engine",
      power: "255 hp @ 5,800 rpm",
      torque: "400 Nm @ 1,800 rpm",
      transmission: "9G-TRONIC 9-Speed Automatic",
      drivetrain: "4MATIC All-Wheel Drive",
      acceleration: "6.1 seconds",
      topSpeed: "250 km/h (Electronically Limited)",
      fuelEconomy: "7.3 L / 100 km (Combined)",
      suspension: "AGILITY CONTROL suspension with selective damping",
      soundSystem: "Burmester® Surround Sound (13 Speakers, 590W)",
      climate: "Dual-Zone THERMATIC Automatic Climate",
      seats: "Perforated leather heated front seats with lumbar support",
      availability: "Available",
      station: "Central Executive Hub",
      nextSlot: "Within 15 minutes",
      sanitized: "Sanitized & Polished before each dispatch",
      activeTrips: "850+ Executive Trips",
      rating: "4.97 / 5.0"
    };
  } else if (modelName.includes('s-class') || type.includes('first class')) {
    specs = {
      engine: "3.0L Inline-6 Turbo with Mild Hybrid Drive",
      power: "429 hp @ 6,100 rpm",
      torque: "520 Nm @ 1,800 rpm",
      transmission: "9G-TRONIC 9-Speed Automatic",
      drivetrain: "4MATIC Permanent All-Wheel Drive",
      acceleration: "4.9 seconds",
      topSpeed: "250 km/h (Electronically Limited)",
      fuelEconomy: "8.4 L / 100 km (Combined)",
      suspension: "AIRMATIC® Air Suspension with Adaptive Damping System",
      soundSystem: "Burmester® 3D Surround Sound (15 Speakers, 710W)",
      climate: "4-Zone THERMOTRONIC Automatic Climate Control",
      seats: "Nappa Leather Rear Power Outboard Seats with Massage",
      availability: "Available",
      station: "VIP Airport Terminal Lounge",
      nextSlot: "Immediate Booking Available",
      sanitized: "Certified White-Glove Detailing Complete",
      activeTrips: "1,200+ VIP Charters",
      rating: "4.99 / 5.0"
    };
  } else if (modelName.includes('q7') || modelName.includes('x5') || type.includes('suv')) {
    specs = {
      engine: "3.0L V6 Turbocharged Engine",
      power: "335 hp @ 5,500 rpm",
      torque: "450 Nm @ 1,370 rpm",
      transmission: "8-Speed Tiptronic Automatic",
      drivetrain: "quattro Permanent All-Wheel Drive",
      acceleration: "5.6 seconds",
      topSpeed: "250 km/h",
      fuelEconomy: "9.2 L / 100 km (Combined)",
      suspension: "Adaptive Air Suspension with Ride Height Adjust",
      soundSystem: "Bang & Olufsen® 3D Premium Sound System",
      climate: "3-Zone Automatic Climate Control with Rear Vents",
      seats: "Heated & Ventilated Front Seats with Memory",
      availability: "Available",
      station: "Regional SUV & Alpine Terminal",
      nextSlot: "Within 30 minutes",
      sanitized: "Heavy Cabin UV Sanitization Certified",
      activeTrips: "640+ Mountain & Ski Charters",
      rating: "4.96 / 5.0"
    };
  } else if (modelName.includes('v-class') || type.includes('van') || type.includes('mpv')) {
    specs = {
      engine: "2.0L 4-Cylinder Turbodiesel Engine",
      power: "237 hp @ 4,200 rpm",
      torque: "500 Nm @ 1,600 rpm",
      transmission: "9G-TRONIC 9-Speed Automatic",
      drivetrain: "Rear-Wheel Drive / 4MATIC AWD Option",
      acceleration: "7.8 seconds",
      topSpeed: "220 km/h",
      fuelEconomy: "6.8 L / 100 km (Diesel Combined)",
      suspension: "AGILITY CONTROL Comfort Suspension",
      soundSystem: "Jehnert surround-sound system for passenger cabin",
      climate: "TEMPMATIC Semi-Automatic AC in Front & Rear",
      seats: "7-Seat Luxury Config (Conference Face-to-Face Setup)",
      availability: "Available",
      station: "Corporate Event Terminal",
      nextSlot: "Within 45 minutes",
      sanitized: "Deep Steam & Antimicrobial Disinfection Complete",
      activeTrips: "1,450+ Delegation Charters",
      rating: "4.95 / 5.0"
    };
  }

  return specs;
}

export default function Fleet() {
  const [fleetList, setFleetList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCar, setSelectedCar] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  useEffect(() => {
    const fetchFleet = async () => {
      try {
        const q = query(collection(db, 'fleet'));
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        const listToUse = data.length > 0 ? data : fleetFallback;
        const sortedList = [...listToUse].sort((a: any, b: any) => {
          const priceA = Number(a.basePrice || a.price || a.hourlyPrice || 0);
          const priceB = Number(b.basePrice || b.price || b.hourlyPrice || 0);
          return priceB - priceA;
        });

        setFleetList(sortedList);
      } catch (error) {
        console.warn('Fleet dynamic loading suspended, using fallback:', error);
        const sortedDefault = [...fleetFallback].sort((a: any, b: any) => {
          const priceA = Number(a.basePrice || a.price || a.hourlyPrice || 0);
          const priceB = Number(b.basePrice || b.price || b.hourlyPrice || 0);
          return priceB - priceA;
        });
        setFleetList(sortedDefault);
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
                          src={getAssetPath(car.img || car.image)}
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
                    <div className="border-t border-white/5 pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                        <Link 
                          to="/booking" 
                          state={{ vehicle: car.id, service: "distance" }}
                          className="flex-1 sm:flex-initial bg-gold text-black py-4 md:py-5 px-8 md:px-10 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] md:text-xs hover:bg-white hover:scale-105 active:scale-95 transition-all shadow-[0_10px_30px_rgba(212,175,55,0.15)] text-center"
                        >
                          Reserve Now
                        </Link>
                        <button
                          onClick={() => {
                            setSelectedCar(car);
                            setDrawerOpen(true);
                          }}
                          className="flex-1 sm:flex-initial border border-gold/20 hover:border-gold/50 text-white hover:text-gold bg-white/5 hover:bg-gold/5 py-4 md:py-5 px-8 md:px-10 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] md:text-xs hover:scale-105 active:scale-95 transition-all text-center flex items-center justify-center gap-2"
                        >
                          <Gauge size={12} className="text-gold" />
                          Specs & Availability
                        </button>
                      </div>
                      <div className="flex flex-col text-center sm:text-right">
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

      {/* Interactive Fleet Showcase Specs Drawer */}
      <AnimatePresence>
        {drawerOpen && selectedCar && (() => {
          const specs = getVehicleSpecs(selectedCar);
          return (
            <>
              {/* Drawer Backdrop with blur */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setDrawerOpen(false)}
                className="fixed inset-0 bg-black/80 backdrop-blur-md z-[140] cursor-pointer"
              />

              {/* Drawer Body */}
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 220 }}
                className="fixed top-0 right-0 h-full w-full sm:w-[500px] md:w-[540px] bg-[#070707] border-l border-white/10 shadow-[[-20px_0_50px_rgba(0,0,0,0.95)]] z-[150] flex flex-col overflow-hidden"
              >
                {/* Drawer Sticky Header */}
                <div className="sticky top-0 bg-[#070707]/95 backdrop-blur-lg z-10 px-6 py-5 border-b border-white/10 flex items-center justify-between">
                  <div>
                    <span className="text-gold uppercase tracking-[0.25em] text-[10px] font-black block mb-1">
                      Technical Showcase
                    </span>
                    <h2 className="text-2xl md:text-3xl font-display text-white tracking-tight">
                      {selectedCar.name}
                    </h2>
                    <p className="text-gold/60 text-xs font-mono uppercase mt-0.5">
                      {selectedCar.model}
                    </p>
                  </div>
                  <button
                    onClick={() => setDrawerOpen(false)}
                    className="w-10 h-10 rounded-full border border-white/10 hover:border-gold/50 flex items-center justify-center hover:bg-gold/10 text-white hover:text-gold transition-all duration-300 group"
                  >
                    <X size={16} className="transition-transform duration-300 group-hover:rotate-90" />
                  </button>
                </div>

                {/* Drawer Main Content - Scrollable */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8 pb-32">
                  {/* Hero Vehicle Image */}
                  <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black/40">
                    <img
                      src={getAssetPath(selectedCar.img || selectedCar.image)}
                      alt={selectedCar.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#070707] via-transparent to-transparent" />
                    <div className="absolute bottom-4 left-4">
                      <span className="bg-gold/10 text-gold text-[9px] uppercase tracking-[0.2em] font-black px-3 py-1 rounded-full border border-gold/20 backdrop-blur-md">
                        {selectedCar.type || selectedCar.category || 'Luxury'} Class
                      </span>
                    </div>
                  </div>

                  {/* Real-time Availability & Live Dispatch Tracking */}
                  <div className="p-5 bg-gradient-to-br from-white/[0.02] to-transparent border border-gold/15 rounded-2xl relative overflow-hidden group">
                    <div className="absolute -right-12 -top-12 w-28 h-28 bg-gold/5 rounded-full blur-2xl group-hover:bg-gold/10 transition-colors" />
                    
                    <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
                      <div className="flex items-center gap-2.5">
                        <Activity className="text-gold w-4 h-4" />
                        <span className="text-[10px] text-white/40 uppercase tracking-widest font-black">Live Dispatch State</span>
                      </div>
                      <div className="flex items-center gap-2 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        <span className="text-emerald-400 text-[9px] uppercase font-black tracking-widest">Available Now</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-xs">
                      <div>
                        <span className="text-white/30 text-[8px] uppercase tracking-widest block font-black mb-0.5">Assigned Station</span>
                        <span className="text-white/80 font-bold flex items-center gap-1.5">
                          <MapPin size={10} className="text-gold shrink-0" />
                          {specs.station}
                        </span>
                      </div>
                      <div>
                        <span className="text-white/30 text-[8px] uppercase tracking-widest block font-black mb-0.5">Est. Dispatch Time</span>
                        <span className="text-white/80 font-bold flex items-center gap-1.5">
                          <Compass size={10} className="text-gold shrink-0 animate-spin-slow" />
                          {specs.nextSlot}
                        </span>
                      </div>
                      <div>
                        <span className="text-white/30 text-[8px] uppercase tracking-widest block font-black mb-0.5">Sanitisation Certification</span>
                        <span className="text-white/80 font-bold flex items-center gap-1.5">
                          <ShieldCheck size={10} className="text-gold shrink-0" />
                          {specs.sanitized}
                        </span>
                      </div>
                      <div>
                        <span className="text-white/30 text-[8px] uppercase tracking-widest block font-black mb-0.5">Active Service Stats</span>
                        <span className="text-white/80 font-bold flex items-center gap-1.5">
                          <Star size={10} className="text-gold shrink-0 fill-gold/20" />
                          {specs.rating} ({specs.activeTrips})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Technical Specifications */}
                  <div className="space-y-4">
                    <h3 className="text-[10px] uppercase tracking-[0.3em] font-black text-white/30 border-l-2 border-gold pl-3">
                      Performance & Engineering
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl bg-white/[0.01] border border-white/5 space-y-1 hover:border-white/10 transition-colors">
                        <div className="flex items-center gap-2 mb-1.5">
                          <Gauge size={14} className="text-gold" />
                          <span className="text-[9px] text-white/40 uppercase tracking-widest font-black">Engine / Power Unit</span>
                        </div>
                        <p className="text-white text-xs font-bold">{specs.engine}</p>
                      </div>

                      <div className="p-4 rounded-xl bg-white/[0.01] border border-white/5 space-y-1 hover:border-white/10 transition-colors">
                        <div className="flex items-center gap-2 mb-1.5">
                          <Zap size={14} className="text-gold" />
                          <span className="text-[9px] text-white/40 uppercase tracking-widest font-black">Total Output</span>
                        </div>
                        <p className="text-white text-xs font-bold">{specs.power}</p>
                      </div>

                      <div className="p-4 rounded-xl bg-white/[0.01] border border-white/5 space-y-1 hover:border-white/10 transition-colors">
                        <div className="flex items-center gap-2 mb-1.5">
                          <Activity size={14} className="text-gold" />
                          <span className="text-[9px] text-white/40 uppercase tracking-widest font-black">Maximum Torque</span>
                        </div>
                        <p className="text-white text-xs font-bold">{specs.torque}</p>
                      </div>

                      <div className="p-4 rounded-xl bg-white/[0.01] border border-white/5 space-y-1 hover:border-white/10 transition-colors">
                        <div className="flex items-center gap-2 mb-1.5">
                          <Compass size={14} className="text-gold" />
                          <span className="text-[9px] text-white/40 uppercase tracking-widest font-black">Transmission</span>
                        </div>
                        <p className="text-white text-xs font-bold">{specs.transmission}</p>
                      </div>

                      <div className="p-4 rounded-xl bg-white/[0.01] border border-white/5 space-y-1 hover:border-white/10 transition-colors">
                        <div className="flex items-center gap-2 mb-1.5">
                          <ShieldCheck size={14} className="text-gold" />
                          <span className="text-[9px] text-white/40 uppercase tracking-widest font-black">Drivetrain</span>
                        </div>
                        <p className="text-white text-xs font-bold">{specs.drivetrain}</p>
                      </div>

                      <div className="p-4 rounded-xl bg-white/[0.01] border border-white/5 space-y-1 hover:border-white/10 transition-colors">
                        <div className="flex items-center gap-2 mb-1.5">
                          <Activity size={14} className="text-gold" />
                          <span className="text-[9px] text-white/40 uppercase tracking-widest font-black">0-100 km/h Sprint</span>
                        </div>
                        <p className="text-white text-xs font-bold">{specs.acceleration}</p>
                      </div>

                      <div className="p-4 rounded-xl bg-white/[0.01] border border-white/5 space-y-1 hover:border-white/10 transition-colors">
                        <div className="flex items-center gap-2 mb-1.5">
                          <Gauge size={14} className="text-gold" />
                          <span className="text-[9px] text-white/40 uppercase tracking-widest font-black">Maximum Velocity</span>
                        </div>
                        <p className="text-white text-xs font-bold">{specs.topSpeed}</p>
                      </div>

                      <div className="p-4 rounded-xl bg-white/[0.01] border border-white/5 space-y-1 hover:border-white/10 transition-colors">
                        <div className="flex items-center gap-2 mb-1.5">
                          <Fuel size={14} className="text-gold" />
                          <span className="text-[9px] text-white/40 uppercase tracking-widest font-black">Consumption Rate</span>
                        </div>
                        <p className="text-white text-xs font-bold">{specs.fuelEconomy}</p>
                      </div>
                    </div>
                  </div>

                  {/* Cabin Comfort & Luxury features */}
                  <div className="space-y-4">
                    <h3 className="text-[10px] uppercase tracking-[0.3em] font-black text-white/30 border-l-2 border-gold pl-3">
                      Cabin & Ride Experience
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3.5 p-4 rounded-xl bg-white/[0.01] border border-white/5">
                        <ShieldCheck className="text-gold w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[9px] text-white/40 uppercase tracking-widest font-black block">Chassis & Suspension</span>
                          <p className="text-white/80 text-xs mt-0.5">{specs.suspension}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3.5 p-4 rounded-xl bg-white/[0.01] border border-white/5">
                        <Zap className="text-gold w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[9px] text-white/40 uppercase tracking-widest font-black block">Acoustic Sound Stage</span>
                          <p className="text-white/80 text-xs mt-0.5">{specs.soundSystem}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3.5 p-4 rounded-xl bg-white/[0.01] border border-white/5">
                        <User className="text-gold w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[9px] text-white/40 uppercase tracking-widest font-black block">Comfort Seating</span>
                          <p className="text-white/80 text-xs mt-0.5">{specs.seats}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3.5 p-4 rounded-xl bg-white/[0.01] border border-white/5">
                        <Compass className="text-gold w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[9px] text-white/40 uppercase tracking-widest font-black block">Climate Control</span>
                          <p className="text-white/80 text-xs mt-0.5">{specs.climate}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Standard Amenities */}
                  <div className="space-y-4">
                    <h3 className="text-[10px] uppercase tracking-[0.3em] font-black text-white/30 border-l-2 border-gold pl-3">
                      Standard Chauffeur Amenities
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      {selectedCar.features?.map((f: string) => (
                        <div key={f} className="flex items-center gap-2 text-xs text-white/60">
                          <Check size={12} className="text-gold shrink-0" />
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Drawer Footer with Quick Reserve Link */}
                <div className="sticky bottom-0 bg-gradient-to-t from-black via-[#070707]/98 to-[#070707]/90 backdrop-blur-lg border-t border-white/10 px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 z-10 shadow-[0_-15px_30px_rgba(0,0,0,0.8)]">
                  <div className="flex flex-col text-center sm:text-left shrink-0">
                    <span className="text-[9px] uppercase text-white/30 font-black tracking-[0.3em]">Corporate Base Rate</span>
                    <span className="text-2xl font-display text-gold">
                      ${selectedCar.basePrice || selectedCar.price || '0.00'}
                      <sup className="text-xs ml-0.5 opacity-60">+</sup>
                      <span className="text-xs ml-0.5 opacity-60 font-sans">/ trip</span>
                    </span>
                  </div>
                  <Link
                    to="/booking"
                    state={{ vehicle: selectedCar.id, service: "distance" }}
                    onClick={() => setDrawerOpen(false)}
                    className="w-full sm:w-auto flex-1 bg-gold hover:bg-white text-black text-center py-4 px-8 rounded-xl font-black uppercase tracking-[0.2em] text-[11px] md:text-xs transition-all shadow-[0_8px_25px_rgba(212,175,55,0.15)] hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    Proceed with {selectedCar.name}
                  </Link>
                </div>
              </motion.div>
            </>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
