import { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Phone, MapPin, Send, Clock, Globe, MessageSquare, Loader2, CheckCircle2 } from 'lucide-react';
import { useSettings } from '../lib/SettingsContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import SEO from '../components/SEO';

export default function Contact() {
  const { settings } = useSettings();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });

  const contact = settings?.contact || {
    address: 'Collins Street, Melbourne VIC 3000, Australia',
    phone: '+61 3 0000 0000',
    email: 'bookings@merlux.com.au',
    bookingEmail: 'bookings@merlux.com.au',
    lat: '-37.8172',
    lng: '144.9625'
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Save to Firestore (messages collection - visible in the Admin Dashboard under "Inquiries")
      await addDoc(collection(db, 'messages'), {
        ...formData,
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
            
            <h3 style="color: #09090b; font-size: 18px; margin-top: 0; font-weight: 600;">New Inquiry Form Submission</h3>
            
            <div style="background-color: #f4f4f5; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr>
                  <td style="padding: 6px 0; color: #71717a; width: 30%; font-weight: 600;">Client Name:</td>
                  <td style="padding: 6px 0; color: #09090b; font-weight: bold;">${formData.name}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #71717a; font-weight: 600;">Client Email:</td>
                  <td style="padding: 6px 0; color: #dab866; font-weight: bold;"><a href="mailto:${formData.email}" style="color: #dab866; text-decoration: none;">${formData.email}</a></td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #71717a; font-weight: 600;">Subject:</td>
                  <td style="padding: 6px 0; color: #09090b;">${formData.subject}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #71717a; font-weight: 600;">Received:</td>
                  <td style="padding: 6px 0; color: #09090b;">${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Melbourne' })} AEST</td>
                </tr>
              </table>
            </div>
            
            <div style="border-left: 4px solid #dab866; padding-left: 15px; margin: 20px 0;">
              <h4 style="margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #71717a;">Message Content</h4>
              <p style="margin: 0; line-height: 1.6; font-size: 14px; white-space: pre-wrap; color: #27272a;">${formData.message}</p>
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
            
            <h3 style="color: #09090b; font-size: 18px; margin-top: 0; font-weight: normal; line-height: 1.4;">Hello <strong>${formData.name}</strong>,</h3>
            
            <p style="font-size: 14px; line-height: 1.6; color: #27272a;">Thank you for getting in touch with Merlux. We have successfully received your inquiry regarding <strong>"${formData.subject}"</strong>.</p>
            <p style="font-size: 14px; line-height: 1.6; color: #27272a;">Our dedicated 24/7 concierge desk is presently reviewing your message. A luxury travel specialist will compile the requested arrangements and contact you shortly.</p>
            
            <div style="border-left: 4px solid #dab866; padding-left: 15px; margin: 25px 0; background-color: #fafafa; padding: 15px; border-radius: 4px;">
              <h4 style="margin: 0 0 8px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #dab866; font-weight: bold;">Summary of Inquiry</h4>
              <p style="margin: 0; line-height: 1.6; font-size: 13px; white-space: pre-wrap; color: #4b5563;">${formData.message}</p>
            </div>
            
            <p style="font-size: 14px; line-height: 1.6; color: #27272a;">Should you require instantaneous assistance, please do not hesitate to contact our reservation hotline directly.</p>
            
            <div style="margin-top: 35px; border-top: 1px solid #e4e4e7; padding-top: 20px; text-align: center; font-size: 12px; color: #71717a;">
              <p style="margin: 0 0 5px 0; font-weight: bold; color: #09090b;">Merlux Chauffeurs Team</p>
              <p style="margin: 0;">Hotline: <a href="tel:${contact.phone}" style="color: #dab866; text-decoration: none;">${contact.phone}</a> &bull; Email: <a href="mailto:${targetEmail}" style="color: #dab866; text-decoration: none;">${targetEmail}</a></p>
            </div>
          </div>
        `;

        // Send to contact email (from system settings)
        await emailService.sendEmail(targetEmail, `[Inquiry Recieved]: ${formData.subject}`, adminEmailHtml);

        // Send confirmation receipt copy to the client
        await emailService.sendEmail(formData.email, `Inquiry Received: "${formData.subject}"`, customerReceiptHtml);
      } catch (mailErr) {
        console.error('Email notification failed but Firestore write succeeded:', mailErr);
      }

      setSuccess(true);
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message. Please try again later.');
      handleFirestoreError(err, OperationType.CREATE, 'messages');
    } finally {
      setLoading(false);
    }
  };

  const mapUrl = contact.lat && contact.lng 
    ? `https://www.google.com/maps/embed/v1/place?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&q=${contact.lat},${contact.lng}`
    : "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1575.7640321200057!2d144.96253457121695!3d-37.817208479749174!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x6ad642b4aaaaaaab%3A0x67dbb94541cd6402!2sCollins%20St%2C%20Melbourne%20VIC!5e0!3m2!1sen!2sau!4v1700000000000!5m2!1sen!2sau";

  return (
    <div className="bg-black min-h-screen text-white font-sans overflow-x-hidden">
      <SEO 
        title="Contact Our Concierge Team"
        description="Get in touch with Merlux Chauffeur Services. Our dedicated 24/7 concierge team is ready to assist with your luxury travel arrangements in Melbourne."
      />
      {/* Hero Header */}
      <section className="pt-16 pb-20 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <motion.span 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-gold uppercase tracking-[0.4em] text-xs font-bold mb-4 block"
          >
            Assistance Support
          </motion.span>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-6xl font-display leading-tight"
          >
            How Can We <span className="text-gold italic">Assist</span> You?
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-white/40 max-w-xl mx-auto mt-4 font-light text-lg"
          >
            Our dedicated concierge team is available 24/7 to arrange your travel requirements and ensure a flawless experience.
          </motion.p>
        </div>
      </section>

      <section className="py-24 max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          
          {/* Contact Information */}
          <div className="lg:col-span-5 space-y-12">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-10"
            >
              <div>
                <h3 className="text-2xl font-display mb-6 border-b border-white/10 pb-4 inline-block">Direct Contact</h3>
                <div className="space-y-8">
                  <div className="flex items-start gap-6 group">
                    <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-full flex items-center justify-center shrink-0 group-hover:border-gold transition-colors duration-500">
                      <Phone className="text-gold" size={20} />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-widest text-white/40 block mb-1">Reservation Hotline</span>
                      <a href={`tel:${contact.phone.replace(/\s+/g, '')}`} className="text-xl font-bold hover:text-gold transition-colors">
                        {contact.phone}
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-6 group">
                    <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-full flex items-center justify-center shrink-0 group-hover:border-gold transition-colors duration-500">
                      <Mail className="text-gold" size={20} />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-widest text-white/40 block mb-1">Email Correspondence</span>
                      <a href={`mailto:${contact.bookingEmail || contact.email}`} className="text-xl font-bold hover:text-gold transition-colors">
                        {contact.bookingEmail || contact.email}
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-2xl font-display mb-6 border-b border-white/10 pb-4 inline-block">Headquarters</h3>
                <div className="flex items-start gap-6 group">
                  <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-full flex items-center justify-center shrink-0 group-hover:border-gold transition-colors duration-500">
                    <MapPin className="text-gold" size={20} />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-widest text-white/40 block mb-1">Melbourne Office</span>
                    <p className="text-lg leading-relaxed text-white/80">
                      {contact.address}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 pt-12">
                <div className="glass p-6 border-gold/10 rounded-md">
                  <Clock className="text-gold mb-4" size={24} />
                  <h4 className="text-sm font-bold uppercase tracking-widest mb-2">Availability</h4>
                  <p className="text-white/40 text-xs">Available 24 hours a day, 7 days a week for urgent bookings.</p>
                </div>
                <div className="glass p-6 border-gold/10 rounded-md">
                  <Globe className="text-gold mb-4" size={24} />
                  <h4 className="text-sm font-bold uppercase tracking-widest mb-2">Global Coverage</h4>
                  <p className="text-white/40 text-xs">Facilitating luxury transfers across Melbourne and regional Victoria.</p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-7">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="glass p-4 md:p-10 relative overflow-hidden rounded-md"
            >
              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-10">
                  <MessageSquare className="text-gold" size={24} />
                  <h3 className="text-3xl font-display">Inquiry Form</h3>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                  {success ? (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-gold/10 border border-gold/20 rounded-xl p-8 text-center space-y-4"
                    >
                      <CheckCircle2 className="w-12 h-12 text-gold mx-auto" />
                      <h4 className="text-xl font-display text-white">Message Sent Successfully</h4>
                      <p className="text-white/60 text-sm">Thank you for reaching out. Our concierge team will contact you shortly.</p>
                      <button 
                        type="button"
                        onClick={() => setSuccess(false)}
                        className="text-gold text-[10px] uppercase tracking-widest font-bold pt-4"
                      >
                        Send Another Inquiry
                      </button>
                    </motion.div>
                  ) : (
                    <>
                      {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs p-4 rounded-lg">
                          {error}
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                          <label className="text-[10px] uppercase tracking-widest text-gold font-bold ml-1">Your Full Name</label>
                          <input 
                            required
                            type="text" 
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full bg-white/[0.03] border-b border-white/10 py-4 px-4 focus:border-gold outline-none transition-all placeholder:text-white/10 rounded-sm" 
                            placeholder="Johnathan Doe" 
                          />
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] uppercase tracking-widest text-gold font-bold ml-1">Email Address</label>
                          <input 
                            required
                            type="email" 
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full bg-white/[0.03] border-b border-white/10 py-4 px-4 focus:border-gold outline-none transition-all placeholder:text-white/10 rounded-sm" 
                            placeholder="john@example.com" 
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-[10px] uppercase tracking-widest text-gold font-bold ml-1">Subject of Inquiry</label>
                        <input 
                          required
                          type="text" 
                          value={formData.subject}
                          onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                          className="w-full bg-white/[0.03] border-b border-white/10 py-4 px-4 focus:border-gold outline-none transition-all placeholder:text-white/10 rounded-sm" 
                          placeholder="Corporate Travel Arrangement" 
                        />
                      </div>

                      <div className="space-y-3">
                        <label className="text-[10px] uppercase tracking-widest text-gold font-bold ml-1">Message</label>
                        <textarea 
                          required
                          rows={5} 
                          value={formData.message}
                          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                          className="w-full bg-white/[0.03] border border-white/10 py-4 px-4 focus:border-gold outline-none transition-all resize-none placeholder:text-white/10 rounded-sm" 
                          placeholder="Please describe your requirements in detail..."
                        ></textarea>
                      </div>

                      <button 
                        disabled={loading}
                        className="w-full bg-gold text-black py-6 rounded-sm font-bold uppercase tracking-[0.3em] text-[10px] hover:bg-white transition-all duration-700 flex items-center justify-center gap-4 group disabled:opacity-50"
                      >
                        {loading ? (
                          <Loader2 className="animate-spin" size={16} />
                        ) : (
                          <>
                            Submit Inquiry <Send size={16} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                          </>
                        )}
                      </button>
                    </>
                  )}
                </form>
              </div>

              {/* Decorative background element */}
              <div className="absolute top-0 right-0 p-12 opacity-3 pointer-events-none">
                <Send size={100} />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="h-[400px] w-full border-t border-b border-white/10 relative overflow-hidden">
        <iframe
          src={mapUrl}
          width="100%"
          height="100%"
          style={{ border: 0 }}
          allowFullScreen={true}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title="Merlux Melbourne Office"
        ></iframe>
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black via-transparent to-black opacity-60" />
      </section>
    </div>
  );
}
