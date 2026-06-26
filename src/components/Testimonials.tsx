import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Star, Quote, Loader2, ArrowRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import LazyImage from './LazyImage';

interface Testimonial {
  id: string | number;
  name: string;
  role: string;
  company?: string;
  quote: string;
  rating: number;
  image: string;
  navigatePath?: string;
}

const STATIC_TESTIMONIALS: Testimonial[] = [
  {
    id: 1,
    name: "Eleanor Sterling",
    role: "Private Client & Executive Coordinator",
    company: "Sotheby's Melbourne",
    quote: "The service provided by Merlux is simply flawless. From the booking desk to the absolute professionalism of the chauffeur, every aspect has been meticulously elevated to set the ultimate gold standard of private luxury travel.",
    rating: 5,
    image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=600&auto=format&fit=crop"
  },
  {
    id: 2,
    name: "Alexander Vance",
    role: "Managing Director",
    company: "Apex Global Capital",
    quote: "As frequent corporate travelers, punctuality and presentation are everything. Merlux delivers an uncompromising, elite experience with their pristine fleet of luxury vehicles and highly trained professional chauffeurs.",
    rating: 5,
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=600&auto=format&fit=crop"
  },
  {
    id: 3,
    name: "Marcus & Olivia Thorne",
    role: "Bespoke Winery Tour Clients",
    company: "Yarra Valley Private Tour",
    quote: "We curated a private tour of the Yarra Valley wineries with Merlux. Our chauffeur had exceptional local knowledge, guided us through exclusive tastings, and treated us with utmost care throughout the memorable journey.",
    rating: 5,
    image: "https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?q=80&w=600&auto=format&fit=crop"
  }
];

const PREMIUM_AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=300&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=300&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=300&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=300&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=300&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=300&auto=format&fit=crop"
];

const PREMIUM_CAR_IMAGES = [
  "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?q=80&w=600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1617531653332-bd46c24f2068?q=80&w=600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?q=80&w=600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?q=80&w=600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1563720223185-11003d516935?q=80&w=600&auto=format&fit=crop"
];

