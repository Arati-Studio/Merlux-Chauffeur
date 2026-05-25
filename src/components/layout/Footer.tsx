import { Link } from 'react-router-dom';
import { Facebook, Instagram, Linkedin, Mail, Phone, MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import Logo from './Logo';
import { useSettings } from '../../lib/SettingsContext';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

export default function Footer() {
  const { settings } = useSettings();
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const contact = settings?.contact || {
    address: 'Collins Street, Melbourne VIC 3000, Australia',
    phone: '+61 3 0000 0000',
    email: 'bookings@merlux.com.au',
    bookingEmail: 'bookings@merlux.com.au'
  };

  const footerActive = settings?.menus?.footerActive;
  const servicesActive = settings?.menus?.servicesActive;

  const footerMenu = footerActive && settings?.menus?.footer && settings.menus.footer.length > 0
    ? settings.menus.footer
    : [
        { label: 'Home', url: '/' },
        { label: 'Fleet', url: '/fleet' },
        { label: 'Services', url: '/services' },
        { label: 'About Us', url: '/about' },
        { label: 'Contact', url: '/contact' },
        { label: 'Blog', url: '/blog' }
      ];

  const servicesMenu = servicesActive && settings?.menus?.services && settings.menus.services.length > 0
    ? settings.menus.services
    : [
        { label: 'Airport Transfers', url: '/services' },
        { label: 'Corporate Travel', url: '/services' },
        { label: 'Wedding Chauffeur', url: '/services' },
        { label: 'Private Tours', url: '/services' },
        { label: 'Event Transfers', url: '/services' },
        { label: 'Hourly Hire', url: '/services' }
      ];

  return (
    <footer className="bg-black border-t border-white/5 pt-20">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-12 mb-10">
          <div className="col-span-1 md:col-span-2">
            <Logo variant="footer" className="mb-6" />
            <p className="text-white/50 text-sm leading-relaxed mb-6">
              Melbourne's premier chauffeur service, dedicated to providing unparalleled luxury, safety, and punctuality for every journey.
            </p>
            <div className="flex gap-4">
              {[Facebook, Instagram, Linkedin].map((Icon, i) => (
                <a key={i} href="#" className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center hover:bg-gold hover:text-black transition-all">
                  <Icon size={18} />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-gold uppercase tracking-widest text-xs font-bold mb-6">Quick Links</h4>
            <ul className="flex flex-col gap-4">
              {footerMenu.map((item: any, idx: number) => {
                const label = item.label;
                const path = item.url;
                const subItems = item.items || [];
                const isExpanded = expandedItems[`footer-${idx}`];
                
                return (
                  <li key={`${label}-${idx}`} className="space-y-3">
                    <div className="flex items-center gap-3 group">
                      <Link to={path || '#'} className="text-white/60 hover:text-gold text-sm transition-colors">
                        {label}
                      </Link>
                      {subItems.length > 0 && (
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            toggleExpand(`footer-${idx}`);
                          }}
                          className="text-white/20 hover:text-gold p-1 transition-colors"
                        >
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      )}
                    </div>
                    
                    <AnimatePresence>
                      {isExpanded && subItems.length > 0 && (
                        <motion.ul 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden flex flex-col gap-2 pl-4 border-l border-white/10 ml-1"
                        >
                          {subItems.map((sub: any, sIdx: number) => (
                            <li key={`${label}-sub-${sIdx}`}>
                              <Link to={sub.url} className="text-white/40 hover:text-gold text-xs transition-colors block py-1">
                                {sub.label}
                              </Link>
                            </li>
                          ))}
                        </motion.ul>
                      )}
                    </AnimatePresence>
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <h4 className="text-gold uppercase tracking-widest text-xs font-bold mb-6">Services</h4>
            <ul className="flex flex-col gap-4">
              {servicesMenu.map((item: any, idx: number) => {
                const label = item.label;
                const path = item.url;
                const subItems = item.items || [];
                const isExpanded = expandedItems[`services-${idx}`];

                return (
                  <li key={`svc-${idx}`} className="space-y-3">
                    <div className="flex items-center gap-3 group">
                      <Link to={path || '/services'} className="text-white/60 hover:text-gold text-sm transition-colors">
                        {label}
                      </Link>
                      {subItems.length > 0 && (
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            toggleExpand(`services-${idx}`);
                          }}
                          className="text-white/20 hover:text-gold p-1 transition-colors"
                        >
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      )}
                    </div>

                    <AnimatePresence>
                      {isExpanded && subItems.length > 0 && (
                        <motion.ul 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden flex flex-col gap-2 pl-4 border-l border-white/10 ml-1"
                        >
                          {subItems.map((sub: any, sIdx: number) => (
                            <li key={`svc-sub-${idx}-${sIdx}`}>
                              <Link to={sub.url} className="text-white/40 hover:text-gold text-xs transition-colors block py-1">
                                {sub.label}
                              </Link>
                            </li>
                          ))}
                        </motion.ul>
                      )}
                    </AnimatePresence>
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <h4 className="text-gold uppercase tracking-widest text-xs font-bold mb-6">Contact Us</h4>
            <ul className="flex flex-col gap-4">
              <li className="flex items-start gap-3 text-white/60 text-sm">
                <MapPin size={18} className="text-gold shrink-0" />
                <span>{contact.address}</span>
              </li>
              <li className="flex items-center gap-3 text-white/60 text-sm">
                <Phone size={18} className="text-gold shrink-0" />
                <span>{contact.phone}</span>
              </li>
              <li className="flex items-center gap-3 text-white/60 text-sm">
                <Mail size={18} className="text-gold shrink-0" />
                <span>{contact.bookingEmail || contact.email}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/5 p-4 flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-white/30 text-xs">
            © {new Date().getFullYear()} Merlux Chauffeur Services. All rights reserved.
          </p>
          <div className="flex gap-8">
            <a href="#" className="text-white/30 hover:text-white text-xs transition-colors">Privacy Policy</a>
            <a href="#" className="text-white/30 hover:text-white text-xs transition-colors">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
