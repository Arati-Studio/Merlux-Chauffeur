import { useState, useMemo, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { 
  Plus, Upload, Search, CircleX, Check, CheckCheck, XCircle, Car, ChevronDown,
  CheckCircle, Ban, Copy, Trash2, LayoutGrid, List, SquareCheck, 
  Square, Edit2, Clock, X, DollarSign, Info, MapPin, Tag, Save,
  Plus as PlusIcon, Trash2 as TrashIcon, Info as InfoIcon,
  LayoutGrid as LayoutGridIcon, RefreshCw, Download
} from 'lucide-react';
import { cn, getAssetPath } from '../../lib/utils';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, setDoc, query, onSnapshot, orderBy } from 'firebase/firestore';

interface OffersToursTabProps {
  isAdmin: boolean;
  showDashboardNotice: (type: 'success' | 'error' | 'warning' | 'info', message: string, title?: string) => void;
  setConfirmDelete: (config: any) => void;
}

const OffersToursTab: React.FC<OffersToursTabProps> = ({
  isAdmin,
  showDashboardNotice,
  setConfirmDelete,
}) => {
  const [offers, setOffers] = useState<any[]>([]);
  const [tours, setTours] = useState<any[]>([]);
  const [fleet, setFleet] = useState<any[]>([]);
  const [showCsvImportModal, setShowCsvImportModal] = useState(false);
  const [csvImportType, setCsvImportType] = useState<'offers' | 'tours'>('offers');

  useEffect(() => {
    const unsubscribeOffers = onSnapshot(collection(db, 'offers'), (snapshot) => {
      setOffers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubscribeTours = onSnapshot(collection(db, 'tours'), (snapshot) => {
      setTours(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubscribeFleet = onSnapshot(query(collection(db, 'fleet'), orderBy('name', 'asc')), (snapshot) => {
      setFleet(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeOffers();
      unsubscribeTours();
      unsubscribeFleet();
    };
  }, []);
  const [dragActive, setDragActive] = useState(false);
  const [isUploadingCsv, setIsUploadingCsv] = useState(false);

  const handleCsvUpload = async (type: 'offers' | 'tours', file: File) => {
    setIsUploadingCsv(true);
    try {
      // CSV Upload logic here
      console.log(`Importing ${type} CSV:`, file.name);
      showDashboardNotice('success', `${type.charAt(0).toUpperCase() + type.slice(1)} bulk import successful`, 'Import Complete');
      setShowCsvImportModal(false);
    } catch (err) {
      console.error(err);
      showDashboardNotice('error', 'CSV import failed. Please check format.', 'Import Error');
    } finally {
      setIsUploadingCsv(false);
    }
  };
  const [editingOffer, setEditingOffer] = useState<any>(null);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [editingTour, setEditingTour] = useState<any>(null);
  const [showTourModal, setShowTourModal] = useState(false);
  const [tourActiveTab, setTourActiveTab] = useState<'general' | 'content' | 'pricing' | 'itinerary' | 'marketing'>('general');
  
  const [selectedOffers, setSelectedOffers] = useState<string[]>([]);
  const [isOffersSelectionMode, setIsOffersSelectionMode] = useState(false);
  const [offersSearchQuery, setOffersSearchQuery] = useState('');
  const [offerViewMode, setOfferViewMode] = useState<'grid' | 'list'>('grid');
  
  const [selectedTours, setSelectedTours] = useState<string[]>([]);
  const [isToursSelectionMode, setIsToursSelectionMode] = useState(false);
  const [toursSearchQuery, setToursSearchQuery] = useState('');
  const [toursLayout, setToursLayout] = useState<'grid' | 'list'>('grid');

  // Filtered lists
  const filteredOffers = useMemo(() => (offers || []).filter((o: any) => {
    if (!offersSearchQuery) return true;
    const q = offersSearchQuery.toLowerCase();
    return (
      o.title?.toLowerCase().includes(q) ||
      o.description?.toLowerCase().includes(q) ||
      o.slug?.toLowerCase().includes(q)
    );
  }), [offers, offersSearchQuery]);

  const filteredTours = useMemo(() => (tours || []).filter((t: any) => {
    if (!toursSearchQuery) return true;
    const q = toursSearchQuery.toLowerCase();
    return (
      t.title?.toLowerCase().includes(q) ||
      t.shortDescription?.toLowerCase().includes(q) ||
      t.description?.toLowerCase().includes(q) ||
      t.slug?.toLowerCase().includes(q)
    );
  }), [tours, toursSearchQuery]);

  // Handlers
  const handleUpdateOffer = async (id: string | null, data: any) => {
    try {
      const { id: _id, createdAt: _ca, updatedAt: _ua, ...rest } = data;
      const processedFleets = (rest.fleets || []).map((f: any) => ({
        ...f,
        basePrice: Number(f.basePrice),
        salePrice: Number(f.salePrice)
      }));

      const processedData = {
        ...rest,
        discountValue: Number(rest.discountValue),
        fleets: processedFleets,
        active: rest.active === undefined ? true : Boolean(rest.active),
        slug: rest.slug || rest.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `offer-${Date.now()}`
      };

      if (!id || id === 'new') {
        const newRef = doc(collection(db, 'offers'));
        await setDoc(newRef, { ...processedData, id: newRef.id, createdAt: serverTimestamp() });
      } else {
        await updateDoc(doc(db, 'offers', id), {
          ...processedData,
          updatedAt: serverTimestamp()
        });
      }
      setShowOfferModal(false);
      setEditingOffer(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'offers');
    }
  };

  const handleDeleteOffer = (id: string) => {
    setConfirmDelete({ type: 'offer', id });
  };

  const handleUpdateTour = async (id: string | null, data: any) => {
    try {
      const { id: _id, createdAt: _ca, updatedAt: _ua, ...rest } = data;
      const deepClean = (obj: any): any => {
        if (Array.isArray(obj)) return obj.map(v => deepClean(v)).filter(v => v !== undefined);
        if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
          return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, deepClean(v)]).filter(([_, v]) => v !== undefined));
        }
        return obj === undefined ? undefined : obj;
      };

      const cleanList = (list: any[], filterKey: string) => {
        return (list || []).filter(item => {
          if (typeof item === 'string') return item.trim() !== '';
          if (typeof item === 'object' && item !== null) return item[filterKey] && String(item[filterKey]).trim() !== '';
          return false;
        });
      };

      const rawData: any = {
        title: rest.title || 'Untitled Tour',
        slug: rest.slug || rest.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `tour-${Date.now()}`,
        active: rest.active === undefined ? true : Boolean(rest.active),
        maxPeople: Number(rest.maxPeople || 0),
        duration: rest.duration || '',
        startPlace: rest.startPlace || '',
        ageRange: rest.ageRange || '',
        shortDescription: rest.shortDescription || '',
        fullDescription: rest.fullDescription || '',
        promoTag: rest.promoTag || '',
        customerNote: rest.customerNote || '',
        category: rest.category || '',
        image: rest.image || rest.featuredImage || '',
        featuredImage: rest.featuredImage || rest.image || '',
        gallery: cleanList(rest.gallery, ''),
        inclusions: cleanList(rest.inclusions, ''),
        exclusions: cleanList(rest.exclusions, ''),
        activities: cleanList(rest.activities, ''),
        placesToVisit: cleanList(rest.placesToVisit, ''),
        fleets: cleanList(rest.fleets, 'name').map((f: any) => ({
          ...f,
          passengers: Number(f.passengers || 0),
          standardPrice: Number(f.standardPrice || 0),
          salePrice: Number(f.salePrice || 0)
        })),
        extras: cleanList(rest.extras, 'name').map((e: any) => ({
          ...e,
          price: Number(e.price || 0),
          availableCount: Number(e.availableCount || 0)
        })),
        itinerary: cleanList(rest.itinerary, 'name').map((it: any, idx: number) => ({
          ...it,
          order: it.order !== undefined ? Number(it.order) : idx
        })),
        faqs: cleanList(rest.faqs, 'question'),
        tags: cleanList(rest.tags, ''),
        availability: rest.availability || {}
      };

      const processedData = deepClean(rawData);
      if (!id || id === 'new') {
        const newRef = doc(collection(db, 'tours'));
        await setDoc(newRef, { ...processedData, id: newRef.id, createdAt: serverTimestamp() });
      } else {
        await updateDoc(doc(db, 'tours', id), { ...processedData, updatedAt: serverTimestamp() });
      }
      setShowTourModal(false);
      setEditingTour(null);
    } catch (err) {
      console.error('Error updating tour:', err);
      handleFirestoreError(err, OperationType.WRITE, 'tours');
    }
  };

  const handleDeleteTour = (id: string) => {
    setConfirmDelete({ type: 'tour', id });
  };

  const handleDuplicateOffer = async (offer: any) => {
    try {
      const { id, createdAt, updatedAt, ...rest } = offer;
      await addDoc(collection(db, 'offers'), {
        ...rest,
        title: `${rest.title} (Copy)`,
        slug: `${rest.slug}-copy`,
        active: false,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'offers');
    }
  };

  const handleDuplicateTour = async (tour: any) => {
    try {
      const { id, createdAt, updatedAt, ...rest } = tour;
      await addDoc(collection(db, 'tours'), {
        ...rest,
        title: `${rest.title} (Copy)`,
        slug: `${rest.slug}-copy`,
        active: false,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'tours');
    }
  };

  const handleToggleOfferStatus = async (id: string, active: boolean) => {
    try {
      await updateDoc(doc(db, 'offers', id), { active: !active, updatedAt: serverTimestamp() });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `offers/${id}`);
    }
  };

  const handleToggleTourStatus = async (id: string, active: boolean) => {
    try {
      await updateDoc(doc(db, 'tours', id), { active: !active, updatedAt: serverTimestamp() });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tours/${id}`);
    }
  };

  const executeBulkUpdateOffersStatus = async (ids: string[], active: boolean) => {
    try {
      for (const id of ids) {
        await updateDoc(doc(db, 'offers', id), { active, updatedAt: serverTimestamp() });
      }
      setSelectedOffers([]);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `offers`);
    }
  };

  const executeBulkUpdateToursStatus = async (ids: string[], active: boolean) => {
    try {
      for (const id of ids) {
        await updateDoc(doc(db, 'tours', id), { active, updatedAt: serverTimestamp() });
      }
      setSelectedTours([]);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tours`);
    }
  };

  const handleBulkDuplicateOffers = async () => {
    for (const id of selectedOffers) {
      const offer = offers.find(o => o.id === id);
      if (offer) await handleDuplicateOffer(offer);
    }
    setSelectedOffers([]);
  };

  const handleBulkDuplicateTours = async () => {
    for (const id of selectedTours) {
      const tour = tours.find(t => t.id === id);
      if (tour) await handleDuplicateTour(tour);
    }
    setSelectedTours([]);
  };
  return (
    <>
      <div className="space-y-12">
      {/* Tours Section */}
      <div className="space-y-6 pt-12 border-t border-white/5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl sm:text-2xl font-display text-gold flex items-center gap-3">
              Products: Tours
            </h3>
            <p className="text-white/40 text-[10px] uppercase tracking-widest">Manage luxury bespoke experiences</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setCsvImportType('tours');
                setShowCsvImportModal(true);
              }}
              className="bg-white/5 border border-white/10 hover:border-gold/50 text-white/60 hover:text-white px-4 py-2 rounded-xl transition-all flex items-center gap-2"
            >
              <Upload size={16} />
              <span className="text-[10px] font-bold uppercase tracking-widest leading-none">Import</span>
            </button>
            <button
              onClick={() => {
                setEditingTour({ title: '', description: '', price: 0, image: '', active: true, slug: '', duration: '', capacity: 0, locations: [] });
                setShowTourModal(true);
              }}
              className="bg-gold text-black hover:bg-gold/80 px-6 py-2 rounded-xl flex items-center gap-2 transition-all"
            >
              <Plus size={18} />
              <span className="text-xs font-bold uppercase tracking-widest leading-none">Add Tour</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-1 items-center gap-4">
            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsToursSelectionMode(false);
                  setSelectedTours([]);
                }}
                className={cn(
                  "px-3 py-1.5 rounded-lg transition-all flex items-center gap-2",
                  !isToursSelectionMode ? "bg-white/10 text-white" : "text-white/40 hover:text-white"
                )}
                title="None (Selection Mode OFF)"
              >
                <CircleX size={14} />
                <span className="hidden md:inline text-[10px] uppercase font-black tracking-widest">None</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsToursSelectionMode(true);
                  if ((selectedTours || []).length === (filteredTours || []).length) {
                    setSelectedTours([]);
                  }
                }}
                className={cn(
                  "px-3 py-1.5 rounded-lg transition-all flex items-center gap-2",
                  isToursSelectionMode && (selectedTours || []).length < (filteredTours || []).length ? "bg-gold text-black" : "text-white/40 hover:text-white"
                )}
                title="Selection Mode ON"
              >
                <Check size={14} />
                <span className="hidden md:inline text-[10px] uppercase font-black tracking-widest">Select</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsToursSelectionMode(true);
                  setSelectedTours((filteredTours || []).map((t: any) => t.id));
                }}
                className={cn(
                  "px-3 py-1.5 rounded-lg transition-all flex items-center gap-2",
                  isToursSelectionMode && (selectedTours || []).length === (filteredTours || []).length && (filteredTours || []).length > 0 ? "bg-gold text-black" : "text-white/40 hover:text-white"
                )}
                title="Select All"
              >
                <CheckCheck size={14} />
                <span className="hidden md:inline text-[10px] uppercase font-black tracking-widest">All</span>
              </button>
            </div>

            <div className="relative flex-1 w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={16} />
              <input
                type="text"
                placeholder="Search luxury tours..."
                value={toursSearchQuery}
                onChange={(e) => setToursSearchQuery(e.target.value)}
                className="w-full bg-black/40 border border-white/15 rounded-xl py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-gold/50 transition-all"
              />
              {toursSearchQuery && (
                <button
                  onClick={() => setToursSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white transition-colors"
                >
                  <XCircle size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {(selectedTours || []).length > 0 && (
              <div className="flex items-center gap-2 mr-2 animate-in fade-in zoom-in duration-200">
                <span className="text-[10px] uppercase tracking-widest font-bold text-gold px-2">
                  {(selectedTours || []).length} Selected
                </span>
                <button
                  onClick={() => executeBulkUpdateToursStatus(selectedTours, true)}
                  className="p-2 bg-green-500/10 text-green-500 rounded-lg hover:bg-green-500 hover:text-white transition-all"
                  title="Activate Selected"
                >
                  <CheckCircle size={16} />
                </button>
                <button
                  onClick={() => executeBulkUpdateToursStatus(selectedTours, false)}
                  className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500/50 hover:text-white transition-all"
                  title="Deactivate Selected"
                >
                  <Ban size={16} />
                </button>
                <button
                  onClick={handleBulkDuplicateTours}
                  className="p-2 bg-white/5 text-gold rounded-lg hover:bg-gold hover:text-black transition-all"
                  title="Duplicate Selected"
                >
                  <Copy size={16} />
                </button>
                <button
                  onClick={() => setConfirmDelete({ type: 'bulk-tours', ids: selectedTours })}
                  className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all"
                  title="Delete Selected"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}

            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10">
              <button
                onClick={() => setToursLayout('grid')}
                className={cn(
                  "p-1.5 rounded-lg transition-all flex items-center justify-center min-w-[40px]",
                  toursLayout === 'grid'
                    ? "bg-gold text-black shadow-lg"
                    : "text-white/40 hover:text-white hover:bg-white/5"
                )}
                title="Grid View"
              >
                <LayoutGrid size={14} />
              </button>
              <button
                onClick={() => setToursLayout('list')}
                className={cn(
                  "p-1.5 rounded-lg transition-all flex items-center justify-center min-w-[40px]",
                  toursLayout === 'list'
                    ? "bg-gold text-black shadow-lg"
                    : "text-white/40 hover:text-white hover:bg-white/5"
                )}
                title="List View"
              >
                <List size={16} />
              </button>
            </div>
          </div>
        </div>

        {toursLayout === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(filteredTours || []).length > 0 ? (
              (filteredTours || []).map((tour, idx) => {
                let isActive = tour.active;
                if (tour.availability?.endDate) {
                  const endDate = new Date(tour.availability.endDate);
                  if (endDate < new Date(new Date().setHours(0, 0, 0, 0))) {
                    isActive = false;
                  }
                }

                const prices = tour.fleets?.map((f: any) => Number(f.salePrice || f.standardPrice || f.price || 0)).filter((p: number) => p > 0) || [];
                const minPrice = prices.length > 0 ? Math.min(...prices) : tour.price || 0;
                const maxPrice = prices.length > 0 ? Math.max(...prices) : tour.price || 0;
                const priceDisplay = prices.length > 0 && minPrice !== maxPrice ? `$${minPrice} - $${maxPrice}` : `$${minPrice}`;

                return (
                  <div key={tour.id || `tour-${idx}`} className={cn("glass rounded-2xl overflow-hidden border transition-all flex flex-col group relative", (selectedTours || []).includes(tour.id) ? "border-gold shadow-[0_0_15px_rgba(212,175,55,0.2)]" : "border-white/5 hover:border-gold/30")}>
                    <div className="relative h-40 group rounded overflow-hidden shadow-lg">
                      <img
                        src={getAssetPath(tour.image) || "https://picsum.photos/seed/tour/600/300"}
                        alt={tour.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent backdrop-blur-[1px]" />

                      <div className="absolute top-2 left-3 z-10 flex items-center gap-2 flex-wrap">
                        {tour.promoTag && (
                          <span className="px-2 py-1 rounded bg-gold text-black text-[8px] font-black uppercase shadow-sm">
                            {tour.promoTag}
                          </span>
                        )}
                      </div>

                      <div className="absolute top-0 right-0 z-20 flex items-center gap-2">
                        <span
                          className={cn(
                            "px-3 py-1 rounded-bl-2xl text-[9px] font-black uppercase tracking-widest shadow-lg",
                            isActive ? "bg-green-700 text-white" : "bg-red-700 text-white"
                          )}
                        >
                          {isActive ? "Active" : !tour.active ? "Inactive" : "Expired"}
                        </span>
                      </div>

                      <div className="absolute bottom-4 left-4 right-4">
                        <p className="text-xl font-display drop-shadow-md leading-tight">{tour.title}</p>
                        <div className="flex items-center justify-between mt-1">
                          <div className="flex items-center gap-3 text-[10px] text-white/70 uppercase tracking-widest font-bold">
                            {tour.duration && (
                              <span className="flex items-center gap-1">
                                <Clock size={10} /> {tour.duration}
                              </span>
                            )}
                            {priceDisplay && (
                              <span className="flex items-center gap-1 font-display text-gold font-normal">
                                {priceDisplay}
                              </span>
                            )}
                          </div>
                          <div className="flex -space-x-2">
                             {(tour.fleets || []).slice(0, 3).map((f: any, i: number) => (
                               <div key={i} className="w-5 h-5 rounded-full border border-black bg-gold/20 flex items-center justify-center text-[7px] font-bold text-gold" title={f.name || f.type}>
                                 <Car size={8} />
                               </div>
                             ))}
                             {(tour.fleets || []).length > 3 && (
                               <div className="w-5 h-5 rounded-full border border-black bg-white/10 flex items-center justify-center text-[7px] text-white/40">
                                 +{(tour.fleets || []).length - 3}
                               </div>
                             )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 flex-1 flex flex-col bg-white/[0.02]">
                      <p className="text-white/60 text-[10px] line-clamp-2 mb-4 italic">"{tour.shortDescription || tour.description || 'No description available.'}"</p>
                      <div className="mt-auto flex items-center gap-2">
                        {isToursSelectionMode && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (selectedTours.includes(tour.id))
                                setSelectedTours((prev) => prev.filter((id) => id !== tour.id));
                              else
                                setSelectedTours((prev) => [...prev, tour.id]);
                            }}
                            className={cn(
                              "flex-1 py-2 px-2 font-bold rounded-lg transition-all flex items-center justify-center gap-1",
                              selectedTours.includes(tour.id) ? "bg-gold text-black" : "bg-white/5 text-white/40 hover:bg-white/10"
                            )}
                            title={selectedTours.includes(tour.id) ? "Deselect" : "Select"}
                          >
                            {selectedTours.includes(tour.id) ? <SquareCheck size={16} /> : <Square size={16} />}
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggleTourStatus(tour.id, tour.active); }}
                          className={cn("flex-1 py-2 px-2 font-bold rounded-lg transition-all flex items-center justify-center gap-1", tour.active ? "bg-red-500/10 text-red-500 hover:bg-red-500/50 hover:text-white" : "bg-green-500/10 text-green-500 hover:bg-green-500/50 hover:text-white")}
                          title={tour.active ? "Deactivate" : "Activate"}
                        >
                          {tour.active ? <Ban size={16} /> : <CheckCircle size={16} />}
                        </button>
                        <button
                          onClick={() => handleDuplicateTour(tour)}
                          className="flex-1 py-2 px-2 bg-gold/10 text-gold hover:bg-gold/50 hover:text-white font-bold rounded-lg transition-all flex items-center justify-center gap-1"
                          title="Duplicate"
                        >
                          <Copy size={16} />
                        </button>

                        <button
                          onClick={() => {
                            setEditingTour(tour);
                            setShowTourModal(true);
                          }}
                          className="flex-1 py-2 px-2 bg-blue-600/10 text-blue-500 font-bold hover:bg-blue-500/50 hover:text-white rounded-lg transition-all flex items-center justify-center gap-1"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>

                        <button
                          onClick={() => handleDeleteTour(tour.id)}
                          className="flex-1 py-2 px-2 bg-red-500/10 text-red-500 hover:bg-red-500/50 hover:text-white font-bold rounded-lg transition-all flex items-center justify-center gap-1"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="col-span-full py-12 text-center bg-white/5 rounded-2xl border border-dashed border-white/10">
                <p className="text-white/40 italic uppercase tracking-widest text-[10px] font-bold">No tours found.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="glass rounded-[0.5rem] border border-white/5 overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-white/5 border-b border-white/5">
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gold w-16">Status</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gold min-w-[250px]">Tour Details</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gold">Locations</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {(filteredTours || []).length > 0 ? (
                    (filteredTours || []).map((tour, idx) => {
                      let isActive = tour.active;
                      if (tour.availability?.endDate) {
                        const endDate = new Date(tour.availability.endDate);
                        if (endDate < new Date(new Date().setHours(0, 0, 0, 0))) {
                          isActive = false;
                        }
                      }
                      const prices = tour.fleets?.map((f: any) => Number(f.salePrice || f.standardPrice || f.price || 0)).filter((p: number) => p > 0) || [];
                      const minPrice = prices.length > 0 ? Math.min(...prices) : tour.price || 0;
                      const maxPrice = prices.length > 0 ? Math.max(...prices) : tour.price || 0;
                      const priceDisplay = prices.length > 0 && minPrice !== maxPrice ? `$${minPrice} - $${maxPrice}` : `$${minPrice}`;

                      return (
                        <tr key={tour.id || `list-tour-${idx}`} className={cn("transition-colors group bg-white/[0.01]", (selectedTours || []).includes(tour.id) ? "bg-gold/5" : "hover:bg-white/5")}>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "px-2 py-1 rounded text-[8px] font-bold uppercase tracking-widest",
                              isActive ? "bg-green-700 text-white" : "bg-red-700 text-white"
                            )}>
                              {isActive ? 'Active' : (!tour.active ? 'Inactive' : 'Expired')}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <img src={getAssetPath(tour.image || tour.featuredImage) || 'https://picsum.photos/seed/tour/60/60'} alt={tour.title} className="w-12 h-12 rounded-lg object-cover" />
                              <div>
                                <p className="text-sm font-bold text-white mb-0.5 flex items-center gap-2">
                                  {tour.title}
                                  {tour.promoTag && (
                                    <span className="bg-gold text-black px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest shadow-lg inline-block">
                                      {tour.promoTag}
                                    </span>
                                  )}
                                </p>
                                <p className="text-[10px] text-white/50 line-clamp-1">"{tour.shortDescription || tour.description || 'No description available.'}"</p>
                                <div className="flex gap-3 mt-1 text-[9px] text-white/40 uppercase tracking-widest">
                                  <span className="flex items-center gap-1"><Clock size={10} /> {tour.duration}</span>
                                  <span className="flex items-center gap-1 font-display text-gold font-normal">From {priceDisplay}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm font-mono text-white/80">
                            {tour.locations?.length || 0} stops
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center gap-2 justify-end">
                              {isToursSelectionMode && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (selectedTours.includes(tour.id)) setSelectedTours(prev => prev.filter(id => id !== tour.id));
                                    else setSelectedTours(prev => [...prev, tour.id]);
                                  }}
                                  className={cn(
                                    "p-2 rounded-lg transition-all border",
                                    selectedTours.includes(tour.id) ? "bg-gold text-black border-gold" : "bg-white/5 text-white/40 hover:text-white border-white/10"
                                  )}
                                  title={selectedTours.includes(tour.id) ? "Deselect" : "Select"}
                                >
                                  {selectedTours.includes(tour.id) ? <SquareCheck size={14} /> : <Square size={14} />}
                                </button>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); handleToggleTourStatus(tour.id, tour.active); }}
                                className={cn("p-2 rounded-lg transition-all border", tour.active ? "bg-red-500/10 text-red-500 hover:bg-red-500/50 hover:text-white border-red-500/20" : "bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white border-green-500/20")}
                                title={tour.active ? "Deactivate" : "Activate"}
                              >
                                {tour.active ? <Ban size={14} /> : <CheckCircle size={14} />}
                              </button>
                              <button
                                onClick={() => handleDuplicateTour(tour)}
                                className="p-2 bg-gold/10 text-gold border border-gold/20 hover:bg-gold hover:text-black rounded-lg transition-all"
                                title="Duplicate"
                              >
                                <Copy size={14} />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingTour(tour);
                                  setShowTourModal(true);
                                }}
                                className="p-2 bg-blue-600/10 text-blue-500 border border-blue-500/20 hover:bg-blue-600 hover:text-white rounded-lg transition-all"
                                title="Edit"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteTour(tour.id)}
                                className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all border border-red-500/20"
                                title="Delete"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-white/40 italic uppercase tracking-widest text-[10px] font-bold">
                        No tours found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

            {/* Products Section */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl sm:text-2xl font-display text-gold flex items-center gap-3">
              Products: Offers
            </h3>
            <p className="text-white/40 text-[10px] uppercase tracking-widest">Premium fixed-rate seasonal packages</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setCsvImportType('offers');
                setShowCsvImportModal(true);
              }}
              className="bg-white/5 border border-white/10 hover:border-gold/50 text-white/60 hover:text-white px-4 py-2 rounded-xl transition-all flex items-center gap-2"
            >
              <Upload size={16} />
              <span className="text-[10px] font-bold uppercase tracking-widest leading-none">Import</span>
            </button>
            <button
              onClick={() => {
                setEditingOffer({
                  title: '',
                  description: '',
                  discountType: 'percentage',
                  discountValue: 15,
                  image: '',
                  active: true,
                  slug: '',
                  tags: [],
                  fleets: []
                });
                setShowOfferModal(true);
              }}
              className="bg-gold text-black hover:bg-gold/80 px-6 py-2 rounded-xl flex items-center gap-2 transition-all"
            >
              <Plus size={18} />
              <span className="text-xs font-bold uppercase tracking-widest leading-none">Add Offer</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-1 items-center gap-4">
            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsOffersSelectionMode(false);
                  setSelectedOffers([]);
                }}
                className={cn(
                  "px-3 py-1.5 rounded-lg transition-all flex items-center gap-2",
                  !isOffersSelectionMode ? "bg-white/10 text-white" : "text-white/40 hover:text-white"
                )}
                title="None (Selection Mode OFF)"
              >
                <CircleX size={14} />
                <span className="hidden md:inline text-[10px] uppercase font-black tracking-widest">None</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsOffersSelectionMode(true);
                  if ((selectedOffers || []).length === (filteredOffers || []).length) {
                    setSelectedOffers([]);
                  }
                }}
                className={cn(
                  "px-3 py-1.5 rounded-lg transition-all flex items-center gap-2",
                  isOffersSelectionMode && (selectedOffers || []).length < (filteredOffers || []).length ? "bg-gold text-black" : "text-white/40 hover:text-white"
                )}
                title="Selection Mode ON"
              >
                <Check size={14} />
                <span className="hidden md:inline text-[10px] uppercase font-black tracking-widest">Select</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsOffersSelectionMode(true);
                  setSelectedOffers((filteredOffers || []).map((o: any) => o.id));
                }}
                className={cn(
                  "px-3 py-1.5 rounded-lg transition-all flex items-center gap-2",
                  isOffersSelectionMode && (selectedOffers || []).length === (filteredOffers || []).length && (filteredOffers || []).length > 0 ? "bg-gold text-black" : "text-white/40 hover:text-white"
                )}
                title="Select All"
              >
                <CheckCheck size={14} />
                <span className="hidden md:inline text-[10px] uppercase font-black tracking-widest">All</span>
              </button>
            </div>

            <div className="relative flex-1 w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={16} />
              <input
                type="text"
                placeholder="Search standard and special offers..."
                value={offersSearchQuery}
                onChange={(e) => setOffersSearchQuery(e.target.value)}
                className="w-full bg-black/40 border border-white/15 rounded-xl py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-gold/50 transition-all"
              />
              {offersSearchQuery && (
                <button
                  onClick={() => setOffersSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white transition-colors"
                >
                  <XCircle size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {(selectedOffers || []).length > 0 && (
              <div className="flex items-center gap-2 mr-2 animate-in fade-in zoom-in duration-200">
                <span className="text-[10px] uppercase tracking-widest font-bold text-gold px-2">
                  {(selectedOffers || []).length} Selected
                </span>
                <button
                  onClick={() => executeBulkUpdateOffersStatus(selectedOffers, true)}
                  className="p-2 bg-green-500/10 text-green-500 rounded-lg hover:bg-green-500 hover:text-white transition-all"
                  title="Activate Selected"
                >
                  <CheckCircle size={16} />
                </button>
                <button
                  onClick={() => executeBulkUpdateOffersStatus(selectedOffers, false)}
                  className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500/50 hover:text-white transition-all"
                  title="Deactivate Selected"
                >
                  <Ban size={16} />
                </button>
                <button
                  onClick={handleBulkDuplicateOffers}
                  className="p-2 bg-white/5 text-gold rounded-lg hover:bg-gold hover:text-black transition-all"
                  title="Duplicate Selected"
                >
                  <Copy size={16} />
                </button>
                <button
                  onClick={() => setConfirmDelete({ type: 'bulk-offers', ids: selectedOffers })}
                  className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all"
                  title="Delete Selected"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}

            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10">
              <button
                onClick={() => setOfferViewMode('grid')}
                className={cn(
                  "p-1.5 rounded-lg transition-all flex items-center justify-center min-w-[40px]",
                  offerViewMode === 'grid'
                    ? "bg-gold text-black shadow-lg"
                    : "text-white/40 hover:text-white hover:bg-white/5"
                )}
                title="Grid View"
              >
                <LayoutGrid size={14} />
              </button>
              <button
                onClick={() => setOfferViewMode('list')}
                className={cn(
                  "p-1.5 rounded-lg transition-all flex items-center justify-center min-w-[40px]",
                  offerViewMode === 'list'
                    ? "bg-gold text-black shadow-lg"
                    : "text-white/40 hover:text-white hover:bg-white/5"
                )}
                title="List View"
              >
                <List size={16} />
              </button>
            </div>
          </div>
        </div>

        {offerViewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(filteredOffers || []).length > 0 ? (
              (filteredOffers || []).map((offer, idx) => (
                <div key={offer.id || `offer-${idx}`} className={cn("glass rounded-2xl overflow-hidden border transition-all flex flex-col group relative", (selectedOffers || []).includes(offer.id) ? "border-gold shadow-[0_0_15px_rgba(212,175,55,0.2)]" : "border-white/5 hover:border-gold/30")}>

                  <div className="h-40 relative">
                    <img
                      src={getAssetPath(offer.image) || 'https://picsum.photos/seed/offer/600/300'}
                      alt={offer.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />

                    <div className="absolute top-0 left-0 right-0 z-10 flex items-start justify-between px-3 pt-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex flex-wrap gap-1">
                          {offer.tags?.map((tag: string, tIdx: number) => (
                            <span
                              key={`${offer.id}-tag-${tag}-${tIdx}`}
                              className="px-2 py-1 rounded bg-gold text-black text-[8px] font-black uppercase shadow-sm"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "px-3 py-1 rounded-bl-2xl text-[9px] font-black uppercase tracking-widest shadow-lg -mr-3 -mt-2",
                            offer.active ? "bg-green-700 text-white" : "bg-red-700 text-white"
                          )}
                        >
                          {offer.active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>

                    <div className="absolute bottom-4 left-4 right-4">
                      <p className="text-xl font-display leading-tight">{offer.title}</p>
                      <div className="flex items-center justify-between mt-1">
                        {(() => {
                          const prices = (offer.fleets || [])
                            .map((f: any) => Number(f.salePrice || f.basePrice || f.price || 0))
                            .filter((p: number) => p > 0);
                          const min = prices.length ? Math.min(...prices) : 0;
                          const max = prices.length ? Math.max(...prices) : 0;
                          return (
                            <p className="text-gold font-bold text-sm">
                              {min === max ? `$${min}` : `$${min} - $${max}`}
                            </p>
                          );
                        })()}
                        <div className="flex -space-x-2">
                          {(offer.fleets || []).slice(0, 3).map((f: any, i: number) => (
                            <div key={i} className="w-6 h-6 rounded-full border border-black bg-gold/20 flex items-center justify-center text-[8px] font-bold text-gold" title={f.type}>
                              <Car size={10} />
                            </div>
                          ))}
                          {(offer.fleets || []).length > 3 && (
                            <div className="w-6 h-6 rounded-full border border-black bg-white/10 flex items-center justify-center text-[8px] text-white/40">
                              +{(offer.fleets || []).length - 3}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 flex-1 flex flex-col bg-white/[0.02]">
                    <p className="text-white/60 text-[10px] line-clamp-2 mb-4 italic">"{offer.description}"</p>
                    <div className="mt-auto flex items-center gap-2">
                      {isOffersSelectionMode && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (selectedOffers.includes(offer.id))
                              setSelectedOffers((prev) => prev.filter((id) => id !== offer.id));
                            else
                              setSelectedOffers((prev) => [...prev, offer.id]);
                          }}
                          className={cn(
                            "flex-1 py-2 px-2 font-bold rounded-lg transition-all flex items-center justify-center gap-1",
                            selectedOffers.includes(offer.id) ? "bg-gold text-black" : "bg-white/5 text-white/40 hover:bg-white/10"
                          )}
                          title={selectedOffers.includes(offer.id) ? "Deselect" : "Select"}
                        >
                          {selectedOffers.includes(offer.id) ? <SquareCheck size={16} /> : <Square size={16} />}
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleToggleOfferStatus(offer.id, offer.active); }}
                        className={cn("flex-1 py-2 px-2 font-bold rounded-lg transition-all flex items-center justify-center gap-1", offer.active ? "bg-red-500/10 text-red-500 hover:bg-red-500/50 hover:text-white" : "bg-green-500/10 text-green-500 hover:bg-green-500/50 hover:text-white")}
                        title={offer.active ? "Deactivate" : "Activate"}
                      >
                        {offer.active ? <Ban size={16} /> : <CheckCircle size={16} />}
                      </button>
                      <button
                        onClick={() => handleDuplicateOffer(offer)}
                        className="flex-1 py-2 px-2 bg-gold/10 text-gold hover:bg-gold/50 hover:text-white rounded-lg font-bold transition-all flex items-center justify-center gap-1"
                        title="Duplicate"
                      >
                        <Copy size={16} />
                      </button>
                      <button
                        onClick={() => {
                          setEditingOffer(offer);
                          setShowOfferModal(true);
                        }}
                        className="flex-1 py-2 px-2 bg-blue-500/10 text-blue-500 hover:bg-blue-500/50 hover:text-white font-bold rounded-lg transition-all flex items-center justify-center gap-1"
                        title="Edit"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteOffer(offer.id)}
                        className="flex-1 py-2 px-2 bg-red-500/10 text-red-500 hover:bg-red-500/50 hover:text-white font-bold rounded-lg transition-all flex items-center justify-center gap-1"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full py-12 text-center bg-white/5 rounded-2xl border border-dashed border-white/10">
                <p className="text-white/40 italic uppercase tracking-widest text-xs font-bold">No offers found.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="glass rounded-[0.5rem] border border-white/5 overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-white/5 border-b border-white/5">
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gold w-16">Status</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gold min-w-[250px]">Offer Details</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gold">Discount</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gold">Price Range</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {(filteredOffers || []).length > 0 ? (
                    (filteredOffers || []).map((offer, idx) => {
                      const prices = (offer.fleets || []).map((f: any) => Number(f.salePrice || f.basePrice || f.price || 0)).filter((p: number) => p > 0);
                      const min = prices.length ? Math.min(...prices) : 0;
                      const max = prices.length ? Math.max(...prices) : 0;
                      return (
                        <tr key={offer.id || `list-offer-${idx}`} className={cn("transition-colors group bg-white/[0.01]", (selectedOffers || []).includes(offer.id) ? "bg-gold/5" : "hover:bg-white/5")}>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "px-2 py-1 rounded text-[8px] font-bold uppercase tracking-widest",
                              offer.active ? "bg-green-700 text-white" : "bg-red-700 text-white"
                            )}>
                              {offer.active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <img src={getAssetPath(offer.image) || 'https://picsum.photos/seed/offer/60/60'} alt={offer.title} className="w-12 h-12 rounded-lg object-cover" />
                              <div>
                                <p className="text-sm font-bold text-white mb-0.5">{offer.title}</p>
                                <p className="text-[10px] text-white/50 line-clamp-1">"{offer.description}"</p>
                                <div className="flex gap-1 mt-1">
                                  {offer.tags?.slice(0, 3).map((tag: string, tIdx: number) => (
                                    <span key={`${offer.id}-list-tag-${tag}-${tIdx}`} className="text-[8px] bg-gold/10 text-gold px-1 rounded uppercase tracking-widest">
                                      {tag}
                                    </span>
                                  ))}
                                  {(offer.tags?.length || 0) > 3 && <span className="text-[8px] text-white/40">...</span>}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {offer.discountType === 'percentage'
                              ? <span className="px-2 py-1 bg-blue-500/10 text-blue-400 rounded text-xs font-bold">{offer.discountValue}% OFF</span>
                              : <span className="px-2 py-1 bg-green-500/10 text-green-400 rounded text-xs font-bold">${offer.discountValue} OFF</span>}
                          </td>
                          <td className="px-6 py-4 font-mono text-sm">
                            {min === max ? `$${min}` : `$${min} - $${max}`}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center gap-2 justify-end">
                              {isOffersSelectionMode && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (selectedOffers.includes(offer.id)) setSelectedOffers(prev => prev.filter(id => id !== offer.id));
                                    else setSelectedOffers(prev => [...prev, offer.id]);
                                  }}
                                  className={cn(
                                    "p-2 rounded-lg transition-all border",
                                    selectedOffers.includes(offer.id) ? "bg-gold text-black border-gold" : "bg-white/5 text-white/40 hover:text-white border-white/10"
                                  )}
                                  title={selectedOffers.includes(offer.id) ? "Deselect" : "Select"}
                                >
                                  {selectedOffers.includes(offer.id) ? <SquareCheck size={14} /> : <Square size={14} />}
                                </button>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); handleToggleOfferStatus(offer.id, offer.active); }}
                                className={cn("p-2 rounded-lg transition-all border", offer.active ? "bg-red-500/10 text-red-500 hover:bg-red-500/50 hover:text-white border-red-500/20" : "bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white border-green-500/20")}
                                title={offer.active ? "Deactivate" : "Activate"}
                              >
                                {offer.active ? <Ban size={14} /> : <CheckCircle size={14} />}
                              </button>
                              <button
                                onClick={() => handleDuplicateOffer(offer)}
                                className="p-2 bg-gold/10 text-gold border border-gold/20 hover:bg-gold hover:text-black rounded-lg transition-all"
                                title="Duplicate"
                              >
                                <Copy size={14} />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingOffer(offer);
                                  setShowOfferModal(true);
                                }}
                                className="p-2 bg-blue-600/10 text-blue-500 border border-blue-500/20 hover:bg-blue-600 hover:text-white rounded-lg transition-all"
                                title="Edit"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteOffer(offer.id)}
                                className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all border border-red-500/20"
                                title="Delete"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-white/40 italic uppercase tracking-widest text-[10px] font-bold">
                        No offers found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      </div>

      <AnimatePresence>
        {/* Offer Modal */}
        {showOfferModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-2xl glass p-8 rounded-xl border border-gold/20 max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-display text-gold">
                    {editingOffer?.id ? 'Edit Offer' : 'Add Special Offer'}
                  </h3>
                  <p className="text-[9px] uppercase tracking-widest text-white/40">Manage package details and fleet rates</p>
                </div>
                <button onClick={() => setShowOfferModal(false)} className="text-white/40 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-8">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Offer Header Name</label>
                    <input
                      type="text"
                      value={editingOffer?.title || ''}
                      onChange={(e) => {
                        const title = e.target.value;
                        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                        setEditingOffer({ ...editingOffer, title, slug: editingOffer.id ? editingOffer.slug : slug });
                      }}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                      placeholder="e.g. Melbourne Airport to CBD Exclusive"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Image URL</label>
                    <input
                      type="text"
                      value={editingOffer?.image || ''}
                      onChange={(e) => setEditingOffer({ ...editingOffer, image: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Price Tags / Categories (Comma separated)</label>
                    <input
                      type="text"
                      value={editingOffer?.tags?.join(', ') || ''}
                      onChange={(e) => setEditingOffer({ ...editingOffer, tags: e.target.value.split(',').map(t => t.trim()).filter(t => t !== '') })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                      placeholder="Featured, Most Picked, Family Favorite"
                    />
                  </div>
                </div>

                {/* Discount Strategy */}
                <div className="bg-white/5 border border-white/5 p-6 rounded-2xl space-y-4">
                  <h4 className="text-[10px] uppercase tracking-[0.2em] font-bold text-gold">Discount Logic</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Reduction Type</label>
                      <select
                        value={editingOffer?.discountType || 'percentage'}
                        onChange={(e) => {
                          const newType = e.target.value;
                          const updatedFleets = (editingOffer?.fleets || []).map((f: any) => {
                            const base = Number(f.basePrice) || 0;
                            const dVal = Number(editingOffer?.discountValue) || 0;
                            const salePrice = newType === 'percentage'
                              ? Math.round(base * (1 - dVal / 100))
                              : Math.max(0, base - dVal);
                            return { ...f, salePrice };
                          });
                          setEditingOffer({ ...editingOffer, discountType: newType, fleets: updatedFleets });
                        }}
                        className="custom-select w-full"
                      >
                        <option value="percentage">Percentage (%)</option>
                        <option value="fixed">Fixed Amount ($)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Value ({editingOffer?.discountType === 'percentage' ? '%' : '$'})</label>
                      <input
                        type="number"
                        value={editingOffer?.discountValue || ''}
                        onChange={(e) => {
                          const dVal = Number(e.target.value);
                          const updatedFleets = (editingOffer?.fleets || []).map((f: any) => {
                            const base = Number(f.basePrice) || 0;
                            const type = editingOffer?.discountType || 'percentage';
                            const salePrice = type === 'percentage'
                              ? Math.round(base * (1 - dVal / 100))
                              : Math.max(0, base - dVal);
                            return { ...f, salePrice };
                          });
                          setEditingOffer({ ...editingOffer, discountValue: dVal, fleets: updatedFleets });
                        }}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                        placeholder={editingOffer?.discountType === 'percentage' ? '15' : '20'}
                      />
                    </div>
                  </div>
                </div>

                {/* Fleet Options Section */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <h4 className="text-[10px] uppercase tracking-[0.2em] font-bold text-gold flex items-center gap-2">
                      <Car size={14} /> Fleet Options
                    </h4>
                    <button
                      onClick={() => {
                        const newFleets = [...(editingOffer?.fleets || [])];
                        newFleets.push({
                          type: '', image: '', description: '', capacity: '3 Passengers', luggage: '2 Suitcases', basePrice: 0, salePrice: 0, additionalInfo: ''
                        });
                        setEditingOffer({ ...editingOffer, fleets: newFleets });
                      }}
                      className="text-[9px] uppercase tracking-widest font-bold text-gold hover:text-white transition-colors flex items-center gap-1"
                    >
                      <Plus size={12} /> Add Fleet
                    </button>
                  </div>

                  <div className="space-y-4">
                    {(editingOffer?.fleets || []).map((f: any, fIdx: number) => (
                      <div key={fIdx} className="bg-white/5 border border-white/5 rounded-2xl p-6 relative group/fleet">
                        <div className="absolute top-4 right-4 flex items-center gap-3">
                          <button
                            onClick={() => {
                              const newFleets = [...editingOffer.fleets];
                              const duplicatedFleet = { ...f };
                              newFleets.splice(fIdx + 1, 0, duplicatedFleet);
                              setEditingOffer({ ...editingOffer, fleets: newFleets });
                            }}
                            className="bg-gold/10 text-gold hover:bg-gold hover:text-black px-3 py-1.5 rounded-lg border border-gold/20 transition-all flex items-center gap-1.5"
                            title="Duplicate Fleet"
                          >
                            <Copy size={12} />
                          </button>
                          <button
                            onClick={() => {
                              const newFleets = editingOffer.fleets.filter((_: any, i: number) => i !== fIdx);
                              setEditingOffer({ ...editingOffer, fleets: newFleets });
                            }}
                            className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white px-3 py-1.5 rounded-lg border border-red-500/20 transition-all flex items-center gap-1.5"
                            title="Delete Fleet"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="md:col-span-2">
                            <label className="text-[9px] uppercase tracking-widest font-bold text-white/20 mb-1 block">Fleet Name</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={f.type || ''}
                                onChange={(e) => {
                                  const newFleets = [...editingOffer.fleets];
                                  newFleets[fIdx].type = e.target.value;
                                  setEditingOffer({ ...editingOffer, fleets: newFleets });
                                }}
                                className="flex-1 bg-black/20 border-b border-white/10 px-0 py-2 text-sm outline-none focus:border-gold transition-all"
                                placeholder="e.g. Executive Sedan"
                              />
                              <select
                                onChange={(e) => {
                                  const n = [...editingOffer.fleets];
                                  const v = fleet.find(item => item.name === e.target.value);
                                  if (v) {
                                    n[fIdx].type = v.name;
                                    n[fIdx].image = v.img || v.image;
                                    n[fIdx].passengers = v.passengers || `${v.capacity || 3} Passengers`;
                                    n[fIdx].luggage = v.luggage || `${v.luggage_info || 2} Suitcases`;
                                  }
                                  setEditingOffer({ ...editingOffer, fleets: n });
                                }}
                                className="w-12 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center text-[8px] custom-select"
                              >
                                <option value="">+</option>
                                {fleet.map((v, i) => <option key={`${v.id || 'vehicle'}-${v.name || 'unnamed'}-${i}`} value={v.name}>{v.name}</option>)}
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="text-[9px] uppercase tracking-widest font-bold text-white/20 mb-1 block">Fleet Image URL</label>
                            <input
                              type="text"
                              value={f.image || ''}
                              onChange={(e) => {
                                const newFleets = [...editingOffer.fleets];
                                newFleets[fIdx].image = e.target.value;
                                setEditingOffer({ ...editingOffer, fleets: newFleets });
                              }}
                              className="w-full bg-black/20 border-b border-white/10 px-0 py-2 text-sm outline-none focus:border-gold transition-all"
                              placeholder="https://..."
                            />
                          </div>
                          <div>
                            <label className="text-[9px] uppercase tracking-widest font-bold text-white/20 mb-1 block">Passengers</label>
                            <input
                              type="text"
                              value={f.passengers || ''}
                              onChange={(e) => {
                                const newFleets = [...editingOffer.fleets];
                                newFleets[fIdx].passengers = e.target.value;
                                setEditingOffer({ ...editingOffer, fleets: newFleets });
                              }}
                              className="w-full bg-black/20 border-b border-white/10 px-0 py-2 text-sm outline-none focus:border-gold transition-all"
                              placeholder="3 Passengers"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] uppercase tracking-widest font-bold text-white/20 mb-1 block">Luggage</label>
                            <input
                              type="text"
                              value={f.luggage || ''}
                              onChange={(e) => {
                                const newFleets = [...editingOffer.fleets];
                                newFleets[fIdx].luggage = e.target.value;
                                setEditingOffer({ ...editingOffer, fleets: newFleets });
                              }}
                              className="w-full bg-black/20 border-b border-white/10 px-0 py-2 text-sm outline-none focus:border-gold transition-all"
                              placeholder="2 Suitcases"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] uppercase tracking-widest font-bold text-white/20 mb-1 block">Standard Price ($)</label>
                            <input
                              type="number"
                              value={f.basePrice || ''}
                              onChange={(e) => {
                                const newFleets = [...editingOffer.fleets];
                                const base = Number(e.target.value);
                                newFleets[fIdx].basePrice = base;
                                // Auto calculate salePrice
                                if (editingOffer.discountType === 'percentage') {
                                  newFleets[fIdx].salePrice = Math.round(base * (1 - (editingOffer.discountValue || 0) / 100));
                                } else {
                                  newFleets[fIdx].salePrice = Math.max(0, base - (editingOffer.discountValue || 0));
                                }
                                setEditingOffer({ ...editingOffer, fleets: newFleets });
                              }}
                              className="w-full bg-black/20 border-b border-white/10 px-0 py-2 text-sm outline-none focus:border-gold transition-all"
                              placeholder="120"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="text-[9px] uppercase tracking-widest font-bold text-white/20 mb-1 block">Auto-Calculated Offer Price</label>
                            <div className="flex items-center gap-4">
                              <input
                                type="number"
                                value={f.salePrice || ''}
                                readOnly
                                className="flex-1 bg-white/5 border border-gold/20 rounded-lg px-4 py-2 text-sm outline-none text-gold font-bold transition-all"
                              />
                              <p className="text-[8px] text-white/20 uppercase tracking-widest max-w-[100px] leading-tight">
                                Reduced from ${f.basePrice || 0} via {editingOffer.discountValue || 0}{editingOffer.discountType === 'percentage' ? '%' : '$'} discount
                              </p>
                            </div>
                          </div>
                          <div className="md:col-span-3">
                            <label className="text-[9px] uppercase tracking-widest font-bold text-white/20 mb-1 block">Additional Info</label>
                            <input
                              type="text"
                              value={f.additionalInfo || ''}
                              onChange={(e) => {
                                const newFleets = [...editingOffer.fleets];
                                newFleets[fIdx].additionalInfo = e.target.value;
                                setEditingOffer({ ...editingOffer, fleets: newFleets });
                              }}
                              className="w-full bg-black/20 border-b border-white/10 px-0 py-2 text-sm outline-none focus:border-gold transition-all"
                              placeholder="Free cancellation, bottled water provided"
                            />
                          </div>
                        </div>
                      </div>
                    ))}

                    {(!editingOffer?.fleets || editingOffer.fleets.length === 0) && (
                      <div className="py-8 text-center bg-white/5 border border-dashed border-white/5 rounded-2xl">
                        <p className="text-white/20 text-[10px] italic">No fleets added yet. click "Add Fleet" to define vehicle specific rates.</p>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Overall Description</label>
                  <textarea
                    value={editingOffer?.description || ''}
                    onChange={(e) => setEditingOffer({ ...editingOffer, description: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all h-24 custom-scrollbar"
                    placeholder="Exclusive fixed rate transfer between Melbourne Airport and the CBD."
                  />
                </div>

                <div className="flex items-center gap-4 py-4 border-t border-white/5">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className={cn("w-5 h-5 rounded border flex items-center justify-center transition-all", editingOffer?.active ? "bg-gold border-gold" : "border-white/20 group-hover:border-gold")}>
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={editingOffer?.active || false}
                        onChange={(e) => setEditingOffer({ ...editingOffer, active: e.target.checked })}
                      />
                      {editingOffer?.active && <CheckCircle size={14} className="text-black" />}
                    </div>
                    <span className="text-xs font-bold uppercase tracking-widest text-white/60">Active Deal</span>
                  </label>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => setShowOfferModal(false)}
                    className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest border border-white/10 rounded-2xl text-white/40 hover:text-white hover:border-white/20 transition-all"
                  >
                    Discard Changes
                  </button>
                  <button
                    onClick={() => handleUpdateOffer(editingOffer.id || 'new', editingOffer)}
                    className="flex-1 bg-gold text-black py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all shadow-xl shadow-gold/10"
                  >
                    {editingOffer?.id ? 'Update Package' : 'Publish Offer'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Tour Modal */}
        {showTourModal && editingTour && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 backdrop-blur-md z-[100] flex items-center justify-center p-4 md:p-6"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-5xl glass-heavy p-0 rounded-2xl border border-gold/20 overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-6 border-b border-white/5 flex justify-between items-center bg-black/50">
                <div>
                  <h3 className="text-xl font-display text-gold">
                    {editingTour.id ? 'Edit Luxury Tour' : 'Create New Collection'}
                  </h3>
                  <p className="text-[8px] uppercase tracking-[0.3em] text-white/30 font-bold mt-1">Refined Sightseeing Management</p>
                </div>
                <button onClick={() => setShowTourModal(false)} className="text-white/40 hover:text-white bg-white/5 p-2 rounded-full transition-all">
                  <X size={20} />
                </button>
              </div>

              {/* Tabs Navigation */}
              <div className="flex bg-black/30 border-b border-white/5 px-6">
                {[
                  { id: 'general', label: 'General', icon: Info },
                  { id: 'content', label: 'Content', icon: LayoutGrid },
                  { id: 'pricing', label: 'Pricing & Fleets', icon: DollarSign },
                  { id: 'itinerary', label: 'Itinerary', icon: MapPin },
                  { id: 'marketing', label: 'Marketing', icon: Tag }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setTourActiveTab(tab.id as any)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 text-[10px] uppercase font-bold tracking-widest border-b-2 transition-all shrink-0",
                      tourActiveTab === tab.id ? "text-gold border-gold bg-gold/5" : "text-white/30 border-transparent hover:text-white/60"
                    )}
                  >
                    <tab.icon size={14} />
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-[#020202]">
                <div className="max-w-4xl mx-auto space-y-10">

                  {tourActiveTab === 'general' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-3 block">Tour Name</label>
                          <input
                            type="text"
                            value={editingTour.title || ''}
                            onChange={(e) => setEditingTour({ ...editingTour, title: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-sm outline-none focus:border-gold transition-all"
                            placeholder="Great Ocean Road Private Tour"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-3 block">Slug (Custom URL)</label>
                          <input
                            type="text"
                            value={editingTour.slug || ''}
                            onChange={(e) => setEditingTour({ ...editingTour, slug: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-sm outline-none focus:border-gold transition-all font-mono text-[10px]"
                            placeholder="great-ocean-road-private"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-3 block">Featured Image URL (Display Header)</label>
                        <div className="relative group">
                          <input
                            type="text"
                            value={editingTour.image || ''}
                            onChange={(e) => setEditingTour({ ...editingTour, image: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-[10px] font-mono outline-none focus:border-gold transition-all"
                            placeholder="https://images.unsplash.com/photo..."
                          />
                          {editingTour.image && (
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg overflow-hidden border border-white/20">
                              <img src={editingTour.image} className="w-full h-full object-cover" />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-3 block">Duration</label>
                          <input type="text" value={editingTour.duration || ''} onChange={(e) => setEditingTour({ ...editingTour, duration: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-sm" placeholder="12 Hours" />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-3 block">Max People</label>
                          <input type="number" value={editingTour.maxPeople || ''} onChange={(e) => setEditingTour({ ...editingTour, maxPeople: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-sm" placeholder="7" />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-3 block">Age Range</label>
                          <input type="text" value={editingTour.ageRange || ''} onChange={(e) => setEditingTour({ ...editingTour, ageRange: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-sm" placeholder="Any Age" />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-3 block">Start Place</label>
                          <input type="text" value={editingTour.startPlace || ''} onChange={(e) => setEditingTour({ ...editingTour, startPlace: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-sm" placeholder="Melbourne CBD" />
                        </div>
                      </div>

                      <div className="p-6 bg-gold/5 border border-gold/10 rounded-2xl flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-bold text-gold uppercase tracking-widest">Active Status</h4>
                          <p className="text-[10px] text-white/40 mt-1">Determine if this tour is visible to customers in their dashboard.</p>
                        </div>
                        <button
                          onClick={() => setEditingTour({ ...editingTour, active: !editingTour.active })}
                          className={cn("w-12 h-6 rounded-full transition-all relative", editingTour.active ? "bg-gold" : "bg-white/10")}
                        >
                          <div className={cn("absolute top-1 w-4 h-4 rounded-full bg-white transition-all", editingTour.active ? "right-1" : "left-1")} />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-3 block">Availability (Start Date)</label>
                          <input type="date" value={editingTour.availability?.startDate || ''} onChange={(e) => setEditingTour({ ...editingTour, availability: { ...editingTour.availability, startDate: e.target.value } })} className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-sm text-white/60 outline-none" />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-3 block">Availability (End Date)</label>
                          <input type="date" value={editingTour.availability?.endDate || ''} onChange={(e) => setEditingTour({ ...editingTour, availability: { ...editingTour.availability, endDate: e.target.value } })} className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-sm text-white/60 outline-none" />
                        </div>
                      </div>
                    </div>
                  )}

                  {tourActiveTab === 'content' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                      <div>
                        <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-3 block">Short Summary (Featured Excerpt)</label>
                        <textarea
                          value={editingTour.shortDescription || ''}
                          onChange={(e) => setEditingTour({ ...editingTour, shortDescription: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-sm outline-none focus:border-gold transition-all h-24 resize-none"
                          placeholder="Brief 1-2 sentence overview..."
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-3 block">Full Experience Details</label>
                        <textarea
                          value={editingTour.fullDescription || ''}
                          onChange={(e) => setEditingTour({ ...editingTour, fullDescription: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-sm outline-none focus:border-gold transition-all h-48 resize-none"
                          placeholder="Comprehensive description of the tour..."
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-3 block flex items-center justify-between">
                            Inclusions
                            <button onClick={() => setEditingTour({ ...editingTour, inclusions: [...(editingTour.inclusions || []), ""] })} className="text-gold hover:text-white transition-colors"><Plus size={14} /></button>
                          </label>
                          <div className="space-y-2">
                            {(editingTour.inclusions || []).map((inc: string, idx: number) => (
                              <div key={`inc-${idx}`} className="flex items-center gap-2">
                                <input type="text" value={inc} onChange={(e) => {
                                  const n = [...editingTour.inclusions];
                                  n[idx] = e.target.value;
                                  setEditingTour({ ...editingTour, inclusions: n });
                                }} className="flex-1 bg-white/5 border border-white/5 rounded-lg px-4 py-2 text-xs" />
                                <button onClick={() => setEditingTour({ ...editingTour, inclusions: editingTour.inclusions.filter((_: any, i: any) => i !== idx) })} className="text-white/20 hover:text-red-500"><Trash2 size={14} /></button>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-3 block flex items-center justify-between">
                            Exclusions
                            <button onClick={() => setEditingTour({ ...editingTour, exclusions: [...(editingTour.exclusions || []), ""] })} className="text-gold hover:text-white transition-colors"><Plus size={14} /></button>
                          </label>
                          <div className="space-y-2">
                            {(editingTour.exclusions || []).map((exc: string, idx: number) => (
                              <div key={`exc-${idx}`} className="flex items-center gap-2">
                                <input type="text" value={exc} onChange={(e) => {
                                  const n = [...editingTour.exclusions];
                                  n[idx] = e.target.value;
                                  setEditingTour({ ...editingTour, exclusions: n });
                                }} className="flex-1 bg-white/5 border border-white/5 rounded-lg px-4 py-2 text-xs" />
                                <button onClick={() => setEditingTour({ ...editingTour, exclusions: editingTour.exclusions.filter((_: any, i: any) => i !== idx) })} className="text-white/20 hover:text-red-500"><Trash2 size={14} /></button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-3 block flex items-center justify-between">
                            Highlights & Activities
                            <button onClick={() => setEditingTour({ ...editingTour, activities: [...(editingTour.activities || []), ""] })} className="text-gold hover:text-white transition-colors"><Plus size={14} /></button>
                          </label>
                          <div className="space-y-2">
                            {(editingTour.activities || []).map((act: string, idx: number) => (
                              <div key={`act-${idx}-${act.slice(0, 5)}`} className="flex items-center gap-2">
                                <input type="text" value={act} onChange={(e) => {
                                  const n = [...editingTour.activities];
                                  n[idx] = e.target.value;
                                  setEditingTour({ ...editingTour, activities: n });
                                }} className="flex-1 bg-white/5 border border-white/5 rounded-lg px-4 py-2 text-xs" />
                                <button onClick={() => setEditingTour({ ...editingTour, activities: editingTour.activities.filter((_: any, i: any) => i !== idx) })} className="text-white/20 hover:text-red-500"><Trash2 size={14} /></button>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-3 block flex items-center justify-between">
                            Places To Visit
                            <button onClick={() => setEditingTour({ ...editingTour, placesToVisit: [...(editingTour.placesToVisit || []), ""] })} className="text-gold hover:text-white transition-colors"><Plus size={14} /></button>
                          </label>
                          <div className="space-y-2">
                            {(editingTour.placesToVisit || []).map((pl: string, idx: number) => (
                              <div key={`pl-${idx}-${pl.slice(0, 5)}`} className="flex items-center gap-2">
                                <input type="text" value={pl} onChange={(e) => {
                                  const n = [...editingTour.placesToVisit];
                                  n[idx] = e.target.value;
                                  setEditingTour({ ...editingTour, placesToVisit: n });
                                }} className="flex-1 bg-white/5 border border-white/5 rounded-lg px-4 py-2 text-xs" />
                                <button onClick={() => setEditingTour({ ...editingTour, placesToVisit: editingTour.placesToVisit.filter((_: any, i: any) => i !== idx) })} className="text-white/20 hover:text-red-500"><Trash2 size={14} /></button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {tourActiveTab === 'pricing' && (
                    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
                      <div>
                        <div className="flex justify-between items-center mb-6">
                          <h4 className="text-xs font-bold text-gold uppercase tracking-widest">Fleet Specific Pricing</h4>
                          <button onClick={() => setEditingTour({ ...editingTour, fleets: [...(editingTour.fleets || []), { id: Date.now().toString(36), name: '', category: 'luxury', standardPrice: 0, salePrice: 0 }] })} className="btn-primary px-4 py-2 text-[8px]">
                            Add Custom Vehicle
                          </button>
                        </div>
                        <div className="space-y-4">
                          {(editingTour.fleets || []).map((f: any, idx: number) => (
                            <div key={f.id || idx} className="bg-white/5 border border-white/10 rounded-2xl p-6 relative group/row hover:border-gold/30 transition-all">
                              <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                <button onClick={() => { const n = [...editingTour.fleets]; n.splice(idx + 1, 0, { ...f, id: Date.now().toString(36) }); setEditingTour({ ...editingTour, fleets: n }); }} className="text-white/20 hover:text-gold transition-colors">
                                  <Copy size={16} />
                                </button>
                                <button onClick={() => setEditingTour({ ...editingTour, fleets: editingTour.fleets.filter((_: any, i: any) => i !== idx) })} className="text-white/20 hover:text-red-500 transition-colors">
                                  <Trash2 size={16} />
                                </button>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-4">
                                <div className="md:col-span-2">
                                  <label className="text-[8px] uppercase tracking-widest font-bold text-white/30 mb-2 block">Vehicle Name / Custom Identity</label>
                                  <div className="flex gap-2">
                                    <div className="flex-1 relative">
                                      <input
                                        type="text"
                                        value={f.name}
                                        onChange={(e) => {
                                          const n = [...editingTour.fleets]; n[idx].name = e.target.value;
                                          setEditingTour({ ...editingTour, fleets: n });
                                        }}
                                        className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-xs focus:border-gold outline-none"
                                        placeholder="e.g. Vintage Limousine"
                                      />
                                      <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none">
                                        <ChevronDown size={12} />
                                      </div>
                                    </div>
                                    <select
                                      onChange={(e) => {
                                        const n = [...editingTour.fleets];
                                        const v = fleet.find(item => item.name === e.target.value);
                                        if (v) {
                                          n[idx].name = v.name;
                                          n[idx].image = v.img;
                                          n[idx].category = v.category || 'luxury';
                                        }
                                        setEditingTour({ ...editingTour, fleets: n });
                                      }}
                                      className="w-12 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center text-[8px] custom-select"
                                    >
                                      <option value="">+</option>
                                      {fleet.map((v, i) => <option key={`${v.id || 'vehicle'}-${v.name || 'unnamed'}-${i}`} value={v.name}>{v.name}</option>)}
                                    </select>
                                  </div>
                                </div>
                                <div>
                                  <label className="text-[8px] uppercase tracking-widest font-bold text-white/30 mb-2 block">Category</label>
                                  <select
                                    value={f.category || 'luxury'}
                                    onChange={(e) => {
                                      const n = [...editingTour.fleets]; n[idx].category = e.target.value;
                                      setEditingTour({ ...editingTour, fleets: n });
                                    }}
                                    className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-[10px] custom-select focus:border-gold outline-none"
                                  >
                                    <option value="luxury">Luxury Estate</option>
                                    <option value="suv">Executive SUV</option>
                                    <option value="sedan">VIP Sedan</option>
                                    <option value="van">People Mover</option>
                                    <option value="classic">Classic / Vintage</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="text-[8px] uppercase tracking-widest font-bold text-white/30 mb-2 block">Passengers</label>
                                  <input type="text" value={f.passengers || ''} onChange={(e) => { const n = [...editingTour.fleets]; n[idx].passengers = e.target.value; setEditingTour({ ...editingTour, fleets: n }); }} className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-xs" placeholder="e.g. 3 Guests" />
                                </div>
                                <div>
                                  <label className="text-[8px] uppercase tracking-widest font-bold text-white/30 mb-2 block">Luggage</label>
                                  <input type="text" value={f.luggage || ''} onChange={(e) => { const n = [...editingTour.fleets]; n[idx].luggage = e.target.value; setEditingTour({ ...editingTour, fleets: n }); }} className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-xs" placeholder="e.g. 2 Large" />
                                </div>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <div>
                                  <label className="text-[8px] uppercase tracking-widest font-bold text-white/30 mb-2 block">Std Price ($)</label>
                                  <input type="number" value={f.standardPrice} onChange={(e) => { const n = [...editingTour.fleets]; n[idx].standardPrice = e.target.value; setEditingTour({ ...editingTour, fleets: n }); }} className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-xs" />
                                </div>
                                <div>
                                  <label className="text-[8px] uppercase tracking-widest font-bold text-white/30 mb-2 block">Sale Price ($)</label>
                                  <input type="number" value={f.salePrice} onChange={(e) => { const n = [...editingTour.fleets]; n[idx].salePrice = e.target.value; setEditingTour({ ...editingTour, fleets: n }); }} className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-xs" />
                                </div>
                                <div className="md:col-span-2">
                                  <label className="text-[8px] uppercase tracking-widest font-bold text-white/30 mb-2 block">Additional Info</label>
                                  <input type="text" value={f.additionalInfo || ''} onChange={(e) => { const n = [...editingTour.fleets]; n[idx].additionalInfo = e.target.value; setEditingTour({ ...editingTour, fleets: n }); }} className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-xs" placeholder="e.g. Free Wifi, Water included" />
                                </div>
                                <div className="md:col-span-4">
                                  <label className="text-[8px] uppercase tracking-widest font-bold text-white/30 mb-2 block">Image URL (Override)</label>
                                  <input type="text" value={f.image || ''} onChange={(e) => { const n = [...editingTour.fleets]; n[idx].image = e.target.value; setEditingTour({ ...editingTour, fleets: n }); }} className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-[10px] font-mono text-white/30" placeholder="https://..." />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="border-t border-white/5 pt-12">
                        <div className="flex justify-between items-center mb-6">
                          <h4 className="text-xs font-bold text-gold uppercase tracking-widest">Optional Tour Extras</h4>
                          <button onClick={() => setEditingTour({ ...editingTour, extras: [...(editingTour.extras || []), { id: Date.now().toString(36), name: '', description: '', price: 0, availableCount: 1 }] })} className="btn-primary px-4 py-2 text-[8px]">
                            Add Extra Service
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {(editingTour.extras || []).map((e: any, idx: number) => (
                            <div key={e.id || idx} className="bg-white/5 border border-white/5 rounded-2xl p-6 relative group/extra">
                              <button onClick={() => setEditingTour({ ...editingTour, extras: editingTour.extras.filter((_: any, i: any) => i !== idx) })} className="absolute top-4 right-4 text-white/20 hover:text-red-500 opacity-0 group-hover/extra:opacity-100 transition-all">
                                <Trash2 size={14} />
                              </button>
                              <div className="space-y-4">
                                <input type="text" value={e.name} onChange={(ev) => { const n = [...editingTour.extras]; n[idx].name = ev.target.value; setEditingTour({ ...editingTour, extras: n }); }} className="w-full bg-transparent border-b border-white/10 text-xs font-bold py-1 focus:border-gold outline-none" placeholder="Extra Name" />
                                <input type="text" value={e.description} onChange={(ev) => { const n = [...editingTour.extras]; n[idx].description = ev.target.value; setEditingTour({ ...editingTour, extras: n }); }} className="w-full bg-transparent border-b border-white/5 text-[10px] text-white/40 py-1 focus:border-gold outline-none" placeholder="Short Description" />
                                <div className="flex gap-4">
                                  <div className="flex-1">
                                    <label className="text-[8px] uppercase tracking-widest font-bold text-white/20 mb-1 block">Price ($)</label>
                                    <input type="number" value={e.price} onChange={(ev) => { const n = [...editingTour.extras]; n[idx].price = ev.target.value; setEditingTour({ ...editingTour, extras: n }); }} className="w-full bg-black border border-white/5 rounded px-2 py-1 text-[10px]" />
                                  </div>
                                  <div className="flex-1">
                                    <label className="text-[8px] uppercase tracking-widest font-bold text-white/20 mb-1 block">Available</label>
                                    <input type="number" value={e.availableCount} onChange={(ev) => { const n = [...editingTour.extras]; n[idx].availableCount = ev.target.value; setEditingTour({ ...editingTour, extras: n }); }} className="w-full bg-black border border-white/5 rounded px-2 py-1 text-[10px]" />
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {tourActiveTab === 'itinerary' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                      <div className="flex justify-between items-center bg-white/5 p-6 rounded-2xl border border-gold/10">
                        <div>
                          <h4 className="text-xs font-bold text-gold uppercase tracking-widest">Itinerary Builder</h4>
                          <p className="text-[10px] text-white/40 mt-1">Structure the tour sequence day-by-day or step-by-step.</p>
                        </div>
                        <button onClick={() => setEditingTour({ ...editingTour, itinerary: [...(editingTour.itinerary || []), { id: Date.now().toString(36), name: '', details: '', order: (editingTour.itinerary || []).length }] })} className="btn-primary px-6 py-2 text-[10px]">
                          Add New Step
                        </button>
                      </div>

                      <div className="space-y-6 relative before:absolute before:left-8 before:top-0 before:bottom-0 before:w-px before:bg-gradient-to-b before:from-gold/50 before:via-gold/10 before:to-transparent">
                        {[...(editingTour.itinerary || [])].sort((a: any, b: any) => (a.order || 0) - (b.order || 0)).map((step: any, idx: number) => {
                          const origIdx = (editingTour.itinerary || []).findIndex((item: any) => item.id === step.id);
                          return (
                            <div key={step.id || `itinerary-${idx}`} className="relative pl-16 group/step">
                              <div className="absolute left-6 top-1 w-4 h-4 rounded-full bg-gold/20 border-2 border-gold flex items-center justify-center z-10">
                                <div className="w-1.5 h-1.5 rounded-full bg-gold" />
                              </div>
                              <div className="bg-white/5 border border-white/5 rounded-2xl p-6 hover:border-gold/20 transition-all">
                                <div className="flex justify-between items-start mb-4">
                                  <div className="flex-1">
                                    <input type="text" value={step.name} onChange={(e) => { const n = [...editingTour.itinerary]; if (origIdx !== -1) { n[origIdx].name = e.target.value; setEditingTour({ ...editingTour, itinerary: n }); } }} className="w-full bg-transparent border-b border-white/10 text-sm font-bold py-1 focus:border-gold outline-none mb-4" placeholder="Day Title or Step Name" />
                                    <textarea value={step.details} onChange={(e) => { const n = [...editingTour.itinerary]; if (origIdx !== -1) { n[origIdx].details = e.target.value; setEditingTour({ ...editingTour, itinerary: n }); } }} className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-xs h-32 resize-none outline-none focus:border-gold" placeholder="Experience details (HTML supported)..." />
                                  </div>
                                  <div className="flex flex-col gap-2 ml-6">
                                    <button onClick={() => { const n = [...editingTour.itinerary]; if (origIdx !== -1) { n.splice(origIdx + 1, 0, { ...step, id: Date.now().toString(36), order: String(Number(step.order) + 1) }); setEditingTour({ ...editingTour, itinerary: n }); } }} className="text-white/20 hover:text-gold"><Copy size={16} /></button>
                                    <button onClick={() => { if (origIdx !== -1) { setEditingTour({ ...editingTour, itinerary: editingTour.itinerary.filter((_: any, i: any) => i !== origIdx) }); } }} className="text-white/20 hover:text-red-500"><Trash2 size={16} /></button>
                                    <input type="number" value={step.order} onChange={(e) => { const n = [...editingTour.itinerary]; if (origIdx !== -1) { n[origIdx].order = e.target.value; setEditingTour({ ...editingTour, itinerary: n }); } }} className="w-10 bg-black/50 border border-white/10 rounded h-10 flex items-center justify-center text-[10px] text-center font-bold" />
                                  </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <label className="text-[8px] uppercase tracking-widest font-bold text-white/30 mb-2 block">Step Image URL (Optional)</label>
                                    <input type="text" value={step.image || ''} onChange={(e) => { const n = [...editingTour.itinerary]; if (origIdx !== -1) { n[origIdx].image = e.target.value; setEditingTour({ ...editingTour, itinerary: n }); } }} className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-[10px] font-mono text-white/30" placeholder="https://..." />
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {tourActiveTab === 'marketing' && (
                    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="space-y-8">
                          <div>
                            <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-3 block">Promo Tag (Ribbon)</label>
                            <input type="text" value={editingTour.promoTag || ''} onChange={(e) => setEditingTour({ ...editingTour, promoTag: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-gold outline-none" placeholder="e.g. Popular, Best Value, 20% OFF" />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-3 block">Category</label>
                            <select value={editingTour.category || ''} onChange={(e) => setEditingTour({ ...editingTour, category: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm custom-select focus:border-gold outline-none">
                              <option value="">Select Category</option>
                              <option value="luxury">Luxury Estate</option>
                              <option value="wine">Wine & Dine</option>
                              <option value="sightseeing">Sightseeing</option>
                              <option value="private">Private VIP</option>
                              <option value="nature">Nature & Wild</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-3 block">Gallery Images (One per line)</label>
                            <textarea
                              value={Array.isArray(editingTour.gallery) ? editingTour.gallery.join('\n') : (editingTour.gallery || '')}
                              onChange={(e) => setEditingTour({ ...editingTour, gallery: e.target.value.split('\n').filter(s => s.trim() !== '') })}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[10px] font-mono h-40 resize-none focus:border-gold outline-none"
                              placeholder="https://image1.jpg&#10;https://image2.jpg"
                            />
                            {editingTour.gallery && editingTour.gallery.length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-3">
                                {editingTour.gallery.map((img: string, i: number) => (
                                  <div key={i} className="w-12 h-12 rounded bg-black border border-white/10 overflow-hidden relative" title={img}>
                                    {img.startsWith('http') ? (
                                      <img src={img} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-[8px] text-white/20 font-bold overflow-hidden px-1 break-all">Err</div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-6">
                          <h4 className="text-xs font-bold text-gold uppercase tracking-widest flex items-center justify-between">
                            Tour FAQs
                            <button onClick={() => setEditingTour({ ...editingTour, faqs: [...(editingTour.faqs || []), { id: Date.now().toString(36), question: '', answer: '' }] })} className="text-gold hover:text-white"><Plus size={16} /></button>
                          </h4>
                          <div className="space-y-4">
                            {(editingTour.faqs || []).map((faq: any, idx: number) => (
                              <div key={faq.id || `faq-${idx}`} className="bg-white/5 border border-white/5 rounded-2xl p-4 relative">
                                <button onClick={() => setEditingTour({ ...editingTour, faqs: editingTour.faqs.filter((_: any, i: any) => i !== idx) })} className="absolute top-2 right-2 text-white/10 hover:text-red-500 transition-all"><X size={14} /></button>
                                <input type="text" value={faq.question} onChange={(e) => { const n = [...editingTour.faqs]; n[idx].question = e.target.value; setEditingTour({ ...editingTour, faqs: n }); }} className="w-full bg-transparent border-b border-white/10 text-xs font-bold py-1 mb-2 outline-none" placeholder="Question" />
                                <textarea value={faq.answer} onChange={(e) => { const n = [...editingTour.faqs]; n[idx].answer = e.target.value; setEditingTour({ ...editingTour, faqs: n }); }} className="w-full bg-black/40 border border-white/5 rounded p-2 text-[10px] h-20 resize-none outline-none" placeholder="Detailed answer..." />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-white/5 pt-10">
                        <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-3 block">Mandatory Customer Note (Booking Requirements)</label>
                        <textarea value={editingTour.customerNote || ''} onChange={(e) => setEditingTour({ ...editingTour, customerNote: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs h-24 resize-none outline-none focus:border-gold transition-all" placeholder="e.g. Please bring comfortable walking shoes and a windbreaker." />
                      </div>
                    </div>
                  )}

                </div>
              </div>

              <div className="p-8 border-t border-white/5 bg-black/50 flex gap-4">
                <button
                  onClick={() => setShowTourModal(false)}
                  className="flex-1 py-4 text-[10px] font-bold uppercase tracking-[0.2em] border border-white/10 rounded-xl text-white/40 hover:text-white hover:bg-white/5 transition-all"
                >
                  Discard Changes
                </button>
                <button
                  onClick={() => handleUpdateTour(editingTour.id || 'new', editingTour)}
                  className="flex-[2] bg-gold text-black py-4 rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-white transition-all shadow-[0_0_20px_rgba(212,175,55,0.2)]"
                >
                  {editingTour.id ? 'Authorize & Sync Changes' : 'Initialize Luxury Tour'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* CSV Import Modal */}
        {showCsvImportModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-xl glass p-8 rounded-3xl border border-gold/20"
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gold/10 rounded-lg">
                    <Upload size={20} className="text-gold" />
                  </div>
                  <div>
                    <h3 className="text-xl font-display text-gold">Import {csvImportType === 'offers' ? 'Offers' : 'Tours'}</h3>
                    <p className="text-white/40 text-[10px] uppercase tracking-widest font-bold">Bulk upload via CSV</p>
                  </div>
                </div>
                <button onClick={() => setShowCsvImportModal(false)} className="text-white/40 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                {/* Drag & Drop Area */}
                <div
                  onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); }}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); }}
                  onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragActive(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleCsvUpload(csvImportType, e.dataTransfer.files[0]);
                    }
                  }}
                  className={cn(
                    "relative py-8 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-all duration-300", // reduced py-12 → py-8
                    dragActive
                      ? "border-gold bg-gold/5 scale-[1.02]"
                      : "border-white/10 bg-white/5 hover:border-gold/30"
                  )}
                >
                  <input
                    type="file"
                    accept=".csv"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleCsvUpload(csvImportType, e.target.files[0]);
                      }
                    }}
                  />
                  <div
                    className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-transform duration-500", // reduced w-16 h-16 → w-12 h-12
                      dragActive ? "bg-gold text-black scale-110 rotate-12" : "bg-white/10 text-gold"
                    )}
                  >
                    {isUploadingCsv ? (
                      <RefreshCw size={24} className="animate-spin" />
                    ) : (
                      <Upload size={24} />
                    )}
                  </div>
                  <p className="text-sm font-bold text-white mb-1">
                    {isUploadingCsv ? 'Uploading...' : 'Drop your CSV here'}
                  </p>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">
                    or click to browse files
                  </p>
                </div>

                {/* Format Sample */}
                <div className="bg-white/5 border border-white/5 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Info size={14} className="text-gold" />
                      <span className="text-[10px] uppercase tracking-widest font-black text-white/60">Required CSV Format</span>
                    </div>
                    <a
                      href={csvImportType === 'offers' ? '/assets/csv/sample-offers.csv' : '/assets/csv/sample-tours.csv'}
                      download
                      className="bg-gold/10 hover:bg-gold hover:text-black text-gold px-3 py-1.5 rounded text-[9px] uppercase tracking-widest font-black transition-all flex items-center gap-1.5"
                    >
                      <Download size={12} /> Download Sample CSV
                    </a>
                  </div>
                  <div className="overflow-x-auto custom-scrollbar border border-white/10 rounded-xl bg-black/40">
                    <table className="w-full border-collapse text-[9px] text-left">
                      <thead>
                        <tr className="bg-gold/10 border-b border-gold/20">
                          {(csvImportType === 'offers'
                            ? ['title', 'description', 'image', 'active', 'tags', 'discounttype', 'discountvalue', 'fleets_data']
                            : ['title', 'image', 'duration', 'maxPeople', 'ageRange', 'startPlace', 'active', 'availabilityStartDate', 'availabilityEndDate', 'shortDescription', 'fullDescription', 'gallery', 'inclusions', 'exclusions', 'activities', 'placesToVisit', 'tags', 'fleets', 'extras', 'itinerary', 'faqs', 'promoTag', 'category', 'customerNote']
                          ).map((h) => (
                            <th key={h} className="px-3 py-2 text-gold font-black uppercase tracking-widest border-r border-gold/10 last:border-0 whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="bg-white/[0.02]">
                          {(csvImportType === 'offers'
                            ? ['Autumn Special', 'Experience our autumn special.', 'https://...', 'true', 'Seasonal|Featured', 'percentage', '25', 'Sedan|url|Desc|3|2|150|Free Wi-Fi']
                            : ['Wine Tour', 'https://...', '8 Hours', '6', 'Adults', 'CBD', 'true', '2024-01-01', '2024-12-31', 'Short summary.', 'Long text...', 'url1|url2', 'Lunch|Tasting', 'Tips', 'Tasting', 'Valley', 'Luxury', 'Sedan|url|3|2|150|120|Info', 'Photos|Pro|150|10', 'Stop 1|img|desc', 'Q|A', 'Best Seller', 'Wine', 'Note']
                          ).map((v, i) => (
                            <td key={i} className="px-3 py-2 text-white/50 font-mono border-r border-white/5 last:border-0 whitespace-nowrap italic">
                              {v}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[9px] text-white/30 mt-3 italic text-left">
                    * Use ';' for major separations (e.g. lists of fleets or extras) and '|' for internal attributes. Review the sample CSV for exact formatting.
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default OffersToursTab;