export default function Testimonials() {
  const navigate = useNavigate();
  const [testimonials, setTestimonials] = useState<Testimonial[]>(STATIC_TESTIMONIALS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFeedbackAndComments = async () => {
      try {
        const dynamicList: Testimonial[] = [];
        let avatarIndex = 0;

        // 1. Fetch blogs to map doc ID to slug, title, and featured image
        const blogsMap = new Map<string, { slug: string; title: string; image?: string }>();
        try {
          const blogsSnap = await getDocs(collection(db, 'blogs'));
          blogsSnap.forEach((doc) => {
            const d = doc.data();
            if (d.slug) {
              blogsMap.set(doc.id, {
                slug: d.slug,
                title: d.title || d.name || 'Blog Post',
                image: d.image || d.img || d.featuredImage || d.thumbnail
              });
            }
          });
        } catch (err) {
          console.error('Error fetching blogs mapping:', err);
        }

        // 2. Fetch pages to map doc ID to slug, title, and image
        const pagesMap = new Map<string, { slug: string; title: string; image?: string }>();
        try {
          const pagesSnap = await getDocs(collection(db, 'pages'));
          pagesSnap.forEach((doc) => {
            const d = doc.data();
            if (d.slug) {
              pagesMap.set(doc.id, {
                slug: d.slug,
                title: d.title || d.name || 'Page',
                image: d.image || d.img || d.featuredImage || d.backgroundImage
              });
            }
          });
        } catch (err) {
          console.error('Error fetching pages mapping:', err);
        }

        // 3. Fetch comments collection
        try {
          const commentsSnap = await getDocs(collection(db, 'comments'));
          commentsSnap.forEach((doc) => {
            const data = doc.data();
            const content = data.content || data.message;
            if (content && content.trim().length > 6) {
              // Determine navigation path, discussion details, and discussion image
              let navigatePath: string | undefined = undefined;
              let discussLabel = 'Guest Discussion';
              let fallbackImage: string | undefined = undefined;
              
              if (data.targetType === 'blog') {
                const blogInfo = blogsMap.get(data.targetId);
                if (blogInfo) {
                  navigatePath = `/blog/${blogInfo.slug}`;
                  discussLabel = `Discussing: ${blogInfo.title}`;
                  fallbackImage = blogInfo.image;
                } else {
                  navigatePath = `/blog/${data.targetId}`;
                  discussLabel = 'Blog Discussion';
                }
              } else if (data.targetType === 'page') {
                const pageInfo = pagesMap.get(data.targetId);
                if (pageInfo) {
                  navigatePath = `/${pageInfo.slug}`;
                  discussLabel = `Discussing: ${pageInfo.title}`;
                  fallbackImage = pageInfo.image;
                } else {
                  navigatePath = `/${data.targetId}`;
                  discussLabel = 'Page Discussion';
                }
              }

              // Use authorAvatar first. If empty, try using the discussion page/blog image. If still empty, fall back to a preset premium avatar
              const avatar = data.authorAvatar || fallbackImage || PREMIUM_AVATARS[avatarIndex % PREMIUM_AVATARS.length];
              avatarIndex++;

              dynamicList.push({
                id: `comment-${doc.id}`,
                name: data.authorName || 'Verified Guest',
                role: data.targetType ? `${data.targetType.toUpperCase()} Reader` : 'Merlux Traveler',
                company: discussLabel,
                quote: content.trim(),
                rating: 5,
                image: avatar,
                navigatePath
              });
            }
          });
        } catch (err) {
          console.error('Error loading comments for testimonials:', err);
        }

        // 4. Fetch bookings collection (looking for feedback or ratingComment)
        try {
          const bookingsSnap = await getDocs(collection(db, 'bookings'));
          let carImageIndex = 0;
          bookingsSnap.forEach((doc) => {
            const data = doc.data();
            const feedbackText = data.feedback || data.ratingComment;
            if (feedbackText && feedbackText.trim().length > 6) {
              const ratingVal = typeof data.rating === 'number' ? data.rating : (typeof data.ratingValue === 'number' ? data.ratingValue : 5);
              const clientName = data.passengerName || data.name || 'Private Client';
              const routeRole = data.serviceType ? `${data.serviceType.charAt(0).toUpperCase() + data.serviceType.slice(1)} Guest` : 'Elite Passenger';
              const avatar = PREMIUM_CAR_IMAGES[carImageIndex % PREMIUM_CAR_IMAGES.length];
              carImageIndex++;

              dynamicList.push({
                id: `booking-${doc.id}`,
                name: clientName,
                role: routeRole,
                company: data.pickup ? `Journey: ${data.pickup.split(',')[0]} to ${data.dropoff ? data.dropoff.split(',')[0] : 'Melbourne'}` : 'Chauffeur Review',
                quote: feedbackText.trim(),
                rating: ratingVal,
                image: avatar
                // No navigatePath for booking reviews!
              });
            }
          });
        } catch (err) {
          console.error('Error loading booking feedback for testimonials:', err);
        }

        // If there are actual dynamic entries fetched, show those ONLY. Otherwise, fall back to STATIC_TESTIMONIALS
        if (dynamicList.length > 0) {
          setTestimonials(dynamicList);
        } else {
          setTestimonials(STATIC_TESTIMONIALS);
        }
      } catch (globalErr) {
        console.error('Failed to compile client testimonials:', globalErr);
      } finally {
        setLoading(false);
      }
    };

    loadFeedbackAndComments();
  }, []);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  };

  const currentTestimonial = testimonials[currentIndex];

  return (
    <section className="py-24 bg-gradient-to-b from-[#050505] to-black relative overflow-hidden">
      {/* Dynamic ambient gold decorative background circles */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[500px] h-[500px] bg-gold/5 rounded-full blur-[150px] pointer-events-none" />
      
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <span className="text-gold uppercase tracking-[0.3em] text-[10px] md:text-xs font-bold mb-4 block">The Voice of Distinction</span>
            <h2 className="text-3xl sm:text-5xl lg:text-6xl font-display text-white">Client <span className="text-gold italic">Testimonials</span></h2>
          </motion.div>
        </div>

        {/* Carousel Container */}
        <div className="max-w-4xl mx-auto relative min-h-[480px] md:min-h-[380px] flex items-center justify-center">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-white/50">
              <Loader2 className="animate-spin text-gold" size={28} />
              <p className="text-xs uppercase tracking-widest font-mono">Curating Experiences...</p>
            </div>
          ) : (
            <>
               <AnimatePresence mode="wait">
                <motion.div
                  key={currentIndex}
                  initial={{ opacity: 0, scale: 0.98, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98, y: -15 }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  onClick={() => {
                    if (currentTestimonial?.navigatePath) {
                      navigate(currentTestimonial.navigatePath);
                    }
                  }}
                  className={cn(
                    "w-full grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 items-center bg-white/[0.02] border border-white/10 rounded-[3rem] p-8 md:p-12 relative overflow-hidden backdrop-blur-md transition-all duration-500",
                    currentTestimonial?.navigatePath ? "hover:border-gold/30 hover:bg-white/[0.03] cursor-pointer" : ""
                  )}
                >
                  {/* Giant elegant background quotation mark */}
                  <div className="absolute right-10 top-10 text-white/[0.02] pointer-events-none">
                    <Quote size={180} strokeWidth={1} />
                  </div>

                  {/* Reviewer Image */}
                  <div className="col-span-1 md:col-span-4 flex justify-center">
                    <div className="w-32 h-32 md:w-44 md:h-44 rounded-full overflow-hidden border-2 border-gold/40 relative shadow-2xl p-1 bg-black shrink-0">
                      <div className="w-full h-full rounded-full overflow-hidden relative">
                        <LazyImage 
                          src={currentTestimonial?.image || PREMIUM_AVATARS[0]} 
                          alt={currentTestimonial?.name || 'Client'}
                          className="object-cover"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Reviewer Content */}
                  <div className="col-span-1 md:col-span-8 flex flex-col justify-center text-center md:text-left relative z-10">
                    {/* Top Row: Stars & View Discussion Button */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                      {/* Stars */}
                      <div className="flex items-center justify-center md:justify-start gap-1.5">
                        {[...Array(currentTestimonial?.rating || 5)].map((_, i) => (
                          <Star key={i} size={14} className="text-gold fill-gold" />
                        ))}
                      </div>

                      {/* Interactive View Page/Blog Action */}
                      {currentTestimonial?.navigatePath && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(currentTestimonial.navigatePath!);
                          }}
                          className="self-center sm:self-auto inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gold text-black hover:bg-white text-[10px] font-bold uppercase tracking-widest transition-all duration-300 shadow-lg shadow-gold/10 cursor-pointer"
                        >
                          <span>View Discussion</span>
                          <ArrowRight size={12} />
                        </button>
                      )}
                    </div>

                    {/* Quote */}
                    <blockquote className="text-base md:text-lg lg:text-xl text-white/80 leading-relaxed font-sans italic font-light mb-8 select-none">
                      "{currentTestimonial?.quote}"
                    </blockquote>

                    {/* Author Info */}
                    <div>
                      <h4 className="text-lg md:text-xl font-display text-white mb-1 tracking-wide">
                        {currentTestimonial?.name}
                      </h4>
                      <p className="text-[10px] md:text-xs uppercase tracking-widest text-gold font-bold">
                        {currentTestimonial?.role}
                        {currentTestimonial?.company && (
                          <span className="text-white/40 block md:inline md:before:content-['•'] md:before:mx-2 font-mono">
                            {currentTestimonial?.company}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Navigation Controls */}
              <div className="absolute -left-4 md:-left-16 top-1/2 -translate-y-1/2 z-10">
                <button
                  onClick={handlePrev}
                  className="w-10 h-10 md:w-12 md:h-12 rounded-full border border-white/15 bg-black/60 backdrop-blur-md flex items-center justify-center text-white/70 hover:text-gold hover:border-gold/40 hover:bg-black transition-all cursor-pointer shadow-lg"
                  title="Previous Testimonial"
                >
                  <ChevronLeft size={20} />
                </button>
              </div>
              <div className="absolute -right-4 md:-right-16 top-1/2 -translate-y-1/2 z-10">
                <button
                  onClick={handleNext}
                  className="w-10 h-10 md:w-12 md:h-12 rounded-full border border-white/15 bg-black/60 backdrop-blur-md flex items-center justify-center text-white/70 hover:text-gold hover:border-gold/40 hover:bg-black transition-all cursor-pointer shadow-lg"
                  title="Next Testimonial"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Bullet Indicators */}
        {!loading && testimonials.length > 1 && (
          <div className="flex justify-center items-center gap-3 mt-10">
            {testimonials.map((_, idx) => (
              <button
                key={`indicator-${idx}`}
                onClick={() => {
                  setCurrentIndex(idx);
                }}
                className={cn(
                  "h-1.5 transition-all duration-500 rounded-full cursor-pointer",
                  currentIndex === idx ? "w-12 bg-gold" : "w-2.5 bg-white/20 hover:bg-white/40"
                )}
                title={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
