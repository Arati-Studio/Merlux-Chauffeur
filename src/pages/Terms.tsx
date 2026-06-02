import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, ShieldAlert, Scale, ChevronRight, HelpCircle, ArrowUp, Calendar, Search } from 'lucide-react';
import SEO from '../components/SEO';

interface TermSection {
  id: string;
  title: string;
  number: string;
  content: string[];
}

const Terms: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState<string>('intro');

  const termsData = useMemo<TermSection[]>(() => [
    {
      id: "intro",
      number: "1.0",
      title: "Introduction and Agreement",
      content: [
        "1.1 Welcome to Merlux Chauffeuring Services (\"Merlux,\" \"we,\" \"us,\" \"our\"). These Terms and Conditions constitute a legally binding agreement between you (\"the Client,\" \"you\") and Merlux.",
        "1.2 By making a booking with us, you confirm that you have read, understood, and agree to be bound by these terms in their entirety."
      ]
    },
    {
      id: "definitions",
      number: "2.0",
      title: "Definitions",
      content: [
        "2.1 “Service” means the chauffeured vehicle transportation services provided by Merlux.",
        "2.2 “Booking” means a reservation for our Service that has been confirmed following the receipt of the required deposit.",
        "2.3 “Client” refers to the individual, company, or entity making the booking and responsible for all passengers."
      ]
    },
    {
      id: "bookings",
      number: "3.0",
      title: "Bookings and Confirmation",
      content: [
        "3.1 Bookings can be made via our official website, email, or telephone. All bookings are subject to vehicle availability.",
        "3.2 A booking is tentative until the 50% non-refundable deposit is paid and confirmation received by email.",
        "3.3 The Client must ensure all booking details are accurate. Merlux is not liable for service disruptions caused by incorrect information."
      ]
    },
    {
      id: "pricing",
      number: "4.0",
      title: "Pricing and Payment",
      content: [
        "4.1 All prices are quoted in AUD and inclusive of GST.",
        "4.2 A 50% non-refundable deposit is required to confirm your reservation.",
        "4.3 The remaining balance must be paid before the service date.",
        "4.4 Quoted prices include the vehicle, driver, fuel, and insurance. Additional charges may apply for tolls, airport parking, or requested amenities.",
        "4.5 Public Holiday surcharges may apply.",
        "4.6 Out-of-hours surcharge of $30 applies between 11:00 PM and 5:00 AM."
      ]
    },
    {
      id: "procedures",
      number: "5.0",
      title: "Service Details and Procedures",
      content: [
        "5.1 Airport Meet & Greet: Chauffeurs will meet you in the arrivals hall with a personalised sign and assist with luggage.",
        "5.2 Waiting Time Policy:",
        " • 15 minutes for residential, hotel, or business pick-ups",
        " • 30 minutes for domestic airport pick-ups",
        " • 60 minutes for international airport pick-ups",
        "5.3 After the complimentary time, waiting is charged pro-rata in 15-minute increments."
      ]
    },
    {
      id: "refunds",
      number: "6.0",
      title: "Refund and Cancellation Policy",
      content: [
        "6.1 The 50% booking deposit is non-refundable.",
        "6.2 Airport Transfers (Cancellations):",
        " • More than 24 hrs – refund beyond deposit.",
        " • 3–24 hrs – 50% cancellation fee.",
        " • Less than 3 hrs – 100% cancellation fee.",
        "6.3 Other Services (Cancellations):",
        " • More than 24 hrs – refund beyond deposit.",
        " • Less than 24 hrs – 100% cancellation fee.",
        "6.4 No-Shows: Charged 100% of the total booking fee.",
        "6.5 Cancellations must be confirmed by Merlux via phone or email."
      ]
    },
    {
      id: "conduct",
      number: "7.0",
      title: "Passenger Conduct and Safety",
      content: [
        "7.1 Clients are liable for vehicle damage. Cleaning fee minimum $250 for spills or soiling.",
        "7.2 Seatbelts are mandatory. Notify us if passengers under 7 years old require child seats.",
        "7.3 Smoking, vaping, and illegal substances are prohibited within all Merlux vehicles.",
        "7.4 The driver may terminate service immediately for illegal or unsafe conduct without refund."
      ]
    },
    {
      id: "luggage",
      number: "8.0",
      title: "Luggage Policy",
      content: [
        "8.1 Declare luggage requirements during booking. Merlux is not responsible for undeclared excess luggage.",
        "8.2 Merlux is not liable for lost or damaged belongings inside or outside the vehicle."
      ]
    },
    {
      id: "allocation",
      number: "9.0",
      title: "Vehicle Allocation and Substitution",
      content: [
        "9.1 Merlux will strive to provide your chosen vehicle, but reserves the right to substitute with a similar or higher category if required.",
        "9.2 If downgraded to a lower category vehicle, pricing will be adjusted accordingly."
      ]
    },
    {
      id: "liability",
      number: "10.0",
      title: "Limitation of Liability",
      content: [
        "10.1 Merlux is not liable for delays or missed flights caused by major traffic, weather conditions, or other factors completely beyond our control.",
        "10.2 We are not responsible for any personal items left in our luxury vehicles."
      ]
    },
    {
      id: "privacy",
      number: "11.0",
      title: "Privacy and Security",
      content: [
        "11.1 Merlux collects personal information solely for booking fulfilment and secure service delivery.",
        "11.2 Customer data is not shared with third parties unless required by Australian law or service necessity."
      ]
    },
    {
      id: "general",
      number: "12.0",
      title: "General Provisions",
      content: [
        "12.1 Merlux reserves the right to update these Terms at any time. The terms effective at the time of booking will apply.",
        "12.2 If any clause of this agreement is held to be invalid or unenforceable, the remaining clauses will remain fully enforceable."
      ]
    },
    {
      id: "governing",
      number: "13.0",
      title: "Governing Law",
      content: [
        "13.1 This agreement is governed by the laws of Victoria, Australia.",
        "13.2 Both parties unconditionally submit to the exclusive jurisdiction of Victorian courts."
      ]
    }
  ], []);

  // Filter sections by search query
  const filteredSections = useMemo(() => {
    if (!searchQuery) return termsData;
    const query = searchQuery.toLowerCase();
    return termsData.filter(section => 
      section.title.toLowerCase().includes(query) ||
      section.content.some(line => line.toLowerCase().includes(query))
    );
  }, [searchQuery, termsData]);

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      const headerOffset = 100;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-black text-white pt-24 pb-20 px-4 sm:px-6 lg:px-8 selection:bg-gold selection:text-black">
      <SEO 
        title="Terms and Conditions"
        description="Review Merlux Chauffeuring Services agreement, booking instructions, cancellation guidelines, and wait policies governed by Victoria, Australia laws."
      />

      <div className="max-w-7xl mx-auto">
        {/* Dynamic header banner with luxury gold border styling */}
        <div className="text-center mb-12 sm:mb-16">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gold/10 border border-gold/20 text-gold text-xs font-mono tracking-wider mb-6"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-gold" />
            Terms of Service & Agreements
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl sm:text-5xl md:text-6xl font-black text-white font-display uppercase tracking-tight"
          >
            Terms and <span className="text-gold italic font-serif">Conditions</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-sm text-gray-400 max-w-xl mx-auto mt-4 font-sans"
          >
            Please review our system policies, chauffeur guidelines, luggage allocations, and payment protocols. Under Victoria, Australia rules, effective May 1, 2025.
          </motion.p>
        </div>

        {/* Floating search interactive bar */}
        <div className="max-w-2xl mx-auto mb-10">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search legal clauses (e.g. 'refund', 'cancellation', 'waiting time')..."
              className="w-full bg-stone-900/60 border border-white/10 focus:border-gold px-4 py-3.5 pl-12 pr-4 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-gold/30 transition-all placeholder:text-gray-500"
            />
            <Search className="w-4 h-4 text-gold absolute left-4 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        {/* Master layout panel */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Quick-Links Desktop Sidebar Table of Contents */}
          <div className="hidden lg:block lg:col-span-1 space-y-4">
            <div className="sticky top-28 bg-stone-900/40 p-5 rounded-2xl border border-white/5 space-y-4">
              <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                <FileText className="w-4 h-4 text-gold" />
                <span className="text-xs uppercase font-bold tracking-widest text-[#d4af37]">Sections</span>
              </div>
              
              <div className="h-full overflow-y-auto pr-1 space-y-1">
                {termsData.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => scrollToSection(section.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all flex items-center justify-between group ${
                      activeSection === section.id
                        ? 'bg-gold/15 text-gold border-l-2 border-gold font-bold pl-4'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span className="truncate">{section.title}</span>
                    <ChevronRight className={`w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity ${
                      activeSection === section.id ? 'opacity-100' : ''
                    }`} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Legal Contents Main Display Wrapper */}
          <div className="col-span-1 lg:col-span-3 space-y-6">
            <AnimatePresence mode="popLayout">
              {filteredSections.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="bg-stone-900/20 border border-white/5 p-12 text-center rounded-2xl"
                >
                  <p className="text-sm font-mono text-gray-500">No terms match your search query: "{searchQuery}"</p>
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="mt-4 px-4 py-2 border border-gold/40 hover:border-gold hover:bg-gold/10 text-gold rounded-xl text-xs font-mono transition-all"
                  >
                    Clear Filter
                  </button>
                </motion.div>
              ) : (
                filteredSections.map((section, index) => (
                  <motion.div
                    key={section.id}
                    id={section.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04 }}
                    className={`p-6 sm:p-8 rounded-2xl bg-stone-900/20 border transition-all ${
                      activeSection === section.id 
                        ? 'border-gold bg-gold/[0.02]' 
                        : 'border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-4 mb-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-gold px-2.5 py-0.5 rounded-full bg-gold/10 border border-gold/15">
                          {section.number}
                        </span>
                        <h2 className="text-lg sm:text-xl font-bold font-display text-white group-hover:text-gold transition-colors">
                          {section.title}
                        </h2>
                      </div>
                      
                      {/* Interactive Section Selector indicator */}
                      <button 
                        onClick={() => setActiveSection(section.id)}
                        className="text-[10px] uppercase font-mono text-gray-500 hover:text-gold transition-colors self-start sm:self-center"
                      >
                        {activeSection === section.id ? '● ACTIVE CLAUSE' : '⊙ SELECT'}
                      </button>
                    </div>

                    <div className="space-y-3 font-sans text-xs sm:text-sm text-gray-300 leading-relaxed">
                      {section.content.map((clause, indexClause) => {
                        const isBullet = clause.trim().startsWith('•');
                        return (
                          <p 
                            key={indexClause} 
                            className={`${isBullet ? 'pl-4 sm:pl-6 text-gold font-mono text-xs py-0.5' : ''}`}
                          >
                            {clause}
                          </p>
                        );
                      })}
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>

            {/* Quick Contact Legal Notice Helper */}
            <div className="p-6 rounded-2xl bg-gold/5 border border-gold/10 mt-8 font-mono text-xs text-center space-y-4">
              <p className="text-gray-300">
                Have questions or need clarification regarding these Terms & Conditions?
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-gold">
                <a href="/contact" className="hover:underline">Contact Customer Support →</a>
                <span className="hidden sm:inline text-white/20">|</span>
                <a href="/booking" className="hover:underline">Instant Luxury Booking →</a>
              </div>
            </div>
          </div>
        </div>

        {/* Back to top dynamic button */}
        <div className="flex justify-center mt-12">
          <button 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-2 px-4 py-2 border border-white/10 rounded-full text-xs text-gray-400 hover:text-gold hover:border-gold/50 transition-all font-mono"
          >
            <ArrowUp className="w-3.5 h-3.5" />
            Scroll back to top
          </button>
        </div>
      </div>
    </div>
  );
};

export default Terms;
