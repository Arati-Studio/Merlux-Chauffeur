import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ChevronDown, HelpCircle, MessageSquare, Search, CornerDownRight } from 'lucide-react';
import { cn } from '../lib/utils';
import SEO from '../components/SEO';
import { faqFallback } from '../data/fallback/faqFallback';

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  order: number;
}

const FAQPage: React.FC = () => {
  const [faqs, setFaqs] = useState<FAQ[]>(faqFallback);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>("faq_1");
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  useEffect(() => {
    const q = query(
      collection(db, 'faqs'),
      where('active', '==', true),
      orderBy('order', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const faqData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as FAQ[];
        setFaqs(faqData);
        if (faqData.length > 0 && (!activeId || !faqData.some(f => f.id === activeId))) {
          setActiveId(faqData[0].id);
        }
      } else {
        setFaqs(faqFallback);
      }
      setLoading(false);
    }, (error) => {
      console.warn("Using offline FAQ fallback dataset due to database subscription error:", error);
      setFaqs(faqFallback);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const categories = ['All', ...Array.from(new Set(faqs.map(f => f.category || 'General')))];

  const filteredFaqs = faqs.filter(faq => {
    const matchesSearch = faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || (faq.category || 'General') === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // FAQ Schema for SEO
  const schemaData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": typeof window !== 'undefined' ? window.location.href : ''
    },
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };

  return (
    <div className="min-h-screen pt-20 pb-20 px-6">
      <SEO 
        title="Frequently Asked Questions"
        description="Find answers to common questions about Merlux Chauffeur services, bookings, luxury fleet, and travel arrangements in Melbourne."
        schema={schemaData}
      />

      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gold/10 border border-gold/20 text-gold text-xs font-bold uppercase tracking-widest mb-6"
          >
            <HelpCircle className="w-4 h-4" />
            Support Center
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl font-black text-white mb-6"
          >
            Frequently Asked <span className="text-gold italic">Questions</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-white/60 text-sm max-w-xl mx-auto mb-12"
          >
            Everything you need to know about Merlux Chauffeur services, bookings, and luxury travel.
          </motion.p>

          <div className="max-full mx-auto mb-12">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

              {/* Mobile & Tablet: Search + Dropdown inline */}
              <div className="flex items-center gap-2 w-full md:w-1/3">

                {/* Search Input */}
                <div className="relative group flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-gold transition-colors" />
                  <input
                    type="text"
                    placeholder="Search your question..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-10 bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-gold/50 focus:bg-white/[0.08] transition-all"
                  />
                </div>

                {/* Mobile & Tablet Dropdown */}
                <div className="flex md:hidden relative flex-shrink-0 w-full max-w-[160px]">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="custom-select appearance-none h-10 rounded-xl pl-3 pr-8 text-xs font-bold uppercase tracking-widest text-gold bg-white/5 border border-white/10 focus:outline-none focus:border-gold/50 transition-all cursor-pointer"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

              </div>

              {/* Desktop Pills */}
              <div className="hidden md:flex items-center gap-2 flex-wrap justify-end">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={cn(
                      "px-4 py-2 rounded-xl text-sm font-bold border transition-all whitespace-nowrap",
                      selectedCategory === cat
                        ? "bg-gold border-gold text-black"
                        : "bg-white/5 border-white/10 text-white/40 hover:border-gold/30 hover:text-white"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>

            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center p-20">
            <div className="w-10 h-10 border-4 border-gold/20 border-t-gold rounded-full animate-spin" />
          </div>
        ) : filteredFaqs.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {filteredFaqs.map((faq, idx) => (
              <motion.div
                key={faq.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={cn(
                  "glass rounded-xl border transition-all duration-300 overflow-hidden",
                  activeId === faq.id
                    ? "border-gold/50 shadow-[0_0_30px_rgba(212,175,55,0.1)] bg-white/[0.03]"
                    : "border-white/5 hover:border-white/10"
                )}
              >
                <button
                  onClick={() => setActiveId(activeId === faq.id ? null : faq.id)}
                  className="w-full px-4 py-4 text-left flex items-baseline justify-between gap-4"
                >
                  {/* Number + Question baseline aligned */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-sm font-black text-gold/70 flex-shrink-0 leading-none">
                      {(idx + 1).toString().padStart(2, '0')}.
                    </span>
                    <span className="text-base font-bold text-white leading-snug">
                      {faq.question}
                    </span>
                  </div>

                  {/* Chevron — align center vertically, not baseline */}
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center bg-white/5 flex-shrink-0 self-center transition-transform duration-300",
                    activeId === faq.id ? "rotate-180 bg-gold/20 text-gold" : "text-white/40"
                  )}>
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </button>

                <AnimatePresence>
                  {activeId === faq.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      {/* Answer indented to align with question text (num width ~20px + gap 12px = 32px) */}
                      <div className="px-4 pb-4 pl-[3.25rem]">
                        <div className="h-px w-full bg-white/5 mb-3" />
                        <div className="flex items-start gap-3">
                          <CornerDownRight className="w-4 h-4 text-gold/70 flex-shrink-0 mt-0.5" />
                          <p className="text-white/65 text-sm leading-relaxed">
                            {faq.answer}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 glass rounded-3xl border border-white/5 max-w-4xl mx-auto">
            <p className="text-white/40 italic">No FAQs available for this criteria.</p>
          </div>
        )}


        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="mt-20 p-8 glass rounded-3xl border border-white/5 text-center relative overflow-hidden group"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-gold to-transparent opacity-30" />
          <MessageSquare className="w-12 h-12 text-gold mx-auto mb-6 opacity-50 group-hover:scale-110 transition-transform" />
          <h2 className="text-2xl font-bold text-white mb-4 uppercase tracking-tight">Still have questions?</h2>
          <p className="text-white/60 mb-8 max-w-md mx-auto">
            Our Assistant team is available 24/7 to assist you with any inquiries or custom travel requirements.
          </p>
          <a
            href="/contact"
            className="inline-flex items-center gap-3 px-8 py-4 rounded-full bg-gold text-black font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-[0_10px_20px_rgba(212,175,55,0.2)]"
          >
            Contact Assistant
          </a>
        </motion.div>
      </div>
    </div>
  );
};

export default FAQPage;
