import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Search, X, Plus, Users, Copy, Trash2, Luggage, Save, Loader2, Sparkles, Upload, Code2, Eye, Power,
  Cog, List, MessageSquare, Send, Mail, Download, FileUp, AlertCircle, FileJson, CheckCircle2, Check, Pencil,
  LayoutGrid, ChevronDown, Car, Percent
} from 'lucide-react';
import { GoogleMap, useJsApiLoader, Rectangle, Autocomplete } from '@react-google-maps/api';
import { GOOGLE_MAPS_LIBRARIES, GOOGLE_MAPS_ID } from '../../lib/google-maps';
import { cn } from '../../lib/utils';
import { FormNotice } from '../FormNotice';
import ConfirmationModal from './ConfirmationModal';
import { db, handleFirestoreError, storage, OperationType } from '../../lib/firebase';
import { collection, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, setDoc, getDoc, getDocs, writeBatch, query, orderBy, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject, uploadBytesResumable } from 'firebase/storage';

const GOOGLE_MAPS_API_KEY =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
  import.meta.env.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (process.env as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';

interface BBoxMapProps {
  bboxNorth: number;
  bboxSouth: number;
  bboxEast: number;
  bboxWest: number;
  onChange: (bounds: { north: number; south: number; east: number; west: number }) => void;
  bboxes?: Array<{ id: string; name?: string; north: number; south: number; east: number; west: number }>;
  onBBoxesChange?: (bboxes: Array<{ id: string; name?: string; north: number; south: number; east: number; west: number }>) => void;
}

const BBoxMap: React.FC<BBoxMapProps> = ({ bboxNorth, bboxSouth, bboxEast, bboxWest, onChange, bboxes, onBBoxesChange }) => {
  const { isLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_ID,
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const rectRef = useRef<google.maps.Rectangle | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [csvInput, setCsvInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [locationName, setLocationName] = useState('');
  const [editingBoxId, setEditingBoxId] = useState<string | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  // Sync CSV input with props if the user is not actively typing
  useEffect(() => {
    if (inputRef.current && document.activeElement === inputRef.current) {
      return;
    }
    if (bboxNorth || bboxSouth || bboxEast || bboxWest) {
      setCsvInput(`${bboxWest || 0},${bboxSouth || 0},${bboxEast || 0},${bboxNorth || 0}`);
    } else {
      setCsvInput('');
    }
  }, [bboxNorth, bboxSouth, bboxEast, bboxWest]);

  // Sync map center and bounds
  useEffect(() => {
    if (map && bboxNorth && bboxSouth && bboxEast && bboxWest) {
      const bounds = new google.maps.LatLngBounds(
        { lat: bboxSouth, lng: bboxWest },
        { lat: bboxNorth, lng: bboxEast }
      );
      map.fitBounds(bounds);
    }
  }, [map, bboxNorth, bboxSouth, bboxEast, bboxWest]);

  if (!isLoaded) {
    return (
      <div className="h-44 flex items-center justify-center bg-white/5 rounded-xl border border-white/10">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-5 h-5 text-gold animate-spin" />
          <p className="text-[10px] uppercase text-white/40 tracking-widest font-bold">Loading Interactive Directory Map...</p>
        </div>
      </div>
    );
  }

  const center = {
    lat: (bboxNorth + bboxSouth) / 2 || -37.8136,
    lng: (bboxEast + bboxWest) / 2 || 144.9631,
  };

  const handleBoundsChanged = () => {
    if (rectRef.current) {
      const bounds = rectRef.current.getBounds();
      if (bounds) {
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        const n = Number(ne.lat().toFixed(6));
        const s = Number(sw.lat().toFixed(6));
        const e = Number(ne.lng().toFixed(6));
        const w = Number(sw.lng().toFixed(6));

        // Only fire changes if boundaries changed significantly to avoid infinite state cycles
        if (
          Math.abs(n - bboxNorth) > 0.0001 ||
          Math.abs(s - bboxSouth) > 0.0001 ||
          Math.abs(e - bboxEast) > 0.0001 ||
          Math.abs(w - bboxWest) > 0.0001
        ) {
          onChange({ north: n, south: s, east: e, west: w });
        }
      }
    }
  };

  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    const halfSize = 0.025; // Create a neat starting bounding box size of ~5km around clicking coordinate
    onChange({
      north: Number((lat + halfSize).toFixed(6)),
      south: Number((lat - halfSize).toFixed(6)),
      east: Number((lng + halfSize).toFixed(6)),
      west: Number((lng - halfSize).toFixed(6)),
    });
  };

  const handleCSVChange = (val: string) => {
    setCsvInput(val);
    const parts = val.split(',').map(s => parseFloat(s.trim()));
    if (parts.length === 4 && parts.every(p => !isNaN(p))) {
      const isLat = (num: number) => num >= -90 && num <= 90;
      let west = parts[0], south = parts[1], east = parts[2], north = parts[3];

      if (isLat(parts[0]) && !isLat(parts[1])) {
        // Format: south, west, north, east
        south = Math.min(parts[0], parts[2]);
        north = Math.max(parts[0], parts[2]);
        west = Math.min(parts[1], parts[3]);
        east = Math.max(parts[1], parts[3]);
      } else if (isLat(parts[1]) && !isLat(parts[0])) {
        // Format: west, south, east, north
        west = Math.min(parts[0], parts[2]);
        east = Math.max(parts[0], parts[2]);
        south = Math.min(parts[1], parts[3]);
        north = Math.max(parts[1], parts[3]);
      } else {
        // Fallback default order: west, south, east, north
        west = Math.min(parts[0], parts[2]);
        east = Math.max(parts[0], parts[2]);
        south = Math.min(parts[1], parts[3]);
        north = Math.max(parts[1], parts[3]);
      }

      onChange({
        north: Number(north.toFixed(6)),
        south: Number(south.toFixed(6)),
        east: Number(east.toFixed(6)),
        west: Number(west.toFixed(6)),
      });
    }
  };

  return (
    <div className="space-y-3 pb-2">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
        <div className="flex flex-col">
          <label className="text-[10px] uppercase tracking-widest font-bold text-gold/80 block">
            Interactive Map Visualizer & Area Editor
          </label>
          <span className="text-[8px] text-white/30 uppercase tracking-wider font-medium">
            Drag handles to resize or click map to move rectangle area
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[9px] uppercase tracking-widest font-bold text-white/40 block">Search Location to Auto-Draw Box</label>
        <Autocomplete
          onLoad={(autocomplete) => {
            autocompleteRef.current = autocomplete;
          }}
          onPlaceChanged={() => {
            if (autocompleteRef.current) {
              const place = autocompleteRef.current.getPlace();
              if (place.geometry) {
                const loc = place.geometry.location;
                const vp = place.geometry.viewport;
                
                if (vp) {
                  const ne = vp.getNorthEast();
                  const sw = vp.getSouthWest();
                  onChange({
                    north: Number(ne.lat().toFixed(6)),
                    south: Number(sw.lat().toFixed(6)),
                    east: Number(ne.lng().toFixed(6)),
                    west: Number(sw.lng().toFixed(6)),
                  });
                } else if (loc) {
                  const lat = loc.lat();
                  const lng = loc.lng();
                  const halfSize = 0.025;
                  onChange({
                    north: Number((lat + halfSize).toFixed(6)),
                    south: Number((lat - halfSize).toFixed(6)),
                    east: Number((lng + halfSize).toFixed(6)),
                    west: Number((lng - halfSize).toFixed(6)),
                  });
                }
                
                if (place.formatted_address) {
                  setSearchQuery(place.formatted_address);
                  setLocationName(place.name || place.formatted_address.split(',')[0]);
                }
              }
            }
          }}
        >
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Type an address, suburb, or landmark..."
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-8 py-1.5 text-xs outline-none focus:border-gold placeholder:text-white/20 text-white font-sans"
            />
            <Search className="absolute left-2.5 top-2.5 w-3 h-3 text-white/30" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                }}
                className="absolute right-2.5 top-2.5 text-white/30 hover:text-white transition-colors"
                title="Clear Search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </Autocomplete>
      </div>

      <div className="space-y-1.5">
        <label className="text-[9px] uppercase tracking-widest font-bold text-white/40 block">CSV Coordinates (West Lng, South Lat, East Lng, North Lat)</label>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={csvInput}
            onChange={(e) => handleCSVChange(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-gold placeholder:text-white/20 font-mono text-white"
            placeholder="e.g. 144.948048,-37.822807,144.979033,-37.805991"
          />
          {csvInput && (
            <button
              type="button"
              onClick={() => {
                setCsvInput("");
                onChange({ north: 0, south: 0, east: 0, west: 0 });
              }}
              className="px-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/40 hover:text-white transition-all text-xs shrink-0 font-medium uppercase text-[9px] tracking-wider"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="h-75 w-full rounded-xl overflow-hidden border border-white/10 relative">
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={center}
          zoom={10}
          onLoad={(mapInstance) => setMap(mapInstance)}
          onClick={handleMapClick}
          options={{
            styles: [
              { "elementType": "geometry", "stylers": [{ "color": "#212121" }] },
              { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
              { "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
              { "elementType": "labels.text.stroke", "stylers": [{ "color": "#212121" }] },
              { "featureType": "administrative", "elementType": "geometry", "stylers": [{ "color": "#757575" }] },
              { "featureType": "road", "elementType": "geometry.fill", "stylers": [{ "color": "#2c2c2c" }] },
              { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#3c3c3c" }] },
              { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#000000" }] }
            ],
            disableDefaultUI: true,
            zoomControl: true,
          }}
        >
          {bboxNorth !== 0 && bboxSouth !== 0 && bboxEast !== 0 && bboxWest !== 0 && (
            <Rectangle
              onLoad={(r) => { rectRef.current = r; }}
              onBoundsChanged={handleBoundsChanged}
              bounds={{
                north: bboxNorth,
                south: bboxSouth,
                east: bboxEast,
                west: bboxWest,
              }}
              options={{
                draggable: true,
                editable: true,
                fillColor: "#D4AF37",
                fillOpacity: 0.2,
                strokeColor: "#D4AF37",
                strokeOpacity: 0.8,
                strokeWeight: 1.5,
              }}
            />
          )}

          {bboxes && bboxes.map((box, idx) => (
            <Rectangle
              key={box.id || idx}
              bounds={{
                north: box.north,
                south: box.south,
                east: box.east,
                west: box.west,
              }}
              options={{
                draggable: false,
                editable: false,
                fillColor: "#3b82f6",
                fillOpacity: 0.12,
                strokeColor: "#3b82f6",
                strokeOpacity: 0.6,
                strokeWeight: 1.5,
              }}
            />
          ))}
        </GoogleMap>
      </div>

      <div className="space-y-1.5 pt-1">
        <label className="text-[9px] uppercase tracking-widest font-bold text-white/40 block">Active Range Location Name</label>
        <input
          type="text"
          value={locationName}
          onChange={(e) => setLocationName(e.target.value)}
          placeholder="e.g. Melbourne Airport, CBD, Eastern Suburbs, etc."
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-gold placeholder:text-white/20 text-white font-sans"
        />
      </div>

      <div className="pt-2 flex gap-2">
        {editingBoxId ? (
          <>
            <button
              type="button"
              onClick={() => {
                if (bboxNorth && bboxSouth && bboxEast && bboxWest) {
                  const updated = (bboxes || []).map((b) => {
                    if (b.id === editingBoxId) {
                      return {
                        ...b,
                        name: locationName.trim() || b.name || `Range #${(bboxes || []).indexOf(b) + 1}`,
                        north: Number(bboxNorth),
                        south: Number(bboxSouth),
                        east: Number(bboxEast),
                        west: Number(bboxWest),
                      };
                    }
                    return b;
                  });
                  if (onBBoxesChange) onBBoxesChange(updated);
                  
                  // Clear editing state
                  setEditingBoxId(null);
                  setLocationName("");
                  setSearchQuery("");
                }
              }}
              disabled={!bboxNorth || !bboxSouth || !bboxEast || !bboxWest}
              className="flex-1 bg-gold text-black rounded-lg py-2 px-3 text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              Save Range Changes
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingBoxId(null);
                setLocationName("");
                setSearchQuery("");
              }}
              className="px-3 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all border border-white/10"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (bboxNorth && bboxSouth && bboxEast && bboxWest) {
                const nameValue = locationName.trim() || `Range #${(bboxes || []).length + 1}`;
                const newBox = {
                  id: Math.random().toString(36).substring(2, 11),
                  name: nameValue,
                  north: Number(bboxNorth),
                  south: Number(bboxSouth),
                  east: Number(bboxEast),
                  west: Number(bboxWest),
                };
                const alreadyExists = (bboxes || []).some(
                  b => b.north === newBox.north && b.south === newBox.south && b.east === newBox.east && b.west === newBox.west
                );
                if (alreadyExists) return;
                const updated = [...(bboxes || []), newBox];
                if (onBBoxesChange) onBBoxesChange(updated);
                
                // Clear input helper states
                setLocationName("");
                setSearchQuery("");
              }
            }}
            disabled={!bboxNorth || !bboxSouth || !bboxEast || !bboxWest}
            className="w-full bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 rounded-xl py-2 px-3 text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Current Area Map Selection to active ranges ({bboxes?.length || 0} saved)
          </button>
        )}
      </div>

      {bboxes && bboxes.length > 0 && (
        <div className="space-y-2 pt-3 border-t border-white/5">
          <label className="text-[9px] uppercase tracking-widest font-bold text-white/40 block">Saved Bounding Box Ranges ({bboxes.length})</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
            {bboxes.map((box, idx) => {
              const isBoxEditing = editingBoxId === box.id;
              return (
                <div
                  key={box.id || idx}
                  className={cn(
                    "flex items-center justify-between border rounded-xl p-3 gap-2 transition-all duration-300",
                    isBoxEditing
                      ? "bg-gold/5 border-gold/40 shadow-[0_0_12px_rgba(212,175,55,0.1)]"
                      : "bg-white/[0.02] border-white/5 hover:border-white/10"
                  )}
                >
                  <div className="flex flex-col text-[10px] text-white/70 font-mono">
                    <span className="text-[8px] uppercase tracking-widest text-gold font-bold mb-1 block truncate max-w-[180px]" title={box.name || `Range #${idx + 1}`}>
                      {box.name || `Range #${idx + 1}`} {isBoxEditing && "(Editing)"}
                    </span>
                    <span className="text-white/40">West / South limit:</span>
                    <span className="text-white/80">{box.west}, {box.south}</span>
                    <span className="text-white/40 mt-0.5">East / North limit:</span>
                    <span className="text-white/80">{box.east}, {box.north}</span>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingBoxId(box.id);
                        setLocationName(box.name || `Range #${idx + 1}`);
                        onChange({
                          north: box.north,
                          south: box.south,
                          east: box.east,
                          west: box.west,
                        });
                      }}
                      className={cn(
                        "p-1.5 rounded-lg transition-all flex items-center justify-center",
                        isBoxEditing ? "bg-gold text-black-900" : "bg-white/5 hover:bg-white/10 text-white/50 hover:text-white"
                      )}
                      title="Edit this range segment (name & coordinates)"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = (bboxes || []).filter(curr => curr.id !== box.id);
                        if (onBBoxesChange) onBBoxesChange(updated);
                        if (editingBoxId === box.id) {
                          setEditingBoxId(null);
                          setLocationName("");
                        }
                      }}
                      className="p-1.5 bg-red-500/5 hover:bg-red-500/10 rounded-lg text-red-400 hover:text-red-300 transition-all flex items-center justify-center"
                      title="Delete range segment"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const COUNTRIES = [
  { code: '', name: 'No Restriction (Global)' },
  { code: 'AU', name: 'Australia' },
  { code: 'LK', name: 'Sri Lanka' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'CA', name: 'Canada' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'SG', name: 'Singapore' },
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'JP', name: 'Japan' },
  { code: 'QA', name: 'Qatar' },
  { code: 'SA', name: 'Saudi Arabia' }
];

const ALL_COLLECTIONS = [
  { id: 'bookings', label: 'Bookings' },
  { id: 'users', label: 'Users' },
  { id: 'messages', label: 'Inquiries' },
  { id: 'fleet', label: 'Fleet / Vehicles' },
  { id: 'extras', label: 'Extras' },
  { id: 'coupons', label: 'Coupons' },
  { id: 'pages', label: 'Static Pages' },
  { id: 'blogs', label: 'Blog Posts' },
  { id: 'offers', label: 'Special Offers' },
  { id: 'tours', label: 'Tours' },
  { id: 'metadata', label: 'SEO Meta & JSON-LD' },
  { id: 'media', label: 'Media Library' },
  { id: 'faqs', label: 'FAQs' },
  { id: 'comments', label: 'Comments' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'settings', label: 'System Settings' },
  { id: 'sms-templates', label: 'SMS Templates' },
  { id: 'email-templates', label: 'Email Templates' },
  { id: 'smsTemplates', label: 'SMS Templates (Legacy)' },
  { id: 'emailTemplates', label: 'Email Templates (Legacy)' },
  { id: 'price-addons', label: 'Price Add-ons' }
];

interface SettingsTabProps {
  showDashboardNotice: (type: 'success' | 'error' | 'warning' | 'info', message: string, title?: string) => void;
  setConfirmDelete: (config: any) => void;
  exportTotals?: Record<string, number>;
}

const SettingsTab: React.FC<SettingsTabProps> = ({
  showDashboardNotice,
  setConfirmDelete,
  exportTotals: initialExportTotals
}) => {
  const [fleet, setFleet] = useState<any[]>([]);
  const [extras, setExtras] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [priceAddons, setPriceAddons] = useState<any[]>([]);
  const [systemSettings, setSystemSettings] = useState<any>(null);
  const [smsSettings, setSmsSettings] = useState<any>(null);
  const [emailSettings, setEmailSettings] = useState<any>(null);
  const [smsTemplates, setSmsTemplates] = useState<any[]>([]);
  const [emailTemplates, setEmailTemplates] = useState<any[]>([]);
  const [exportTotals, setExportTotals] = useState<Record<string, number>>(initialExportTotals || {});

  useEffect(() => {
    const fleetQ = query(collection(db, 'fleet'), orderBy('name', 'asc'));
    const unsubscribeFleet = onSnapshot(fleetQ, (snapshot) => {
      setFleet(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const extrasQ = query(collection(db, 'extras'), orderBy('name', 'asc'));
    const unsubscribeExtras = onSnapshot(extrasQ, (snapshot) => {
      setExtras(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const couponsQ = query(collection(db, 'coupons'), orderBy('createdAt', 'desc'));
    const unsubscribeCoupons = onSnapshot(couponsQ, (snapshot) => {
      setCoupons(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const priceAddonsQ = query(collection(db, 'price-addons'), orderBy('name', 'asc'));
    const unsubscribePriceAddons = onSnapshot(priceAddonsQ, (snapshot) => {
      setPriceAddons(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'price-addons');
    });

    const unsubscribeSys = onSnapshot(doc(db, 'settings', 'system'), (snap) => {
      if (snap.exists()) setSystemSettings(snap.data());
    });

    const unsubscribeSms = onSnapshot(doc(db, 'settings', 'sms'), (snap) => {
      if (snap.exists()) setSmsSettings(snap.data());
    });

    const unsubscribeEmail = onSnapshot(doc(db, 'settings', 'email'), (snap) => {
      if (snap.exists()) setEmailSettings(snap.data());
    });

    const smsTemplatesQ = query(collection(db, 'sms-templates'), orderBy('name', 'asc'));
    const unsubscribeSmsTemplates = onSnapshot(smsTemplatesQ, (snapshot) => {
      setSmsTemplates(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const emailTemplatesQ = query(collection(db, 'email-templates'), orderBy('name', 'asc'));
    const unsubscribeEmailTemplates = onSnapshot(emailTemplatesQ, (snapshot) => {
      setEmailTemplates(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeFleet();
      unsubscribeExtras();
      unsubscribeCoupons();
      unsubscribePriceAddons();
      unsubscribeSys();
      unsubscribeSms();
      unsubscribeEmail();
      unsubscribeSmsTemplates();
      unsubscribeEmailTemplates();
    };
  }, []);

  useEffect(() => {
    const fetchCounts = async () => {
      const counts: Record<string, number> = {};
      try {
        await Promise.all(
          ALL_COLLECTIONS.map(async (col) => {
            try {
              const collRef = collection(db, col.id);
              const snapshot = await getDocs(collRef);
              counts[col.id] = snapshot.size;
            } catch (err) {
              console.warn(`Error counting collection ${col.id}:`, err);
              counts[col.id] = 0;
            }
          })
        );
        setExportTotals(counts);
      } catch (err) {
        console.error('Error fetching export counts:', err);
      }
    };
    fetchCounts();
  }, []);

  useEffect(() => {
    if (!priceAddons || priceAddons.length === 0) return;
    const todayLocal = new Date().toISOString().split("T")[0];
    priceAddons.forEach(async (addon) => {
      if (addon.active && addon.activeEndDate && todayLocal > addon.activeEndDate) {
        try {
          await updateDoc(doc(db, 'price-addons', addon.id), {
            active: false,
            updatedAt: serverTimestamp()
          });
          showDashboardNotice('warning', `Price add-on "${addon.name}" has been auto-deactivated because its activation validity date range has passed.`, 'Add-on Deactivated');
        } catch (err) {
          console.error("Failed to auto-deactivate expired price addon:", err);
        }
      }
    });
  }, [priceAddons, showDashboardNotice]);

  const [isSeedingTemplates, setIsSeedingTemplates] = useState(false);
  const [isSeedingEmailTemplates, setIsSeedingEmailTemplates] = useState(false);
  const [isTestingSmsId, setIsTestingSmsId] = useState<string | null>(null);
  const [isTestingEmailId, setIsTestingEmailId] = useState<string | null>(null);

  const [fleetSearchQuery, setFleetSearchQuery] = useState('');
  const [editingVehicle, setEditingVehicle] = useState<any>(null);
  const [showVehicleModal, setShowVehicleModal] = useState(false);

  const [extrasSearchQuery, setExtrasSearchQuery] = useState('');
  const [editingExtra, setEditingExtra] = useState<any>(null);
  const [showExtraModal, setShowExtraModal] = useState(false);

  const [couponsSearchQuery, setCouponsSearchQuery] = useState('');
  const [editingCoupon, setEditingCoupon] = useState<any>(null);
  const [showCouponModal, setShowCouponModal] = useState(false);

  const [priceAddonsSearchQuery, setPriceAddonsSearchQuery] = useState('');
  const [editingPriceAddon, setEditingPriceAddon] = useState<any>(null);
  const [showPriceAddonModal, setShowPriceAddonModal] = useState(false);
  const [isSavingPriceAddon, setIsSavingPriceAddon] = useState(false);

  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSavingSmsSettings, setIsSavingSmsSettings] = useState(false);
  const [isSavingEmailSettings, setIsSavingEmailSettings] = useState(false);

  const [editingSmsTemplate, setEditingSmsTemplate] = useState<any>(null);
  const [showSmsTemplateModal, setShowSmsTemplateModal] = useState(false);
  const [isSavingSmsTemplate, setIsSavingSmsTemplate] = useState(false);

  const [editingEmailTemplate, setEditingEmailTemplate] = useState<any>(null);
  const [showEmailTemplateModal, setShowEmailTemplateModal] = useState(false);
  const [isSavingEmailTemplate, setIsSavingEmailTemplate] = useState(false);

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importStats, setImportStats] = useState<any>(null);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [selectedCollectionsForExport, setSelectedCollectionsForExport] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [activeSubSection, setActiveSubSection] = useState<'fleet' | 'extras' | 'coupons' | 'booking' | 'sms' | 'email' | 'backup'>('fleet');

  // Handlers
  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const exportData: any = {};
      let totalDocs = 0;

      for (const colId of selectedCollectionsForExport) {
        const snapshot = await getDocs(collection(db, colId));
        exportData[colId] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        totalDocs += snapshot.docs.length;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_');
      const filename = `Export_Backup_${totalDocs}_Records_${timestamp}.json`;

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showDashboardNotice('success', `Exported ${totalDocs} records successfully`, 'Export Complete');
    } catch (err) {
      console.error('Export error:', err);
      showDashboardNotice('error', 'Failed to export data', 'Export Error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingImportFile(file);
    setShowImportConfirm(true);
    e.target.value = '';
  };

  const processImport = async () => {
    if (!pendingImportFile) return;
    setIsImporting(true);
    setImportError(null);
    setShowImportConfirm(false);

    try {
      const text = await pendingImportFile.text();
      const data = JSON.parse(text);
      const batch = writeBatch(db);
      
      let newCount = 0;
      let overwriteCount = 0;
      let skipCount = 0;

      // Deep compare helper to see if the backup doc differs from existing DB doc
      const isIdentical = (existingDoc: any, backupDoc: any) => {
        const keysToCompare = Object.keys(backupDoc).filter(k => k !== 'updatedAt' && k !== 'createdAt' && k !== 'ratingAt');
        for (const k of keysToCompare) {
          let val1 = existingDoc[k];
          let val2 = backupDoc[k];
          
          // Handle Firestore Timestamps safely
          if (val1 && typeof val1 === 'object' && 'seconds' in val1) {
            val1 = val1.seconds;
          }
          if (val2 && typeof val2 === 'object' && 'seconds' in val2) {
            val2 = val2.seconds;
          }
          
          if (JSON.stringify(val1) !== JSON.stringify(val2)) {
            return false;
          }
        }
        return true;
      };

      // Fetch existing documents for all collections involved in the backup payload to run comparison
      const existingData: Record<string, any[]> = {};
      const colIds = Object.keys(data);
      for (const colId of colIds) {
        try {
          const snapshot = await getDocs(collection(db, colId));
          existingData[colId] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (colErr) {
          console.warn(`Could not fetch existing docs for "${colId}", assuming empty:`, colErr);
          existingData[colId] = [];
        }
      }

      for (const [colId, docs] of Object.entries(data)) {
        let normalizedDocs: any[] = [];
        if (colId === 'settings') {
          if (Array.isArray(docs)) {
            normalizedDocs = docs;
          } else if (docs && typeof docs === 'object') {
            // Backward compatibility for legacy backup files where settings was stored as { system: { ... } }
            normalizedDocs = Object.entries(docs).map(([id, val]) => ({ id, ...(val as any) }));
          }
        } else if (Array.isArray(docs)) {
          normalizedDocs = docs;
        }

        const existingColDocs = existingData[colId] || [];

        for (const d of normalizedDocs) {
          const { id, ...rest } = d;
          if (!id) continue;

          // Special Offers Auto-Calculate Sale Prices of Fleets on Import time based on discountValue & discountType
          if (colId === 'offers') {
            const discType = rest.discountType || 'percentage';
            const discVal = Number(rest.discountValue) || 0;
            if (Array.isArray(rest.fleets)) {
              rest.fleets = rest.fleets.map((f: any) => {
                const base = Number(f.basePrice) || 0;
                const salePrice = discType === 'percentage'
                  ? Math.round(base * (1 - discVal / 100))
                  : Math.max(0, base - discVal);
                return { ...f, salePrice };
              });
            }
          }

          const existingDoc = existingColDocs.find(ex => ex.id === id);
          if (!existingDoc) {
            // New Document
            batch.set(doc(db, colId, id), { ...rest, updatedAt: serverTimestamp() });
            newCount++;
          } else {
            // Document exists, check if content changed
            if (isIdentical(existingDoc, rest)) {
              // Same exact contents -> SKIP
              skipCount++;
            } else {
              // Different contents -> Overwrite
              batch.set(doc(db, colId, id), { ...rest, updatedAt: serverTimestamp() });
              overwriteCount++;
            }
          }
        }
      }

      await batch.commit();

      const stats = { new: newCount, overwritten: overwriteCount, skipped: skipCount };
      setImportStats(stats);

      showDashboardNotice(
        'success', 
        `Import Completed. Created: ${newCount} | Overwritten: ${overwriteCount} | Skipped (Identical): ${skipCount}`, 
        'Restore Complete'
      );
      setPendingImportFile(null);
    } catch (err) {
      console.error('Import error:', err);
      setImportError('Invalid backup file or network error');
      showDashboardNotice('error', 'Failed to import backup data', 'Import Failed');
    } finally {
      setIsImporting(false);
    }
  };

  const handleTestSmsTemplate = async (template: any) => {
    // @ts-ignore
    const { smsService } = await import('../../services/smsService');
    if (!smsSettings?.adminPhone) {
      showDashboardNotice('error', 'Admin phone number is not set in SMS settings.', 'Test Failed');
      return;
    }
    if (!smsSettings?.enabled) {
      showDashboardNotice('error', 'SMS notifications are currently disabled in settings.', 'Test Failed');
      return;
    }

    setIsTestingSmsId(template.id);
    try {
      let testMessage = template.content;
      const testData = {
        customerName: 'Test Customer',
        bookingId: 'BK-TEST-123',
        driverName: 'Test Driver',
        driverPhone: '+61 411 111 111',
        driverVehicle: 'Mercedes-Benz S-Class',
        driverPlate: 'LUX-777',
        pickupAddress: '123 Test Street, Luxury City',
        dropoffAddress: '456 Elite Blvd, Glamour City',
        date: '2026-06-01',
        time: '10:00 AM',
        status: 'confirmed',
        price: '350.00',
        serviceType: 'distance'
      };

      Object.keys(testData).forEach(key => {
        testMessage = testMessage.replace(new RegExp(`{${key}}`, 'g'), (testData as any)[key]);
      });

      const res = await smsService.sendSMS(smsSettings.adminPhone, `[TEST] ${testMessage}`);
      if (res.success) {
        showDashboardNotice('success', `Test message sent to ${smsSettings.adminPhone}`, 'Test Successful');
      } else {
        showDashboardNotice('error', res.error || 'Failed to send test SMS', 'Test Failed');
      }
    } catch (err) {
      console.error('SMS Test Error:', err);
      showDashboardNotice('error', 'An unexpected error occurred during test.', 'Test Failed');
    } finally {
      setIsTestingSmsId(null);
    }
  };

  const handleSeedSmsTemplates = async () => {
    setIsSeedingTemplates(true);
    const samples = [
      { name: 'Booking Confirmation', event: 'booking_created', recipients: ['customer', 'admin'], content: 'Hello {customerName}, your booking {bookingId} has been received. Status: {status}.', active: true },
      { name: 'Booking Confirmed', event: 'status_confirmed', recipients: ['customer'], content: 'Great news {customerName}! Your booking {bookingId} is now confirmed.', active: true },
      { name: 'Driver Assigned', event: 'status_assigned', recipients: ['customer', 'driver'], content: 'Driver {driverName} has been assigned to your booking {bookingId}.', active: true },
      { name: 'Driver Accepted', event: 'status_accepted', recipients: ['customer', 'admin'], content: 'Your driver {driverName} has accepted the booking {bookingId}.', active: true },
      { name: 'Driver Arrived', event: 'status_arrived', recipients: ['customer'], content: 'Your driver {driverName} has arrived at {pickupAddress}.', active: true },
      { name: 'Ride Started', event: 'status_started', recipients: ['customer', 'admin'], content: 'Your ride {bookingId} has started. Enjoy your trip!', active: true },
      { name: 'Ride Completed', event: 'status_completed', recipients: ['customer', 'admin'], content: 'Your ride {bookingId} is complete. Thank you for choosing us!', active: true },
      { name: 'Ride Cancelled', event: 'status_cancelled', recipients: ['customer', 'admin'], content: 'Notice: Your booking {bookingId} has been cancelled. Reason: {cancellationReason}.', active: true },
      { name: 'Early Pickup Alert', event: 'pickup_early_alert', recipients: ['customer'], content: 'Hello {customerName}, your driver is arriving early for booking {bookingId}. Please be ready.', active: true },
      { name: 'Pending Ride Alert (14 Days)', event: 'pending_ride_alert_14d', recipients: ['admin'], content: 'Alert: Pending ride #{bookingId} ({customerName}) scheduled in 14 days. Date: {date} {time}. Assign chauffeur ASAP.', active: true },
      { name: 'Pending Ride Alert (7 Days)', event: 'pending_ride_alert_7d', recipients: ['admin'], content: 'CRITICAL: Pending ride #{bookingId} ({customerName}) is only 7 days away! Assign chauffeur immediately.', active: true },
    ];

    try {
      for (const sample of samples) {
        const existing = smsTemplates.find(t => t.event === sample.event);
        if (!existing) {
          await addDoc(collection(db, 'sms-templates'), {
            ...sample,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        } else {
          await updateDoc(doc(db, 'sms-templates', existing.id), {
            ...sample,
            updatedAt: serverTimestamp()
          });
        }
      }
      showDashboardNotice('success', 'Sample templates generated successfully', 'Templates Seeded');
    } catch (err) {
      console.error('Error seeding templates:', err);
      showDashboardNotice('error', 'Failed to seed templates', 'Error');
    } finally {
      setIsSeedingTemplates(false);
    }
  };

  const handleTestEmailTemplate = async (template: any) => {
    // @ts-ignore
    const { emailService } = await import('../../services/emailService');
    if (!emailSettings?.adminEmail) {
      showDashboardNotice('error', 'Admin email is not set in Email settings.', 'Test Failed');
      return;
    }
    if (!emailSettings?.enabled) {
      showDashboardNotice('error', 'Email notifications are currently disabled in settings.', 'Test Failed');
      return;
    }

    setIsTestingEmailId(template.id);
    try {
      let testSubject = template.subject || 'No Subject';
      let testMessage = template.content;
      const testData = {
        customerName: 'Test Customer',
        bookingId: 'BK-TEST-123',
        driverName: 'Test Driver',
        driverPhone: '+61 411 111 111',
        driverEmail: 'driver@merlux.au',
        driverVehicle: 'Mercedes-Benz S-Class',
        driverPlate: 'LUX-777',
        pickupAddress: '123 Test Street, Luxury City',
        dropoffAddress: '456 Elite Blvd, Glamour City',
        date: '2026-06-01',
        time: '10:00 AM',
        status: 'confirmed',
        price: '350.00',
        serviceType: 'distance'
      };

      Object.keys(testData).forEach(key => {
        const regex = new RegExp(`{${key}}`, 'g');
        testSubject = testSubject.replace(regex, (testData as any)[key]);
        testMessage = testMessage.replace(regex, (testData as any)[key]);
      });

      const res = await emailService.sendEmail(emailSettings.adminEmail, `[TEST] ${testSubject}`, testMessage);
      if (res.success) {
        showDashboardNotice('success', `Test email sent to ${emailSettings.adminEmail}`, 'Test Successful');
      } else {
        showDashboardNotice('error', res.error || 'Failed to send test Email', 'Test Failed');
      }
    } catch (err) {
      console.error('Email Test Error:', err);
      showDashboardNotice('error', 'An unexpected error occurred during test.', 'Test Failed');
    } finally {
      setIsTestingEmailId(null);
    }
  };

  const handleSeedEmailTemplates = async () => {
    setIsSeedingEmailTemplates(true);

    const appOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://merlux.au';

    const buildHTML = (title: string, body: string, btnText?: string) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 0; color: #111; -webkit-font-smoothing: antialiased; }
  .wrapper { padding: 40px 20px; background-color: #f4f4f5; }
  .container { max-width: 650px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.08); border: 1px solid #e4e4e7; }
  
  /* Header */
  .header { background-color: #09090b; padding: 50px 40px 40px; text-align: center; border-bottom: 4px solid #dab866; background-image: radial-gradient(circle at center, #1a1a1a 0%, #09090b 100%); }
  .logo { font-size: 32px; font-weight: 800; color: #dab866; letter-spacing: 6px; text-decoration: none; text-transform: uppercase; display: block; margin-bottom: 10px; }
  .logo span { color: #ffffff; font-weight: 300; }
  .header-sub { color: #a1a1aa; font-size: 13px; text-transform: uppercase; letter-spacing: 3px; }
  
  /* Hero */
  .hero { background-color: #faf9f6; padding: 40px; text-align: center; border-bottom: 1px solid #f0ece1; }
  .hero-title { font-size: 26px; font-weight: 700; color: #09090b; margin: 0 0 12px 0; letter-spacing: -0.5px; }
  .hero-subtitle { font-size: 16px; color: #52525b; margin: 0; line-height: 1.6; }
  
  /* Content */
  .content { padding: 40px; }
  .content-text { color: #3f3f46; line-height: 1.7; font-size: 15px; margin-bottom: 35px; }
  
  /* Booking Details Card */
  .booking-card { background-color: #ffffff; border: 1px solid #e4e4e7; border-radius: 12px; padding: 30px; margin-bottom: 35px; box-shadow: 0 4px 20px rgba(0,0,0,0.03); }
  .section-title { font-size: 13px; text-transform: uppercase; letter-spacing: 2px; color: #dab866; font-weight: 700; margin-bottom: 20px; border-bottom: 1px solid #f4f4f5; padding-bottom: 10px; display: flex; align-items: center; }
  
  table.grid { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  table.grid td { padding: 12px 10px; vertical-align: top; width: 50%; }
  .label { font-size: 11px; text-transform: uppercase; color: #71717a; letter-spacing: 1px; margin-bottom: 4px; display: block; font-weight: 600; }
  .value { font-size: 15px; color: #09090b; font-weight: 600; margin: 0; line-height: 1.4; word-break: break-word; }
  .value-highlight { color: #dab866; font-size: 18px; }
  
  .divider { height: 1px; background-color: #e4e4e7; margin: 25px 0; }
  
  /* Action Area */
  .action-area { text-align: center; margin: 40px 0 20px; }
  .button { background-color: #dab866; color: #09090b; padding: 16px 36px; text-decoration: none; font-weight: 700; border-radius: 8px; display: inline-block; text-transform: uppercase; letter-spacing: 2px; font-size: 14px; transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(218, 184, 102, 0.3); }
  
  .need-help { text-align: center; margin-top: 30px; font-size: 14px; color: #71717a; background-color: #f8f8f8; padding: 20px; border-radius: 8px; border: 1px dashed #d4d4d8; }
  .need-help a { color: #dab866; font-weight: 600; text-decoration: none; }
  
  /* Footer */
  .footer { background-color: #09090b; padding: 40px; text-align: center; color: #71717a; font-size: 13px; }
  .footer-logo { font-size: 22px; font-weight: 800; color: #3f3f46; letter-spacing: 4px; text-decoration: none; text-transform: uppercase; margin-bottom: 25px; display: block; }
  .footer-links { margin-bottom: 25px; }
  .footer-links a { color: #a1a1aa; text-decoration: none; margin: 0 12px; text-transform: uppercase; font-size: 11px; letter-spacing: 1px; font-weight: 600; }
  .contact-info { margin-bottom: 25px; line-height: 1.8; }
  .contact-info a { color: #dab866; text-decoration: none; }
  .copyright { color: #52525b; font-size: 12px; }
  
  @media only screen and (max-width: 600px) {
    table.grid td { display: block; width: 100%; padding: 10px 0; }
    .wrapper { padding: 20px 10px; }
    .header { padding: 40px 20px 30px; }
    .content { padding: 30px 20px; }
    .booking-card { padding: 20px; }
  }
</style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      
      <!-- Header with Logo -->
      <div class="header">
        <a href="${appOrigin}" style="text-decoration: none; display: inline-block; border: none; outline: none; margin-bottom: 12px;">
          <img src="${systemSettings?.seo?.logo || `${appOrigin}/assets/Logo.webp`}" alt="MERLUX Logo" style="max-height: 60px; max-width: 220px; object-fit: contain; display: block; margin: 0 auto;" referrerPolicy="no-referrer" />
        </a>
        <br/>
        <a href="${appOrigin}" class="logo">MER<span>LUX</span></a>
        <span class="header-sub">Premium Chauffeur Services</span>
      </div>
      
      <!-- Hero Section -->
      <div class="hero">
        <h1 class="hero-title">${title}</h1>
        <p class="hero-subtitle">Booking Reference: <strong style="color: #dab866;">#{id}</strong></p>
      </div>
      
      <!-- Main Content -->
      <div class="content">
        ${body}
        
        <!-- CTA Section -->
        ${btnText ? `
        <div class="action-area">
          <a href="${appOrigin}/app" class="button">${btnText}</a>
        </div>
        ` : ''}
        
        <!-- Help Section -->
        <div class="need-help">
          Need to make changes to your booking?<br>
          Reply directly to this email or <a href="mailto:${systemSettings?.contact?.bookingEmail || 'bookings@merlux.au'}">contact our support team</a>.
        </div>
      </div>
      
      <!-- Footer -->
      <div class="footer">
        <a href="${appOrigin}" class="footer-logo">MERLUX</a>
        <div class="footer-links">
          <a href="${appOrigin}/services">Services</a>
          <a href="${appOrigin}/fleet">Our Fleet</a>
          <a href="${appOrigin}/contact">Contact Us</a>
        </div>
        <div class="contact-info">
          ${systemSettings?.contact?.bookingEmail || 'bookings@merlux.au'}<br>
          <a href="tel:${(systemSettings?.contact?.phone || '+61 400 000 000').replace(/\s+/g, '')}">${systemSettings?.contact?.phone || '+61 400 000 000'}</a><br>
          ${systemSettings?.contact?.address || 'Sydney & Melbourne, Australia'}
        </div>
        <div class="copyright">
          &copy; ${new Date().getFullYear()} Merlux Premium Chauffeur Services. All rights reserved.
        </div>
      </div>
      
    </div>
  </div>
</body>
</html>`;

    const getBookingDetailsHTML = () => `
<div class="booking-card">
  <div class="section-title">Trip Information</div>
  <table class="grid">
    <tr>
      <td>
        <span class="label">Date & Time</span>
        <p class="value">{date} at {time}</p>
      </td>
      <td>
        <span class="label">Service Type</span>
        <p class="value">{serviceType}</p>
      </td>
    </tr>
    <tr>
      <td>
        <span class="label">Pickup Location</span>
        <p class="value">{pickup}</p>
      </td>
      {if:dropoff}
      <td>
        <span class="label">Dropoff Location</span>
        <p class="value">{dropoff}</p>
      </td>
      {/if:dropoff}
    </tr>
  </table>
  
  <div class="divider"></div>
  
  <div class="section-title">Passenger Details</div>
  <table class="grid">
    <tr>
      <td>
        <span class="label">Name</span>
        <p class="value">{customerName}</p>
      </td>
      <td>
        <span class="label">Contact</span>
        <p class="value">{customerPhone}</p>
      </td>
    </tr>
    <tr>
      <td>
        <span class="label">Total Passengers</span>
        <p class="value">{passengers}</p>
      </td>
      {if:flightNumber}
      <td>
        <span class="label">Flight (If Applicable)</span>
        <p class="value">{flightNumber}</p>
      </td>
      {/if:flightNumber}
    </tr>
  </table>
  
  <div class="divider"></div>
  
  <div class="section-title">Summary</div>
  <table class="grid">
    <tr>
      {if:distance}
      <td>
        <span class="label">Distance</span>
        <p class="value">{distance}</p>
      </td>
      {/if:distance}
      <td>
        <span class="label">Estimated Price</span>
        <p class="value value-highlight">$ {price}</p>
      </td>
    </tr>
  </table>
</div>`;

    const getDriverDetailsHTML = () => `
<div class="booking-card" style="border-color: #dab866; background-color: #faf9f6; box-shadow: 0 4px 20px rgba(218, 184, 102, 0.08);">
  <div class="section-title" style="color: #09090b;">Assigned Driver Details</div>
  <table class="grid">
    <tr>
      <td>
        <span class="label">Driver Name</span>
        <p class="value">{driverName}</p>
      </td>
      <td>
        <span class="label">Contact Number</span>
        <p class="value">{driverPhone}</p>
      </td>
    </tr>
    <tr>
      <td>
        <span class="label">Vehicle</span>
        <p class="value">{driverVehicle}</p>
      </td>
      <td>
        <span class="label">License Plate</span>
        <p class="value" style="font-family: monospace; background:#e4e4e7; padding:4px 8px; display:inline-block; border-radius:4px; letter-spacing: 2px;">{driverPlate}</p>
      </td>
    </tr>
  </table>
</div>`;

    const samples = [
      {
        name: 'Booking Confirmation',
        event: 'booking_created',
        subject: 'Booking Request Received - #{id}',
        recipients: ['customer', 'admin'],
        content: buildHTML('Booking Request Received', `
          <p class="content-text">Hello <strong>{customerName}</strong>,</p>
          <p class="content-text">Thank you for choosing Merlux. Your luxury chauffeur booking request has been successfully received and is securely in our system.</p>
          ${getBookingDetailsHTML()}
          <p class="content-text">We are reviewing your request and will notify you as soon as a professional driver is confirmed for your trip.</p>
        `, 'Manage Booking'),
        active: true
      },
      {
        name: 'Booking Confirmed',
        event: 'status_confirmed',
        subject: 'Booking Confirmed - #{id}',
        recipients: ['customer'],
        content: buildHTML('Booking Confirmed', `
          <p class="content-text">Great news, <strong>{customerName}</strong>!</p>
          <p class="content-text">Your booking <strong>#{id}</strong> is fully confirmed. We look forward to providing you with an exceptional, premium experience.</p>
          ${getBookingDetailsHTML()}
          <p class="content-text">You will receive the precise details of your assigned driver closer to the pickup date.</p>
        `, 'View Confirmation'),
        active: true
      },
      {
        name: 'Driver Assigned',
        event: 'status_assigned',
        subject: 'Driver Details Enclosed: Booking #{id}',
        recipients: ['customer', 'driver'],
        content: buildHTML('Your Driver is Assigned', `
          <p class="content-text">Hello <strong>{customerName}</strong>,</p>
          <p class="content-text">We have assigned a professional chauffeur for your upcoming trip <strong>#{id}</strong>.</p>
          ${getDriverDetailsHTML()}
          ${getBookingDetailsHTML()}
          <p class="content-text">Your driver will contact you closer to the time or upon arrival.</p>
        `, 'Contact Driver'),
        active: true
      },
      {
        name: 'Driver Accepted',
        event: 'status_accepted',
        subject: 'Trip Accepted: Booking #{id}',
        recipients: ['customer', 'admin'],
        content: buildHTML('Trip Confirmed by Driver', `
          <p class="content-text">Hello <strong>{customerName}</strong>,</p>
          <p class="content-text">Your highly trained chauffeur, <strong>{driverName}</strong>, has formally accepted your booking <strong>#{id}</strong>.</p>
          ${getDriverDetailsHTML()}
          <p class="content-text">Please ensure you are ready at the pickup location approximately 5-10 minutes prior to departure to ensure a prompt progression.</p>
        `, 'Live Tracking'),
        active: true
      },
      {
        name: 'Driver Arrived',
        event: 'status_arrived',
        subject: 'Your Driver has Arrived: Booking #{id}',
        recipients: ['customer'],
        content: buildHTML('Your Chauffeur has Arrived', `
          <p class="content-text">Hello <strong>{customerName}</strong>,</p>
          <p class="content-text">Your driver <strong>{driverName}</strong> has just arrived at the pickup destination.</p>
          <div class="booking-card">
            <div class="section-title">Pickup Details</div>
            <p style="font-size: 16px; font-weight: 600; color: #09090b;">{pickup}</p>
          </div>
          <p class="content-text">Please meet your driver at your earliest convenience to commence your premium journey. Should you require assistance locating the vehicle, please contact the driver directly at <strong>{driverPhone}</strong>.</p>
        `, 'Contact Driver'),
        active: true
      },
      {
        name: 'Ride Started',
        event: 'status_started',
        subject: 'Ride In Progress: Booking #{id}',
        recipients: ['customer', 'admin'],
        content: buildHTML('Ride In Progress', `
          <p class="content-text">Hello <strong>{customerName}</strong>,</p>
          <p class="content-text">Your journey for booking <strong>#{id}</strong> is now officially underway.</p>
          <p class="content-text">Sit back, relax, and immerse yourself in the luxurious comfort of Merlux. We wish you an incredibly pleasant and safe trip.</p>
        `),
        active: true
      },
      {
        name: 'Ride Completed',
        event: 'status_completed',
        subject: 'Thank You for Riding with Merlux: Booking #{id}',
        recipients: ['customer', 'admin'],
        content: buildHTML('Trip Completed Successfully', `
          <p class="content-text">Hello <strong>{customerName}</strong>,</p>
          <p class="content-text">Your trip <strong>#{id}</strong> has now been successfully completed. We deeply hope your experience with our chauffeur was flawless and met your highest expectations.</p>
          <div class="booking-card" style="text-align: center;">
            <p style="font-size: 18px; font-weight: 700; color: #dab866; margin-bottom: 10px;">How was your ride?</p>
            <p style="color: #71717a; font-size: 14px; margin-bottom: 20px;">We would love to hear your thoughts to help us provide absolute perfection.</p>
            <div style="margin: 20px 0;">
              <a href="{rateUrl}" style="background-color: #dab866; color: #000000; padding: 12px 25px; text-decoration: none; font-weight: bold; border-radius: 25px; display: inline-block; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Rate Now</a>
            </div>
          </div>
          <p class="content-text">Thank you for choosing Merlux. We eagerly look forward to serving you again very soon.</p>
        `, 'Book Another Ride'),
        active: true
      },
      {
        name: 'Ride Cancelled',
        event: 'status_cancelled',
        subject: 'Cancellation Notice: Booking #{id}',
        recipients: ['customer', 'admin'],
        content: buildHTML('Booking Cancelled', `
          <p class="content-text">Hello <strong>{customerName}</strong>,</p>
          <p class="content-text">We are writing to officially inform you that your booking <strong>#{id}</strong> has been cancelled.</p>
          <p class="content-text" style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; color: #991b1b; border-radius: 8px;"><strong>Cancellation Reason:</strong> {cancellationReason}</p>
          ${getBookingDetailsHTML()}
          <p class="content-text">If you believe this cancellation was processed in error, or if you would like to arrange a new schedule, please contact our support desk immediately.</p>
        `, 'Contact Support'),
        active: true
      },
      {
        name: 'Early Pickup Alert',
        event: 'pickup_early_alert',
        subject: 'Driver is Early: Booking #{id}',
        recipients: ['customer'],
        content: buildHTML('Your Driver is Ready Early', `
          <p class="content-text">Hello <strong>{customerName}</strong>,</p>
          <p class="content-text">We wanted to courteously let you know that your chauffeur, <strong>{driverName}</strong>, has arrived early for your booking <strong>#{id}</strong>.</p>
          ${getDriverDetailsHTML()}
          <p class="content-text"><strong>Do not rush!</strong> Your driver is more than happy to wait until the scheduled pickup time. This is strictly a courtesy notification so you are aware they are ready whenever you are.</p>
        `, 'View Status'),
        active: true
      },
      {
        name: 'Feedback Submitted',
        event: 'booking_feedback',
        subject: 'New Feedback Submitted: Booking #{id}',
        recipients: ['admin'],
        content: buildHTML('Feedback Submitted', `
          <p class="content-text">Hello Admin,</p>
          <p class="content-text">A customer has submitted feedback for booking reference <strong>#{id}</strong>.</p>
          <div class="booking-card" style="border-left: 4px solid #dab866; background-color: #fcfcfc;">
            <div class="section-title">Customer Feedback</div>
            <p style="font-size: 18px; font-weight: bold; color: #dab866; margin: 5px 0;">Rating: {rating} / 5 Stars</p>
            <p class="content-text" style="font-style: italic; margin-top: 10px; color: #18181b;">"{feedback}"</p>
          </div>
          ${getBookingDetailsHTML()}
        `, 'View Booking'),
        active: true
      },
      {
        name: 'Pending Ride Alert (14 Days)',
        event: 'pending_ride_alert_14d',
        subject: 'Pending Ride Action Required (14 Days) - Booking #{id}',
        recipients: ['admin'],
        content: buildHTML('Pending Chauffeur Assignment Reminder', `
          <p class="content-text">Hello Admin,</p>
          <p class="content-text">This is a reminder that the booking <strong>#{id}</strong> (for <strong>{customerName}</strong>) scheduled in 14 days is still in <strong>pending</strong> status.</p>
          ${getBookingDetailsHTML()}
          <p class="content-text">Please review and assign an appropriate chauffeur at your earliest convenience.</p>
        `, 'Assign Chauffeur'),
        active: true
      },
      {
        name: 'Pending Ride Alert (7 Days)',
        event: 'pending_ride_alert_7d',
        subject: 'CRITICAL: Pending Ride Action Required (7 Days) - Booking #{id}',
        recipients: ['admin'],
        content: buildHTML('CRITICAL: Chauffeur Assignment Required (7 Days Only)', `
          <p class="content-text">Hello Admin,</p>
          <p class="content-text" style="color: #b91c1c; font-weight: bold;">Only 7 days remain to assign a chauffeur for this ride!</p>
          ${getBookingDetailsHTML()}
          <p class="content-text">Immediate action is required to ensure we deliver the absolute premium level of experience expected.</p>
        `, 'Assign Chauffeur Now'),
        active: true
      },
    ];

    try {
      for (const sample of samples) {
        const existing = emailTemplates.find(t => t.event === sample.event);
        if (!existing) {
          await addDoc(collection(db, 'email-templates'), {
            ...sample,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        } else {
          // Update existing with the new elegant templates
          await updateDoc(doc(db, 'email-templates', existing.id), {
            ...sample,
            updatedAt: serverTimestamp()
          });
        }
      }
      showDashboardNotice('success', 'Professional email templates regenerated successfully.', 'Templates Updated');
    } catch (err) {
      console.error('Error seeding Email templates:', err);
      showDashboardNotice('error', 'Failed to seed Email templates', 'Error');
    } finally {
      setIsSeedingEmailTemplates(false);
    }
  };

  const handleUpdateVehicle = async (id: string | null, data: any) => {
    try {
      if (!id || id === 'new') {
        const newRef = doc(collection(db, 'fleet'));
        await setDoc(newRef, { ...data, id: newRef.id, createdAt: serverTimestamp() });
      } else {
        await updateDoc(doc(db, 'fleet', id), { ...data, updatedAt: serverTimestamp() });
      }
      setShowVehicleModal(false);
      setEditingVehicle(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'fleet');
    }
  };

  const handleDeleteVehicle = (id: string) => {
    const vehicle = fleet.find(v => v.id === id);
    setConfirmDelete({
      type: 'fleet',
      id,
      title: 'Delete Vehicle',
      message: `Are you sure you want to remove ${vehicle?.name || 'this vehicle'} from the fleet?`,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'fleet', id));
          showDashboardNotice('success', 'Vehicle deleted.');
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `fleet/${id}`);
        }
      }
    });
  };

  const handleUpdateExtra = async (id: string | null, data: any) => {
    try {
      if (!id || id === 'new') {
        const newRef = doc(collection(db, 'extras'));
        await setDoc(newRef, { ...data, id: newRef.id, createdAt: serverTimestamp() });
      } else {
        await updateDoc(doc(db, 'extras', id), { ...data, updatedAt: serverTimestamp() });
      }
      setShowExtraModal(false);
      setEditingExtra(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'extras');
    }
  };

  const handleDeleteExtra = (id: string) => {
    const extra = extras.find(e => e.id === id);
    setConfirmDelete({
      type: 'extras',
      id,
      title: 'Delete Extra',
      message: `Are you sure you want to delete the extra: ${extra?.name || 'this item'}?`,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'extras', id));
          showDashboardNotice('success', 'Extra deleted.');
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `extras/${id}`);
        }
      }
    });
  };

  const handleUpdateCoupon = async (id: string | null, data: any) => {
    try {
      if (!id || id === 'new') {
        const newRef = doc(collection(db, 'coupons'));
        await setDoc(newRef, { ...data, id: newRef.id, createdAt: serverTimestamp() });
      } else {
        await updateDoc(doc(db, 'coupons', id), { ...data, updatedAt: serverTimestamp() });
      }
      setShowCouponModal(false);
      setEditingCoupon(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'coupons');
    }
  };

  const handleDeleteCoupon = (id: string) => {
    const coupon = coupons.find(c => c.id === id);
    setConfirmDelete({
      type: 'coupons',
      id,
      title: 'Delete Coupon',
      message: `Are you sure you want to delete the coupon: ${coupon?.code || 'this coupon'}?`,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'coupons', id));
          showDashboardNotice('success', 'Coupon deleted.');
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `coupons/${id}`);
        }
      }
    });
  };

  const handleUpdatePriceAddon = async (id: string | null, data: any) => {
    setIsSavingPriceAddon(true);
    try {
      const sanitizedData = {
        name: data.name || '',
        value: Number(data.value) || 0,
        type: data.type || 'percentage',
        operation: data.operation || 'addition',
        target: data.target || 'gross',
        active: data.active ?? true,
        applyToBooking: data.applyToBooking !== false,
        applyToOffers: data.applyToOffers !== false,
        applyToTours: data.applyToTours !== false,
        hideLabelInBreakdown: !!data.hideLabelInBreakdown,
        hideSatisfyDetails: !!data.hideSatisfyDetails,

        limitLocation: !!data.limitLocation,
        bboxNorth: data.limitLocation ? (Number(data.bboxNorth) || 0) : 0,
        bboxSouth: data.limitLocation ? (Number(data.bboxSouth) || 0) : 0,
        bboxEast: data.limitLocation ? (Number(data.bboxEast) || 0) : 0,
        bboxWest: data.limitLocation ? (Number(data.bboxWest) || 0) : 0,
        bboxTarget: data.limitLocation ? (data.bboxTarget || 'pickup') : 'pickup',
        bboxes: data.limitLocation ? (data.bboxes || []) : [],

        limitDates: !!data.limitDates,
        startDate: data.limitDates ? (data.startDate || '') : '',
        endDate: data.limitDates ? (data.endDate || '') : '',

        limitTime: !!data.limitTime,
        startTime: data.limitTime ? (data.startTime || '') : '',
        endTime: data.limitTime ? (data.endTime || '') : '',
        timeTarget: data.limitTime ? (data.timeTarget || 'pickup') : 'pickup',

        limitDays: !!data.limitDays,
        selectedDays: data.limitDays ? (data.selectedDays || []) : [],

        limitFleet: !!data.limitFleet,
        selectedFleet: data.limitFleet ? (data.selectedFleet || []) : [],

        limitService: !!data.limitService,
        selectedServices: data.limitService ? (data.selectedServices || []) : [],

        limitExtras: !!data.limitExtras,
        selectedExtras: data.limitExtras ? (data.selectedExtras || []) : [],

        limitRideType: !!data.limitRideType,
        rideTypeTarget: data.limitRideType ? (data.rideTypeTarget || 'oneway') : 'oneway',
        activeStartDate: data.activeStartDate || '',
        activeEndDate: data.activeEndDate || '',
        connectionOperator: data.connectionOperator || 'AND',
      };

      if (!id || id === 'new') {
        const newRef = doc(collection(db, 'price-addons'));
        await setDoc(newRef, { ...sanitizedData, id: newRef.id, createdAt: serverTimestamp() });
      } else {
        await updateDoc(doc(db, 'price-addons', id), { ...sanitizedData, updatedAt: serverTimestamp() });
      }
      setShowPriceAddonModal(false);
      setEditingPriceAddon(null);
      showDashboardNotice('success', 'Price add-on updated.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'price-addons');
    } finally {
      setIsSavingPriceAddon(false);
    }
  };

  const handleDeletePriceAddon = (id: string) => {
    const addon = priceAddons.find(a => a.id === id);
    setConfirmDelete({
      type: 'price-addons',
      id,
      title: 'Delete Price Add-on',
      message: `Are you sure you want to delete the add-on: ${addon?.name || 'this item'}?`,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'price-addons', id));
          showDashboardNotice('success', 'Price add-on deleted.');
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `price-addons/${id}`);
        }
      }
    });
  };

  const handleTogglePriceAddonActive = async (id: string) => {
    const addon = priceAddons.find(a => a.id === id);
    if (!addon) return;
    try {
      await updateDoc(doc(db, 'price-addons', id), {
        active: !addon.active,
        updatedAt: serverTimestamp()
      });
      showDashboardNotice('success', `Price add-on "${addon.name}" is now ${!addon.active ? 'Active' : 'Inactive'}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `price-addons/${id}`);
    }
  };

  const handleUpdateSettings = async (settings: any) => {
    setIsSavingSettings(true);
    try {
      await setDoc(doc(db, 'settings', 'system'), { ...settings, updatedAt: serverTimestamp() }, { merge: true });
      showDashboardNotice('success', 'System settings updated.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'settings/system');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleUpdateSmsSettings = async (settings: any) => {
    setIsSavingSmsSettings(true);
    try {
      await setDoc(doc(db, 'settings', 'sms'), { ...settings, updatedAt: serverTimestamp() }, { merge: true });
      showDashboardNotice('success', 'SMS settings updated.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'settings/sms');
    } finally {
      setIsSavingSmsSettings(false);
    }
  };

  const handleUpdateEmailSettings = async (settings: any) => {
    setIsSavingEmailSettings(true);
    try {
      await setDoc(doc(db, 'settings', 'email'), { ...settings, updatedAt: serverTimestamp() }, { merge: true });
      showDashboardNotice('success', 'Email settings updated.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'settings/email');
    } finally {
      setIsSavingEmailSettings(false);
    }
  };

  const handleUpdateSmsTemplate = async (template: any) => {
    setIsSavingSmsTemplate(true);
    try {
      const { id, ...rest } = template;
      if (id && id !== 'new') {
        await setDoc(doc(db, 'sms-templates', id), { ...rest, updatedAt: serverTimestamp() }, { merge: true });
        showDashboardNotice('success', 'SMS template updated.');
      } else {
        await addDoc(collection(db, 'sms-templates'), { 
          ...rest, 
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp() 
        });
        showDashboardNotice('success', 'SMS template created.');
      }
      setShowSmsTemplateModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `sms-templates/${template.id || 'new'}`);
    } finally {
      setIsSavingSmsTemplate(false);
    }
  };

  const handleUpdateEmailTemplate = async (template: any) => {
    setIsSavingEmailTemplate(true);
    try {
      const { id, ...rest } = template;
      if (id && id !== 'new') {
        await setDoc(doc(db, 'email-templates', id), { ...rest, updatedAt: serverTimestamp() }, { merge: true });
        showDashboardNotice('success', 'Email template updated.');
      } else {
        await addDoc(collection(db, 'email-templates'), { 
          ...rest, 
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp() 
        });
        showDashboardNotice('success', 'Email template created.');
      }
      setShowEmailTemplateModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `email-templates/${template.id || 'new'}`);
    } finally {
      setIsSavingEmailTemplate(false);
    }
  };

  const handleDeleteSmsTemplate = (id: string) => {
    const template = smsTemplates.find(t => t.id === id);
    setConfirmDelete({
      type: 'sms-template',
      id,
      title: 'Delete SMS Template',
      message: `Are you sure you want to delete the template: ${template?.name || 'this template'}?`,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'sms-templates', id));
          showDashboardNotice('success', 'SMS template deleted.');
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `sms-templates/${id}`);
        }
      }
    });
  };

  const handleDeleteEmailTemplate = (id: string) => {
    const template = emailTemplates.find(t => t.id === id);
    setConfirmDelete({
      type: 'email-template',
      id,
      title: 'Delete Email Template',
      message: `Are you sure you want to delete the template: ${template?.name || 'this template'}?`,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'email-templates', id));
          showDashboardNotice('success', 'Email template deleted.');
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `email-templates/${id}`);
        }
      }
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const imgElement = new Image();
      imgElement.src = event.target?.result as string;
      
      imgElement.onload = () => {
        // High-end image compression / resizing to ensure Firestore documents remain lightweight (under 1MB)
        const maxDim = 1024;
        let width = imgElement.width;
        let height = imgElement.height;
        
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(imgElement, 0, 0, width, height);
          const base64Url = canvas.toDataURL('image/jpeg', 0.82);
          setEditingVehicle({ ...editingVehicle, img: base64Url });
          showDashboardNotice('success', 'Image processed as base64 and loaded.', 'Image Uploaded');
        } else {
          setEditingVehicle({ ...editingVehicle, img: event.target?.result as string });
          showDashboardNotice('success', 'Image processed and loaded.', 'Image Uploaded');
        }
        setIsUploading(false);
      };

      imgElement.onerror = () => {
        setEditingVehicle({ ...editingVehicle, img: event.target?.result as string });
        showDashboardNotice('success', 'Image processed and loaded.', 'Image Uploaded');
        setIsUploading(false);
      };
    };

    reader.onerror = (err) => {
      console.error('File reading error:', err);
      showDashboardNotice('error', 'Failed to read image file.', 'Upload Error');
      setIsUploading(false);
    };

    reader.readAsDataURL(file);
  };
  return (
    <div className="space-y-8">
      {/* Top Inline Header Navigation */}
      <div className="glass p-2 rounded-lg px-4 border border-white/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="text-left animate-in fade-in duration-300">
          <h3 className="text-lg font-display text-gold flex items-center gap-2">
            {activeSubSection === 'fleet' && (
              <>
                <Car size={18} className="text-gold" />
                <span>Fleet Management</span>
              </>
            )}
            {activeSubSection === 'extras' && (
              <>
                <Luggage size={18} className="text-gold" />
                <span>Extras Management</span>
              </>
            )}
            {activeSubSection === 'coupons' && (
              <>
                <Percent size={18} className="text-gold" />
                <span>Coupons & Fees</span>
              </>
            )}
            {activeSubSection === 'booking' && (
              <>
                <Cog size={18} className="text-gold" />
                <span>Booking Configuration</span>
              </>
            )}
            {activeSubSection === 'sms' && (
              <>
                <MessageSquare size={18} className="text-gold" />
                <span>SMS Notifications</span>
              </>
            )}
            {activeSubSection === 'email' && (
              <>
                <Mail size={18} className="text-gold" />
                <span>Email Notifications</span>
              </>
            )}
            {activeSubSection === 'backup' && (
              <>
                <FileJson size={18} className="text-gold" />
                <span>Backup & Recovery</span>
              </>
            )}
          </h3>
          <p className="text-[10px] text-white/40 uppercase tracking-widest mt-1">
            {activeSubSection === 'fleet' && 'Manage luxury fleet & vehicle categories'}
            {activeSubSection === 'extras' && 'Chauffeur trip upgrades, child seats & premium additions'}
            {activeSubSection === 'coupons' && 'Promotional codes & dynamic price extras'}
            {activeSubSection === 'booking' && 'Core billing parameters, hourly ranges & security rules'}
            {activeSubSection === 'sms' && 'Configure Twilio text notifications & SMS templates'}
            {activeSubSection === 'email' && 'Configure SMTP email notifications & newsletter templates'}
            {activeSubSection === 'backup' && 'Backend Firebase dataset snapshot export & restore'}
          </p>
        </div>

        {/* Navigation Toggles (Icon Only) */}
        <div className="flex flex-wrap items-center gap-1.5 bg-black/30 p-1.5 rounded-2xl border border-white/5 self-start sm:self-auto shrink-0 w-full sm:w-auto">
          {[
            { id: 'fleet', label: 'Fleet Management', icon: Car },
            { id: 'extras', label: 'Extras Management', icon: Luggage },
            { id: 'coupons', label: 'Coupons & Fees', icon: Percent },
            { id: 'booking', label: 'Booking Config', icon: Cog },
            { id: 'sms', label: 'SMS Alerts', icon: MessageSquare },
            { id: 'email', label: 'Email Alerts', icon: Mail },
            { id: 'backup', label: 'Backup & Recovery', icon: FileJson },
          ].map((tab) => {
            const IconComponent = tab.icon;
            const isActive = activeSubSection === tab.id;
            return (
              <button
                key={`subtab-btn-${tab.id}`}
                onClick={() => setActiveSubSection(tab.id as any)}
                className={cn(
                  "p-2.5 rounded-xl transition-all relative group flex-1 sm:flex-initial flex justify-center items-center",
                  isActive
                    ? "bg-gold text-black shadow-lg shadow-gold/20"
                    : "text-white/40 hover:text-white hover:bg-white/5"
                )}
                title={tab.label}
              >
                <IconComponent size={14} />
                <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-2.5 py-1 rounded bg-black border border-white/10 text-[8px] font-bold uppercase tracking-widest text-white transition-opacity duration-150 opacity-0 group-hover:opacity-100 z-50 shadow-md">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="w-full">
        <AnimatePresence mode="wait">
          {activeSubSection === 'fleet' && (
            <motion.div
              key="fleet"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="space-y-8"
            >
              {/* Fleet Management */}
              <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
          <div>
            <h3 className="text-xl sm:text-2xl font-display text-gold">Fleet Management</h3>
            <p className="text-white/40 text-[10px] uppercase tracking-widest">
              Manage your luxury vehicles
            </p>
          </div>

          <div className="flex flex-row items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={14} />
              <input
                type="text"
                placeholder="Search fleet..."
                value={fleetSearchQuery}
                onChange={(e) => setFleetSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-10 py-2 text-xs text-white outline-none focus:border-gold transition-all"
              />
              {fleetSearchQuery && (
                <button
                  onClick={() => setFleetSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <button
              onClick={() => {
                setEditingVehicle({ name: '', model: '', type: 'sedan', pax: 3, bags: 2, price: 95, img: '', kmRanges: [] });
                setShowVehicleModal(true);
              }}
              className="btn-primary px-6 py-2 flex items-center justify-center gap-2 shrink-0"
            >
              <Plus size={18} />
              <span className="hidden md:inline text-xs font-bold uppercase tracking-widest">
                Add Vehicle
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(fleet || []).filter(v =>
            v.name?.toLowerCase().includes((fleetSearchQuery || '').toLowerCase()) ||
            v.model?.toLowerCase().includes((fleetSearchQuery || '').toLowerCase()) ||
            v.plateNo?.toLowerCase().includes((fleetSearchQuery || '').toLowerCase()) ||
            (v.price || v.basePrice)?.toString().includes(fleetSearchQuery || '')
          ).map((v, idx) => (
            <div key={`fleet-item-${v.id || 'none'}-${idx}`} className="glass rounded-2xl overflow-hidden border border-white/5 group hover:border-gold/30 transition-all">
              <div className="h-48 relative overflow-hidden">
                <img src={v.img || 'https://picsum.photos/seed/car/800/400'} alt={v.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
                <div className="absolute bottom-4 left-4">
                  <p className="text-xl font-display">{v.name}</p>
                  <p className="text-xs text-white/60 mb-1.5">{v.model}</p>
                  {v.plateNo && (
                    <span className="inline-block px-2 py-0.5 bg-black/60 text-[9px] font-bold tracking-wider text-gold rounded border border-gold/30 uppercase font-mono">
                      {v.plateNo}
                    </span>
                  )}
                </div>
              </div>
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2 text-blue-600">
                      <Users size={14} />
                      <span className="text-xs font-bold text-white/40">{v.pax}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gold">
                      <Luggage size={14} />
                      <span className="text-xs font-bold text-white/40">{v.bags}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-widest text-white/30 font-bold">Price</p>
                    <p className="text-lg font-display text-gold">${v.price || v.basePrice || 0}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingVehicle({ ...v, id: 'new' });
                      setShowVehicleModal(true);
                    }}
                    className="p-3 bg-white/5 text-gold rounded-xl hover:bg-gold hover:text-black transition-all"
                    title="Duplicate"
                  >
                    <Copy size={18} />
                  </button>
                  <button
                    onClick={() => {
                      setEditingVehicle(v);
                      setShowVehicleModal(true);
                    }}
                    className="flex-1 bg-white/5 hover:bg-gold hover:text-black py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all"
                  >
                    Edit Vehicle
                  </button>
                  <button
                    onClick={() => handleDeleteVehicle(v.id)}
                    className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
            </motion.div>
          )}

          {activeSubSection === 'extras' && (
            <motion.div
              key="extras"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="space-y-8"
            >
              {/* Extras Management */}
              <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
          <div>
            <h3 className="text-xl sm:text-2xl font-display text-gold">Extras Management</h3>
            <p className="text-white/40 text-[10px] uppercase tracking-widest">
              Manage additional ride options
            </p>
          </div>

          <div className="flex flex-row items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={14} />
              <input
                type="text"
                placeholder="Search extras..."
                value={extrasSearchQuery}
                onChange={(e) => setExtrasSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-10 py-2 text-xs text-white outline-none focus:border-gold transition-all"
              />
              {extrasSearchQuery && (
                <button
                  onClick={() => setExtrasSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <button
              onClick={() => {
                setEditingExtra({ name: '', description: '', price: 0, active: true });
                setShowExtraModal(true);
              }}
              className="btn-primary px-6 py-2 flex items-center justify-center gap-2 shrink-0"
            >
              <Plus size={18} />
              <span className="hidden md:inline text-xs font-bold uppercase tracking-widest">
                Add Extra
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(extras || []).filter(e =>
            e.name?.toLowerCase().includes((extrasSearchQuery || '').toLowerCase()) ||
            (e.price || e.value)?.toString().includes(extrasSearchQuery || '')
          ).map((e, idx) => (
            <div key={`extra-item-${e.id || 'none'}-${idx}`} className="glass p-6 rounded-2xl border border-white/5 hover:border-gold/30 transition-all group relative overflow-hidden">
              <div className={cn(
                "absolute top-0 right-0 text-white text-[8px] font-bold uppercase tracking-widest px-3 py-1 rounded-bl-xl",
                e.active ? "bg-green-600" : "bg-red-500"
              )}>
                {e.active ? "Active" : "Inactive"}
              </div>
              <div className="flex justify-between items-start mb-2 mt-2">
                <div>
                  <h4 className="text-xl font-display font-bold text-gold mb-1">{e.name}</h4>
                </div>
                <div className="bg-gold/10 p-1.5 rounded-lg">
                  <p className="text-[10px] text-gold uppercase tracking-widest font-bold">
                    ${e.price || e.value || 0}
                  </p>
                </div>
              </div>
              <p className="text-xs text-white/60 mb-6 line-clamp-2">{e.description}</p>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditingExtra({ ...e, id: 'new' });
                    setShowExtraModal(true);
                  }}
                  className="p-2 bg-white/5 text-gold rounded-xl hover:bg-gold hover:text-black transition-all"
                  title="Duplicate"
                >
                  <Copy size={14} />
                </button>
                <button
                  onClick={() => {
                    setEditingExtra(e);
                    setShowExtraModal(true);
                  }}
                  className="flex-1 py-2 bg-blue-500/10 text-blue-500 rounded-xl hover:bg-blue-500/50 hover:text-white text-[12px] font-bold transition-all flex items-center justify-center gap-1"
                >
                  <Pencil size={14} /> Edit
                </button>

                <button
                  onClick={() => handleDeleteExtra(e.id)}
                  className="flex-1 py-2 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/50 hover:text-white text-[12px] font-bold transition-all flex items-center justify-center gap-1"
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
            </motion.div>
          )}

          {activeSubSection === 'coupons' && (
            <motion.div
              key="coupons"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="space-y-8"
            >
              {/* Coupon Management */}
              <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
          <div>
            <h3 className="text-xl sm:text-2xl font-display text-gold">Coupon Management</h3>
            <p className="text-white/40 text-[10px] uppercase tracking-widest">
              Manage discount codes
            </p>
          </div>

          <div className="flex flex-row items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={14} />
              <input
                type="text"
                placeholder="Search coupons..."
                value={couponsSearchQuery}
                onChange={(e) => setCouponsSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-10 py-2 text-xs text-white outline-none focus:border-gold transition-all"
              />
              {couponsSearchQuery && (
                <button
                  onClick={() => setCouponsSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <button
              onClick={() => {
                setEditingCoupon({
                  code: '',
                  type: 'percentage',
                  value: 0,
                  startDate: '',
                  endDate: '',
                  usageLimit: 0,
                  usedCount: 0,
                  active: true,
                  serviceIds: [],
                });
                setShowCouponModal(true);
              }}
              className="btn-primary px-6 py-2 flex items-center justify-center gap-2 shrink-0"
            >
              <Plus size={18} />
              <span className="hidden md:inline text-xs font-bold uppercase tracking-widest">
                Add Coupon
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(coupons || []).filter(c =>
            c.code?.toLowerCase().includes((couponsSearchQuery || '').toLowerCase()) ||
            c.value?.toString().includes(couponsSearchQuery || '')
          ).map((c, idx) => (
            <div key={`coupon-item-${c.id || 'none'}-${idx}`} className="glass p-6 rounded-2xl border border-white/5 hover:border-gold/30 transition-all group relative overflow-hidden">
              <div className={cn(
                "absolute top-0 right-0 text-white text-[8px] font-bold uppercase tracking-widest px-3 py-1 rounded-bl-xl",
                c.active ? "bg-green-600" : "bg-red-500"
              )}>
                {c.active ? "Active" : "Inactive"}
              </div>
              <div className="flex justify-between items-start mb-4 mt-2">
                <div>
                  <h4 className="text-xl font-bold font-display text-gold mb-1">{c.code}</h4>
                </div>
                <div className="bg-gold/10 p-1.5 rounded-lg">
                  <p className="text-[10px] uppercase font-bold text-gold">
                    {c.type === 'percentage' ? `${c.value}% OFF` : `$${c.value} OFF`}
                  </p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-[10px] uppercase tracking-widest font-bold">
                  <span className="text-white/30">Validity</span>
                  <span className="text-white/60">{c.startDate} - {c.endDate}</span>
                </div>
                <div className="flex justify-between text-[10px] uppercase tracking-widest font-bold">
                  <span className="text-white/30">Usage</span>
                  <span className="text-white/60">{c.usedCount || 0} / {c.usageLimit || '∞'}</span>
                </div>
                <div className="flex justify-between text-[10px] tracking-widest font-bold">
                  <span className="text-white/30 uppercase">Aplc. Services</span>
                  {(!c.serviceIds || (c.serviceIds as string[] || []).length === 0) ? (
                    <span className="text-[9px] bg-white/10 text-white/80 px-2 py-1 rounded-lg">All Services</span>
                  ) : (
                    <div className="flex flex-wrap gap-1 justify-end">
                      {(c.serviceIds as string[] || []).map((service: string, sIdx: number) => (
                        <span
                          key={`coupon-service-${c.id || idx}-${service}-${sIdx}`}
                          className="text-[9px] bg-white/10 text-white/80 px-1.5 py-1 rounded-lg"
                        >
                          {service.charAt(0).toUpperCase() + service.slice(1).toLowerCase()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const { id, ...couponData } = c;
                    setEditingCoupon({ ...couponData, code: c.code + '-COPY' });
                    setShowCouponModal(true);
                  }}
                  className="p-2 bg-white/5 text-gold rounded-xl hover:bg-gold hover:text-black transition-all"
                  title="Duplicate"
                >
                  <Copy size={14} />
                </button>
                <button
                  onClick={() => {
                    setEditingCoupon(c);
                    setShowCouponModal(true);
                  }}
                  className="flex-1 py-2 bg-blue-500/10 text-blue-500 rounded-xl hover:bg-blue-500/50 hover:text-white text-[12px] font-bold transition-all flex items-center justify-center gap-1"
                >
                  <Pencil size={14} /> Edit
                </button>

                <button
                  onClick={() => handleDeleteCoupon(c.id)}
                  className="flex-1 py-2 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/50 hover:text-white transition-all font-bold flex items-center justify-center gap-1"
                >
                  <Trash2 size={14} />
                  <span className="text-[12px] font-bold uppercase tracking-widest">Delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <hr className="border-white/10 my-6" />

      {/* Price Add-ons Management */}
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
          <div>
            <h3 className="text-xl sm:text-2xl font-display text-gold">Price Add-ons</h3>
            <p className="text-white/40 text-[10px] uppercase tracking-widest font-bold">
              Custom taxes, surcharges or fees
            </p>
          </div>

          <div className="flex flex-row items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={14} />
              <input
                type="text"
                placeholder="Search add-ons..."
                value={priceAddonsSearchQuery}
                onChange={(e) => setPriceAddonsSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-10 py-2 text-xs text-white outline-none focus:border-gold transition-all"
              />
              {priceAddonsSearchQuery && (
                <button
                  onClick={() => setPriceAddonsSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <button
              onClick={() => {
                setEditingPriceAddon({
                  name: '',
                  type: 'percentage',
                  value: 0,
                  operation: 'addition',
                  target: 'gross',
                  active: true,
                  applyToBooking: true,
                  applyToOffers: true,
                  applyToTours: true,
                  hideLabelInBreakdown: false,
                  hideSatisfyDetails: false,
                  limitLocation: false,
                  bboxNorth: -37.5,
                  bboxSouth: -38.5,
                  bboxEast: 145.5,
                  bboxWest: 144.5,
                  bboxTarget: 'pickup',
                  limitDates: false,
                  startDate: '',
                  endDate: '',
                  limitTime: false,
                  startTime: '',
                  endTime: '',
                  limitDays: false,
                  selectedDays: [],
                  limitFleet: false,
                  selectedFleet: [],
                  limitService: false,
                  selectedServices: [],
                  limitExtras: false,
                  selectedExtras: [],
                  limitRideType: false,
                  rideTypeTarget: 'any',
                  connectionOperator: 'AND'
                });
                setShowPriceAddonModal(true);
              }}
              className="btn-primary px-6 py-2 flex items-center justify-center gap-2 shrink-0"
            >
              <Plus size={18} />
              <span className="hidden md:inline text-xs font-bold uppercase tracking-widest">
                Add Add-on
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(priceAddons || []).filter(a =>
            a.name?.toLowerCase().includes((priceAddonsSearchQuery || '').toLowerCase())
          ).map((addon, idx) => (
            <div key={`setting-addon-${addon.id || 'new'}-${addon.name || 'unnamed'}-${idx}`} className="glass p-6 rounded-2xl border border-white/5 hover:border-gold/30 transition-all group relative overflow-hidden flex flex-col justify-between min-h-[320px]">
              <div>
                <div className={cn(
                  "absolute top-0 right-0 text-white text-[8px] font-bold uppercase tracking-widest px-3 py-1 rounded-bl-xl transition-all",
                  addon.active ? "bg-green-600" : "bg-red-500"
                )}>
                  {addon.active ? "Active" : "Inactive"}
                </div>
                <div className="flex justify-between items-start mb-4 mt-2">
                  <div>
                    <h4 className="text-xl font-bold font-display text-gold mb-1">{addon.name}</h4>
                    <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">
                      Target: {addon.target}
                    </p>
                  </div>
                  <div className="bg-gold/10 p-1.5 rounded-lg flex flex-col items-center shrink-0">
                    <p className="text-[10px] uppercase font-bold text-gold">
                      {addon.operation === 'addition' ? '+' : '-'} {addon.type === 'percentage' ? `${addon.value}%` : `$${addon.value}`}
                    </p>
                  </div>
                </div>

                {/* Additional Details & Active Constraints */}
                <div className="space-y-2 border-t border-b border-white/[0.05] py-4 my-4 text-xs">
                  <div className="flex justify-between items-center text-[9px] text-white/40 tracking-wider font-bold">
                    <span>APPLIED PAGES:</span>
                    <span className="text-white font-mono flex gap-1 font-semibold uppercase text-[8px]">
                      {addon.applyToBooking !== false && <span className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded-md">Booking</span>}
                      {addon.applyToOffers !== false && <span className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded-md">Offers</span>}
                      {addon.applyToTours !== false && <span className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded-md">Tours</span>}
                    </span>
                  </div>

                  {(addon.activeStartDate || addon.activeEndDate) && (
                    <div className="flex justify-between items-center text-[9px] text-white/40 tracking-wider font-bold">
                      <span>VALIDITY RANGE:</span>
                      <span className="text-gold font-mono text-[8px] font-bold">
                        {addon.activeStartDate || "Anytime"} to {addon.activeEndDate || "Anytime"}
                      </span>
                    </div>
                  )}

                  {(addon.limitLocation || addon.limitDates || addon.limitTime || addon.limitDays || addon.limitFleet || addon.limitService || addon.limitRideType || addon.limitExtras) && (
                    <div className="flex justify-between items-center text-[9px] text-white/40 tracking-wider font-bold mt-1">
                      <span>LINK LOGIC:</span>
                      <span className={cn(
                        "font-mono font-bold text-[8px] px-1.5 py-0.5 rounded-md border",
                        addon.connectionOperator === 'OR' 
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/20" 
                          : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                      )}>
                        {addon.connectionOperator || 'AND'} (MATCH {(addon.connectionOperator || 'AND') === 'OR' ? 'ANY' : 'ALL'})
                      </span>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1 mt-2 pt-1">
                    {addon.limitLocation && <span className="text-[8px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-bold uppercase tracking-wider">GPS Area</span>}
                    {addon.limitDates && <span className="text-[8px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold uppercase tracking-wider">Dates</span>}
                    {addon.limitTime && <span className="text-[8px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold uppercase tracking-wider">Hours ({addon.startTime}-{addon.endTime})</span>}
                    {addon.limitDays && <span className="text-[8px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 font-bold uppercase tracking-wider">Weekdays</span>}
                    {addon.limitFleet && <span className="text-[8px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold uppercase tracking-wider">Fleet</span>}
                    {addon.limitService && <span className="text-[8px] px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-400 border border-pink-500/20 font-bold uppercase tracking-wider">Services</span>}
                    {addon.limitExtras && <span className="text-[8px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 font-bold uppercase tracking-wider">Extras ({addon.selectedExtras?.length || 0})</span>}
                    {addon.limitRideType && <span className="text-[8px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold uppercase tracking-wider">Ride Target</span>}
                    {!addon.limitLocation && !addon.limitDates && !addon.limitTime && !addon.limitDays && !addon.limitFleet && !addon.limitService && !addon.limitRideType && !addon.limitExtras && (
                      <span className="text-[8px] text-white/30 italic">No constraints (Universal)</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-4 items-center">
                {/* Active/Deactivate toggle (Icon Only) */}
                <button
                  onClick={() => handleTogglePriceAddonActive(addon.id)}
                  className={cn(
                    "p-2.5 rounded-xl transition-all border shrink-0",
                    addon.active 
                      ? "bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500 hover:text-white" 
                      : "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500 hover:text-white"
                  )}
                  title={addon.active ? "Deactivate Add-on" : "Activate Add-on"}
                >
                  <Power size={14} />
                </button>

                <button
                  onClick={() => {
                    const { id, ...addonData } = addon;
                    setEditingPriceAddon({ ...addonData, name: addon.name + ' (Copy)' });
                    setShowPriceAddonModal(true);
                  }}
                  className="p-2.5 bg-white/5 border border-white/5 text-gold rounded-xl hover:bg-gold hover:text-black transition-all shrink-0"
                  title="Duplicate Add-on"
                >
                  <Copy size={14} />
                </button>

                <button
                  onClick={() => {
                    setEditingPriceAddon(addon);
                    setShowPriceAddonModal(true);
                  }}
                  className="flex-1 py-2.5 bg-blue-500/10 text-blue-400 rounded-xl hover:bg-blue-500/50 hover:text-white text-[11px] font-bold uppercase tracking-wider transition-all border border-blue-500/10 flex items-center justify-center gap-1"
                  title="Edit Add-on"
                >
                  <Pencil size={12} /> Edit
                </button>

                <button
                  onClick={() => handleDeletePriceAddon(addon.id)}
                  className="flex-1 py-2.5 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/50 hover:text-white transition-all font-bold text-[11px] uppercase tracking-wider border border-red-500/10 flex items-center justify-center gap-1"
                  title="Delete Add-on"
                >
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
            </motion.div>
          )}

          {activeSubSection === 'booking' && (
            <motion.div
              key="booking"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="space-y-8"
            >
              {/* Booking Configuration */}
              <div className="glass p-6 md:p-8 rounded-3xl border border-white/5 w-full">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-xl font-display text-gold">
              Booking Configuration
            </h3>
            <p className="text-[10px] text-white/30 uppercase tracking-widest mt-1 font-bold">
              Core logic & pricing visibility rules
            </p>
          </div>

          <button
            onClick={() => handleUpdateSettings(systemSettings)}
            disabled={isSavingSettings}
            className={cn(
              "bg-gold text-black rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2",
              "hover:bg-white active:scale-95 shadow-lg shadow-gold/20",
              "w-auto py-2 px-4 md:py-3 md:px-6"
            )}
          >
            {isSavingSettings ? (
              <Loader2 className="h-4 w-4 animate-spin text-black" />
            ) : (
              <Save className="h-4 w-4 text-black" />
            )}
            <span className="hidden md:inline text-[10px] font-black uppercase tracking-widest">
              {isSavingSettings ? "Saving..." : "Save Configuration"}
            </span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Column 1: Financial & Visibility */}
          <div className="space-y-8">
            {/* Price Component Visibility */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-4 bg-gold rounded-full" />
                <h4 className="text-[10px] uppercase tracking-[0.2em] font-black text-white/40">
                  Price Component Visibility
                </h4>
              </div>

              <div className="p-5 bg-white/[0.03] rounded-2xl border border-white/5 space-y-5 hover:border-gold/20 transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold">Show Price Breakdown</p>
                    <p className="text-[9px] text-white/30 uppercase tracking-widest font-bold mt-0.5">
                      Enable detailed pricing options
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      setSystemSettings({
                        ...systemSettings,
                        showPriceBreakdown: !systemSettings?.showPriceBreakdown,
                      })
                    }
                    className={cn(
                      "w-11 h-6 rounded-full transition-all relative shrink-0",
                      systemSettings?.showPriceBreakdown ? "bg-gold" : "bg-white/10"
                    )}
                  >
                    <div
                      className={cn(
                        "absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm",
                        systemSettings?.showPriceBreakdown ? "right-1" : "left-1"
                      )}
                    />
                  </button>
                </div>

                {systemSettings?.showPriceBreakdown && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {[
                      { id: "showBasePrice", label: "Base Price" },
                      { id: "showDistancePrice", label: "Distance/Hour Price" },
                      { id: "showWaypointPrice", label: "Waypoint Price" },
                      { id: "showExtrasPrice", label: "Extras Price" },
                      { id: "showTax", label: "Tax" },
                      { id: "showDiscount", label: "Discount" },
                      { id: "showNetPrice", label: "Net Price" },
                      { id: "showGrossPrice", label: "Gross Price" },
                      { id: "showStripeFees", label: "Stripe Fees" },
                      { id: "showTotalPrice", label: "Total Price" },
                    ].map((pill: any) => (
                      <button
                        key={pill.id}
                        onClick={() =>
                          setSystemSettings({
                            ...systemSettings,
                            [pill.id]: !systemSettings?.[pill.id],
                          })
                        }
                        className={cn(
                          "text-[9px] px-3 py-1.5 rounded-lg font-black transition-all border",
                          systemSettings?.[pill.id]
                            ? "bg-green-500/20 text-green-500 border-green-500/30"
                            : "bg-red-500/10 text-red-500/60 border-red-500/10 hover:border-red-500/30"
                        )}
                      >
                        {pill.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Allowed Payment Methods */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-4 bg-gold rounded-full" />
                <h4 className="text-[10px] uppercase tracking-[0.2em] font-black text-white/40">
                  Allowed Payment Methods
                </h4>
              </div>

              <div className="flex items-center justify-between p-5 bg-white/[0.03] rounded-2xl border border-white/5 hover:border-gold/20 transition-all group">
                <div>
                  <p className="text-sm font-bold group-hover:text-gold transition-colors">Allow Stripe / Card Payment</p>
                  <p className="text-[9px] text-white/30 uppercase tracking-widest font-bold mt-0.5">
                    Enable credit & debit card payments via Stripe
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setSystemSettings({
                      ...systemSettings,
                      allowStripeCardPayment: systemSettings?.allowStripeCardPayment !== false ? false : true,
                    })
                  }
                  className={cn(
                    "w-11 h-6 rounded-full transition-all relative shrink-0",
                    systemSettings?.allowStripeCardPayment !== false ? "bg-gold" : "bg-white/10"
                  )}
                >
                  <div
                    className={cn(
                      "absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm",
                      systemSettings?.allowStripeCardPayment !== false ? "right-1" : "left-1"
                    )}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-5 bg-white/[0.03] rounded-2xl border border-white/5 hover:border-gold/20 transition-all group">
                <div>
                  <p className="text-sm font-bold group-hover:text-gold transition-colors">Allow Cash Payment</p>
                  <p className="text-[9px] text-white/30 uppercase tracking-widest font-bold mt-0.5">
                    Enable driver-direct cash collections
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setSystemSettings({
                      ...systemSettings,
                      allowCashPayment: systemSettings?.allowCashPayment !== false ? false : true,
                    })
                  }
                  className={cn(
                    "w-11 h-6 rounded-full transition-all relative shrink-0",
                    systemSettings?.allowCashPayment !== false ? "bg-gold" : "bg-white/10"
                  )}
                >
                  <div
                    className={cn(
                      "absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm",
                      systemSettings?.allowCashPayment !== false ? "right-1" : "left-1"
                    )}
                  />
                </button>
              </div>
            </div>

            {/* Financial Settings */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-4 bg-gold rounded-full" />
                <h4 className="text-[10px] uppercase tracking-[0.2em] font-black text-white/40">
                  Financial Settings
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="group">
                  <label className="text-[9px] uppercase tracking-widest font-black text-white/30 mb-2 block group-hover:text-gold transition-colors">
                    Tax Percentage (%)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={systemSettings?.taxPercentage || 0}
                      onChange={(e) =>
                        setSystemSettings({
                          ...systemSettings,
                          taxPercentage: parseFloat(e.target.value),
                        })
                      }
                      className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold/50 focus:bg-gold/5 transition-all text-white font-mono"
                    />
                  </div>
                </div>
                <div className="group">
                  <label className="text-[9px] uppercase tracking-widest font-black text-white/30 mb-2 block group-hover:text-gold transition-colors">
                    Stripe Fee (%)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={systemSettings?.stripeFeePercentage || 2.9}
                      onChange={(e) =>
                        setSystemSettings({
                          ...systemSettings,
                          stripeFeePercentage: parseFloat(e.target.value),
                        })
                      }
                      className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold/50 focus:bg-gold/5 transition-all text-white font-mono"
                    />
                  </div>
                </div>
                <div className="group">
                  <label className="text-[9px] uppercase tracking-widest font-black text-white/30 mb-2 block group-hover:text-gold transition-colors">
                    Waypoint Price ($)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={systemSettings?.waypointPrice || 0}
                      onChange={(e) =>
                        setSystemSettings({
                          ...systemSettings,
                          waypointPrice: parseFloat(e.target.value),
                        })
                      }
                      className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold/50 focus:bg-gold/5 transition-all text-white font-mono"
                    />
                  </div>
                </div>
                <div className="group">
                  <label className="text-[9px] uppercase tracking-widest font-black text-white/30 mb-2 block group-hover:text-gold transition-colors">
                    Waypoint Limit (Max)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={systemSettings?.waypointLimit || 5}
                      onChange={(e) =>
                        setSystemSettings({
                          ...systemSettings,
                          waypointLimit: parseInt(e.target.value),
                        })
                      }
                      className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold/50 focus:bg-gold/5 transition-all text-white font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Regional Restrictions */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-4 bg-gold rounded-full" />
                <h4 className="text-[10px] uppercase tracking-[0.2em] font-black text-white/40">
                  Regional Restrictions
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="group">
                  <label className="text-[9px] uppercase tracking-widest font-black text-white/30 mb-2 block group-hover:text-gold transition-colors">
                    Country Restriction (Regional)
                  </label>
                  <select
                    value={systemSettings?.limitCountry || ""}
                    onChange={(e) =>
                      setSystemSettings({
                        ...systemSettings,
                        limitCountry: e.target.value,
                      })
                    }
                    className="custom-select w-full"
                  >
                    {COUNTRIES.map(c => (
                      <option key={c.code} value={c.code}>
                        {c.name} {c.code ? `(${c.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="group">
                  <label className="text-[9px] uppercase tracking-widest font-black text-white/30 mb-2 block group-hover:text-gold transition-colors">
                    Zip Code Mask / Range
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 3000-3999"
                    value={systemSettings?.limitZipCode || ""}
                    onChange={(e) =>
                      setSystemSettings({
                        ...systemSettings,
                        limitZipCode: e.target.value,
                      })
                    }
                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold/50 focus:bg-gold/5 transition-all text-white font-mono placeholder:text-white/10"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Column 2: Logic & Metrics */}
          <div className="space-y-8">
            {/* Calculation Strategy */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-4 bg-gold rounded-full" />
                <h4 className="text-[10px] uppercase tracking-[0.2em] font-black text-white/40">
                  Calculation Strategy
                </h4>
              </div>

              <div className="p-5 bg-white/[0.03] rounded-2xl border border-white/5 space-y-6 hover:border-gold/20 transition-all">
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-bold">Calculation Type</p>
                    <p className="text-[9px] text-white/30 uppercase tracking-widest font-bold mt-0.5">
                      Base algorithm for vehicle distance pricing
                    </p>
                  </div>
                  <div className="flex gap-2 p-1 bg-black/20 rounded-xl border border-white/5">
                    <button
                      onClick={() => setSystemSettings({ ...systemSettings, distanceCalculationType: 'type1' })}
                      className={cn(
                        "flex-1 py-3 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] transition-all",
                        systemSettings?.distanceCalculationType !== 'type2'
                          ? "bg-gold text-black shadow-lg shadow-gold/10"
                          : "text-white/40 hover:text-white hover:bg-white/5"
                      )}
                    >
                      Type 1 (Range)
                    </button>
                    <button
                      onClick={() => setSystemSettings({ ...systemSettings, distanceCalculationType: 'type2' })}
                      className={cn(
                        "flex-1 py-3 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] transition-all",
                        systemSettings?.distanceCalculationType === 'type2'
                          ? "bg-gold text-black shadow-lg shadow-gold/10"
                          : "text-white/40 hover:text-white hover:bg-white/5"
                      )}
                    >
                      Type 2 (Cumulative)
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                  <div>
                    <p className="text-sm font-bold">Show Detailed Breakdown Icon</p>
                    <p className="text-[9px] text-white/30 uppercase tracking-widest font-bold mt-0.5">
                      Enable the "eye" info tooltip for users
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      setSystemSettings({
                        ...systemSettings,
                        showDistanceEyeIcon: !systemSettings?.showDistanceEyeIcon,
                      })
                    }
                    className={cn(
                      "w-11 h-6 rounded-full transition-all relative shrink-0",
                      systemSettings?.showDistanceEyeIcon ? "bg-gold" : "bg-white/10"
                    )}
                  >
                    <div
                      className={cn(
                        "absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm",
                        systemSettings?.showDistanceEyeIcon ? "right-1" : "left-1"
                      )}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Threshold Limits */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-4 bg-gold rounded-full" />
                <h4 className="text-[10px] uppercase tracking-[0.2em] font-black text-white/40">
                  Threshold Limits
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="group">
                  <label className="text-[9px] uppercase tracking-widest font-black text-white/30 mb-2 block group-hover:text-gold transition-colors">
                    Minimum Distance (KM)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 5"
                    value={systemSettings?.minKm || ""}
                    onChange={(e) =>
                      setSystemSettings({
                        ...systemSettings,
                        minKm: Number(e.target.value),
                      })
                    }
                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold/50 focus:bg-gold/5 transition-all text-white font-mono"
                  />
                </div>
                <div className="group">
                  <label className="text-[9px] uppercase tracking-widest font-black text-white/30 mb-2 block group-hover:text-gold transition-colors">
                    Maximum Distance (KM)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 100"
                    value={systemSettings?.maxKm || ""}
                    onChange={(e) =>
                      setSystemSettings({
                        ...systemSettings,
                        maxKm: Number(e.target.value),
                      })
                    }
                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold/50 focus:bg-gold/5 transition-all text-white font-mono"
                  />
                </div>
              </div>

              <div className="p-5 bg-gold/5 rounded-2xl border border-gold/10 space-y-3">
                <label className="text-[9px] uppercase tracking-widest font-black text-gold mb-1 block">
                  Early Pickup Alert Threshold (Minutes)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 30"
                  value={systemSettings?.earlyAlertTimeGap || 30}
                  onChange={(e) =>
                    setSystemSettings({
                      ...systemSettings,
                      earlyAlertTimeGap: Number(e.target.value),
                    })
                  }
                  className="w-full bg-black/20 border border-gold/20 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all text-gold font-mono"
                />
                <p className="text-[8px] text-white/40 uppercase tracking-[0.1em] font-medium italic">
                  * Triggers notification to customer {systemSettings?.earlyAlertTimeGap || 30}m before pickup if driver is arrived.
                </p>
              </div>
            </div>

            {/* Service Availability */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-4 bg-gold rounded-full" />
                <h4 className="text-[10px] uppercase tracking-[0.2em] font-black text-white/40">
                  Service Availability
                </h4>
              </div>

              <div className="grid grid-cols-2 gap-4 p-5 bg-white/[0.03] rounded-2xl border border-white/5">
                <div className="space-y-2">
                  <label className="text-[9px] uppercase tracking-widest font-black text-white/30 block">Booking Start</label>
                  <input
                    type="time"
                    value={systemSettings?.pickupHoursStart || '00:00'}
                    onChange={(e) => setSystemSettings({ ...systemSettings, pickupHoursStart: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-gold text-white font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] uppercase tracking-widest font-black text-white/30 block">Booking End</label>
                  <input
                    type="time"
                    value={systemSettings?.pickupHoursEnd || '23:59'}
                    onChange={(e) => setSystemSettings({ ...systemSettings, pickupHoursEnd: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-gold text-white font-mono"
                  />
                </div>
                <p className="col-span-2 text-[8px] text-white/20 uppercase tracking-widest text-center mt-1">General operational hours for new bookings</p>
              </div>

              <div className="p-5 bg-white/[0.03] rounded-2xl border border-white/5 space-y-5">
                <div className="flex items-center justify-between">
                  <h5 className="text-[10px] uppercase tracking-widest font-black text-gold">Hourly Constraints</h5>
                  <div className="flex gap-1.5">
                    <div className="w-1 h-1 rounded-full bg-gold/40" />
                    <div className="w-1 h-1 rounded-full bg-gold/40" />
                    <div className="w-1 h-1 rounded-full bg-gold/40" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[8px] uppercase tracking-widest font-black text-white/20 block">Min Hours</label>
                    <input
                      type="number"
                      value={systemSettings?.hourlyMinHours || 1}
                      onChange={(e) => setSystemSettings({ ...systemSettings, hourlyMinHours: parseFloat(e.target.value) || 1 })}
                      className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none focus:border-gold font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[8px] uppercase tracking-widest font-black text-white/20 block">Max Hours</label>
                    <input
                      type="number"
                      value={systemSettings?.hourlyMaxHours || 24}
                      onChange={(e) => setSystemSettings({ ...systemSettings, hourlyMaxHours: parseFloat(e.target.value) || 24 })}
                      className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none focus:border-gold font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[8px] uppercase tracking-widest font-black text-white/20 block">Step</label>
                    <input
                      type="number"
                      step="0.5"
                      value={systemSettings?.hourlyHourStep || 1}
                      onChange={(e) => setSystemSettings({ ...systemSettings, hourlyHourStep: parseFloat(e.target.value) || 1 })}
                      className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none focus:border-gold font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <label className="text-[9px] uppercase tracking-widest font-black text-white/30 block">Pickup Start</label>
                    <input
                      type="time"
                      value={systemSettings?.hourlyPickHoursStart || '00:00'}
                      onChange={(e) => setSystemSettings({ ...systemSettings, hourlyPickHoursStart: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-gold text-white font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] uppercase tracking-widest font-black text-white/30 block">Pickup End</label>
                    <input
                      type="time"
                      value={systemSettings?.hourlyPickHoursEnd || '23:59'}
                      onChange={(e) => setSystemSettings({ ...systemSettings, hourlyPickHoursEnd: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-gold text-white font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
            </motion.div>
          )}

          {activeSubSection === 'sms' && (
            <motion.div
              key="sms"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="space-y-8"
            >
              {/* SMS Section */}
              <div className="space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h3 className="text-xl sm:text-2xl font-display text-gold underline decoration-gold/20 underline-offset-8">SMS Notifications</h3>
            <p className="text-white/40 text-[10px] uppercase tracking-widest font-bold mt-2">Manage Twilio SMS alerts & templates</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleSeedSmsTemplates}
              disabled={isSeedingTemplates}
              className="glass px-6 py-3 rounded-xl border border-white/10 hover:border-gold/50 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {isSeedingTemplates ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} className="text-gold" />}
              <span className="text-[9px] font-bold uppercase tracking-widest">Seed Samples</span>
            </button>
            <button
              onClick={() => {
                setEditingSmsTemplate({
                  name: '',
                  content: '',
                  recipients: ['customer'],
                  active: true,
                  event: 'booking_created'
                });
                setShowSmsTemplateModal(true);
              }}
              className="btn-primary flex items-center justify-center gap-2 py-3 px-6"
            >
              <Plus size={14} />
              <span className="text-[9px] font-bold uppercase tracking-widest">Create Template</span>
            </button>
          </div>
        </div>

        <div className="space-y-8">
          <div className="glass p-6 rounded-3xl border border-white/5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center text-gold shrink-0">
                  <Cog size={20} />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-gold">SMS Configuration</h4>
                  <p className="text-[9px] text-white/30 uppercase tracking-widest mt-0.5">Twilio Global Settings</p>
                </div>
              </div>

              <div className="flex flex-col lg:flex-row lg:items-center gap-6 flex-1 max-w-2xl">
                <div className="flex items-center justify-between gap-4 bg-white/5 px-5 py-3 rounded-2xl border border-white/10 flex-1">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">Master Switch</p>
                    <p className="text-[8px] text-white/30 uppercase tracking-tight">Enable Alerts</p>
                  </div>
                  <button
                    onClick={() => setSmsSettings({ ...smsSettings, enabled: !smsSettings?.enabled })}
                    className={cn(
                      "w-10 h-5 rounded-full transition-all relative shrink-0",
                      smsSettings?.enabled ? "bg-gold" : "bg-white/10"
                    )}
                  >
                    <div className={cn(
                      "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all",
                      smsSettings?.enabled ? "right-0.5" : "left-0.5"
                    )} />
                  </button>
                </div>

                <div className="flex-1">
                  <div className="relative">
                    <span className="absolute -top-2 left-4 px-2 bg-black text-[8px] font-bold text-white/30 uppercase tracking-widest">Admin Phone (E.164)</span>
                    <input
                      type="text"
                      placeholder="+1234567890"
                      value={smsSettings?.adminPhone || ''}
                      onChange={(e) => setSmsSettings({ ...smsSettings, adminPhone: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-xs outline-none focus:border-gold transition-all"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleUpdateSmsSettings(smsSettings)}
                disabled={isSavingSmsSettings}
                className="btn-primary py-3 px-6 h-fit whitespace-nowrap flex items-center gap-2"
              >
                {isSavingSmsSettings ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                <span className="text-[10px] font-bold uppercase tracking-widest">Save Settings</span>
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-2 px-1">
              <List size={14} className="text-gold" />
              <h4 className="text-[10px] uppercase font-bold tracking-[0.3em] text-white/40">SMS Templates Grid</h4>
            </div>
            {(smsTemplates || []).length === 0 ? (
              <div className="glass p-12 flex flex-col items-center justify-center text-center rounded-3xl border border-white/5">
                <MessageSquare className="text-white/10 mb-4" size={48} />
                <h4 className="text-white/60 font-medium mb-1">No Templates Found</h4>
                <p className="text-white/30 text-xs">Create your first SMS template to start sending alerts.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(smsTemplates || []).map((template, idx) => (
                  <div key={`sms-tmpl-item-${template.id || 'none'}-${idx}`} className="glass p-6 rounded-3xl border border-white/5 hover:border-gold/30 transition-all group relative overflow-hidden flex flex-col h-full">
                    <div className="absolute top-4 right-4">
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        template.active ? "bg-green-500 shadow-[0_0_8px_#22c55e]" : "bg-red-500"
                      )} />
                    </div>

                    <div className="mb-4">
                      <h5 className="text-gold font-bold text-[11px] tracking-widest mb-3 uppercase truncate pr-4">{template.name}</h5>
                      <div className="flex flex-wrap gap-1.5">
                        {template.recipients?.map((r: string, rIdx: number) => (
                          <span key={`sms-recip-${template.id || idx}-${r}-${rIdx}`} className="text-[7px] bg-white/10 text-white/60 px-1.5 py-0.5 rounded uppercase tracking-widest font-black border border-white/5">
                            {r}
                          </span>
                        ))}
                        <span className="text-[7px] bg-gold/10 text-gold px-1.5 py-0.5 rounded uppercase tracking-widest font-black border border-gold/10">
                          {template.event?.replace('status_', '').replace('_', ' ')}
                        </span>
                      </div>
                    </div>

                    <div className="bg-black/40 p-4 rounded-xl border border-white/5 flex-grow mb-6 relative group/content">
                      <p className="text-[10px] text-white/50 italic line-clamp-4 leading-relaxed tracking-wide">"{template.content}"</p>
                      <div className="absolute inset-0 bg-gold/0 group-hover/content:bg-gold/5 transition-colors pointer-events-none rounded-xl" />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleTestSmsTemplate(template)}
                        disabled={isTestingSmsId === template.id}
                        className="w-10 h-10 bg-gold/10 text-gold rounded-xl hover:bg-gold hover:text-black transition-all border border-gold/20 flex items-center justify-center shrink-0"
                        title="Send Test Message"
                      >
                        {isTestingSmsId === template.id ? <Loader2 size={16} className="animate-spin" /> : <Send size={14} />}
                      </button>
                      <button
                        onClick={() => {
                          const { id, createdAt, updatedAt, ...rest } = template;
                          setEditingSmsTemplate({
                            ...rest,
                            name: `${template.name} (Copy)`,
                          });
                          setShowSmsTemplateModal(true);
                        }}
                        className="w-10 h-10 bg-blue-500/10 text-blue-500 rounded-xl hover:bg-blue-500 hover:text-white transition-all border border-blue-500/20 flex items-center justify-center shrink-0"
                        title="Duplicate Template"
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        onClick={() => {
                          setEditingSmsTemplate(template);
                          setShowSmsTemplateModal(true);
                        }}
                        className="flex-1 py-3 bg-white/5 hover:bg-gold hover:text-black rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all border border-white/10"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteSmsTemplate(template.id)}
                        className="w-10 h-10 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all border border-red-500/20 flex items-center justify-center shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
            </motion.div>
          )}

          {activeSubSection === 'email' && (
            <motion.div
              key="email"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="space-y-8"
            >
              {/* Email Section */}
              <div className="space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h3 className="text-xl sm:text-2xl font-display text-gold underline decoration-gold/20 underline-offset-8">Email Notifications</h3>
            <p className="text-white/40 text-[10px] uppercase tracking-widest font-bold mt-2">Manage Email alerts & templates</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleSeedEmailTemplates}
              disabled={isSeedingEmailTemplates}
              className="glass px-6 py-3 rounded-xl border border-white/10 hover:border-gold/50 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {isSeedingEmailTemplates ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} className="text-gold" />}
              <span className="text-[9px] uppercase font-bold tracking-widest">Seed Samples</span>
            </button>
            <button
              onClick={() => {
                setEditingEmailTemplate({
                  name: '',
                  subject: '',
                  content: '',
                  recipients: ['customer'],
                  active: true,
                  event: 'booking_created'
                });
                setShowEmailTemplateModal(true);
              }}
              className="btn-primary flex items-center justify-center gap-2 py-3 px-6"
            >
              <Plus size={18} />
              <span className="text-[9px] font-bold uppercase tracking-widest">Create Template</span>
            </button>
          </div>
        </div>

        <div className="space-y-8">
          <div className="glass p-6 rounded-3xl border border-white/5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center text-gold shrink-0">
                  <Mail size={20} />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-gold">Email Configuration</h4>
                  <p className="text-[9px] text-white/30 uppercase tracking-widest mt-0.5">SMTP & Alerts Settings</p>
                </div>
              </div>

              <div className="flex flex-col lg:flex-row lg:items-center gap-6 flex-1 max-w-2xl">
                <div className="flex items-center justify-between gap-4 bg-white/5 px-5 py-3 rounded-2xl border border-white/10 flex-1">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">Master Switch</p>
                    <p className="text-[8px] text-white/30 uppercase tracking-tight">Enable Emails</p>
                  </div>
                  <button
                    onClick={() => setEmailSettings({ ...emailSettings, enabled: !emailSettings?.enabled })}
                    className={cn(
                      "w-10 h-5 rounded-full transition-all relative shrink-0",
                      emailSettings?.enabled ? "bg-gold" : "bg-white/10"
                    )}
                  >
                    <div className={cn(
                      "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all",
                      emailSettings?.enabled ? "right-0.5" : "left-0.5"
                    )} />
                  </button>
                </div>

                <div className="flex-1">
                  <div className="relative">
                    <span className="absolute -top-2 left-4 px-2 bg-black text-[8px] font-bold text-white/30 uppercase tracking-widest">Admin Notification Email</span>
                    <input
                      type="email"
                      placeholder="admin@merlux.au"
                      value={emailSettings?.adminEmail || ''}
                      onChange={(e) => setEmailSettings({ ...emailSettings, adminEmail: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-xs outline-none focus:border-gold transition-all"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleUpdateEmailSettings(emailSettings)}
                disabled={isSavingEmailSettings}
                className="btn-primary py-3 px-6 h-fit whitespace-nowrap flex items-center gap-2"
              >
                {isSavingEmailSettings ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                <span className="text-[10px] font-bold uppercase tracking-widest">Save Settings</span>
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-2 px-1">
              <LayoutGrid size={14} className="text-gold" />
              <h4 className="text-[10px] uppercase font-bold tracking-[0.3em] text-white/40">Email Templates Grid</h4>
            </div>
            {(emailTemplates || []).length === 0 ? (
              <div className="glass p-12 flex flex-col items-center justify-center text-center rounded-3xl border border-white/5">
                <Mail className="text-white/10 mb-4" size={48} />
                <h4 className="text-white/60 font-medium mb-1">No Templates Found</h4>
                <p className="text-white/30 text-xs">Create your first Email template to start sending alerts.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(emailTemplates || []).map((template, idx) => (
                  <div key={`email-tmpl-item-${template.id || 'none'}-${idx}`} className="glass p-6 rounded-3xl border border-white/5 hover:border-gold/30 transition-all group relative overflow-hidden flex flex-col h-full">
                    <div className="absolute top-4 right-4">
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        template.active ? "bg-green-500 shadow-[0_0_8px_#22c55e]" : "bg-red-500"
                      )} />
                    </div>

                    <div className="mb-4">
                      <h5 className="text-gold font-bold text-[11px] tracking-widest mb-3 uppercase truncate pr-4">{template.name}</h5>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {template.recipients?.map((r: string, rIdx: number) => (
                          <span key={`em-recip-${template.id || idx}-${r}-${rIdx}`} className="text-[7px] bg-white/10 text-white/60 px-1.5 py-0.5 rounded uppercase tracking-widest font-black border border-white/5">
                            {r}
                          </span>
                        ))}
                        <span className="text-[7px] bg-gold/10 text-gold px-1.5 py-0.5 rounded uppercase tracking-widest font-black border border-gold/10">
                          {template.event?.replace('status_', '').replace('_', ' ')}
                        </span>
                      </div>
                      <div className="bg-white/5 px-3 py-2 rounded-lg border border-white/5">
                        <p className="text-[9px] text-white/80 font-bold truncate tracking-tight">
                          <span className="text-gold/40 mr-1 uppercase text-[7px]">Subject:</span>
                          {template.subject}
                        </p>
                      </div>
                    </div>

                    <div className="bg-black/40 p-4 rounded-xl border border-white/5 flex-grow mb-6 relative group/content">
                      <p className="text-[10px] text-white/50 italic line-clamp-3 leading-relaxed tracking-wide">"{template.content.replace(/<[^>]*>?/gm, '')}"</p>
                      <div className="absolute inset-0 bg-gold/0 group-hover/content:bg-gold/5 transition-colors pointer-events-none rounded-xl" />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleTestEmailTemplate(template)}
                        disabled={isTestingEmailId === template.id}
                        className="w-10 h-10 bg-gold/10 text-gold rounded-xl hover:bg-gold hover:text-black transition-all border border-gold/20 flex items-center justify-center shrink-0"
                        title="Send Test Email"
                      >
                        {isTestingEmailId === template.id ? <Loader2 size={16} className="animate-spin" /> : <Send size={14} />}
                      </button>
                      <button
                        onClick={() => {
                          const { id, createdAt, updatedAt, ...rest } = template;
                          setEditingEmailTemplate({
                            ...rest,
                            name: `${template.name} (Copy)`,
                          });
                          setShowEmailTemplateModal(true);
                        }}
                        className="w-10 h-10 bg-blue-500/10 text-blue-500 rounded-xl hover:bg-blue-500 hover:text-white transition-all border border-blue-500/20 flex items-center justify-center shrink-0"
                        title="Duplicate Template"
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        onClick={() => {
                          setEditingEmailTemplate(template);
                          setShowEmailTemplateModal(true);
                        }}
                        className="flex-1 py-3 bg-white/5 hover:bg-gold hover:text-black rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all border border-white/10"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteEmailTemplate(template.id)}
                        className="w-10 h-10 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all border border-red-500/20 flex items-center justify-center shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
            </motion.div>
          )}

          {activeSubSection === 'backup' && (
            <motion.div
              key="backup"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="space-y-8"
            >
              {/* System Backup & Recovery */}
              <div className="space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-1">
          <div>
            <h3 className="text-xl sm:text-2xl font-display text-gold">
              System Backup & Recovery
            </h3>
            <p className="text-white/30 text-[10px] font-bold mt-1 flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-gold/50" />
              Backend Data Lifecycle Management
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-8">
          {/* Export Panel */}
          <div className="glass p-6 md:p-8 rounded-[2rem] border border-white/5 space-y-8 relative overflow-hidden group/panel w-full">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gold/5 blur-[60px] -mr-16 -mt-16 pointer-events-none transition-all duration-700 group-hover/panel:bg-gold/10" />
            
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gold/10 rounded-2xl flex items-center justify-center border border-gold/20 shadow-lg shadow-gold/5 group-hover:scale-110 transition-transform duration-500">
                <Download className="text-gold" size={24} />
              </div>
              <div>
                <h4 className="text-[13px] font-bold text-white tracking-wide">Export Data Sets</h4>
                <p className="text-[10px] text-white/30 font-medium">Snapshot download in JSON format</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <p className="text-[10px] text-gold/60 font-bold uppercase tracking-wider">Collection Selector</p>
                <button
                  onClick={() => {
                    if ((selectedCollectionsForExport || []).length === (ALL_COLLECTIONS || []).length) {
                      setSelectedCollectionsForExport([]);
                    } else {
                      setSelectedCollectionsForExport((ALL_COLLECTIONS || []).map(c => c.id));
                    }
                  }}
                  className="text-[10px] font-bold text-white/40 hover:text-gold transition-all flex items-center gap-1.5 active:scale-95"
                >
                  <Plus size={10} className={cn("transition-transform duration-300", (selectedCollectionsForExport || []).length === (ALL_COLLECTIONS || []).length && "rotate-45")} />
                  {(selectedCollectionsForExport || []).length === (ALL_COLLECTIONS || []).length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              
              <div className="custom-scrollbar overflow-y-auto max-h-[300px] pr-2 space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3">
                  {(ALL_COLLECTIONS || []).map((col: any) => (
                    <label 
                      key={`backup-collection-${col.id}`} 
                      className={cn(
                        "flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-2xl cursor-pointer hover:bg-gold/5 transition-all group/item",
                        (selectedCollectionsForExport || []).includes(col.id) ? "border-gold/30 bg-gold/[0.03]" : ""
                      )}
                    >
                      <div className="flex flex-col">
                        <span className={cn(
                          "text-[11px] font-bold transition-colors",
                          (selectedCollectionsForExport || []).includes(col.id) ? "text-gold" : "text-white/60 group-item-hover:text-gold"
                        )}>
                          {col.label}
                        </span>
                        <span className="text-[9px] text-white/20 font-medium mt-0.5">
                          {exportTotals?.[col.id] !== undefined ? `${exportTotals[col.id]} records` : 'fetching...'}
                        </span>
                      </div>
                      <div className={cn(
                        "w-4 h-4 rounded-lg border-2 flex items-center justify-center transition-all",
                        (selectedCollectionsForExport || []).includes(col.id) 
                          ? "bg-gold border-gold scale-105" 
                          : "border-white/10 group-item-hover:border-gold/30"
                      )}>
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={(selectedCollectionsForExport || []).includes(col.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCollectionsForExport([...(selectedCollectionsForExport || []), col.id]);
                            } else {
                              setSelectedCollectionsForExport((selectedCollectionsForExport || []).filter(id => id !== col.id));
                            }
                          }}
                        />
                        {(selectedCollectionsForExport || []).includes(col.id) && <Check size={10} className="text-black font-black" strokeWidth={3} />}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={handleExportData}
                disabled={isExporting || (selectedCollectionsForExport || []).length === 0}
                className="w-full bg-gold text-black py-4 rounded-2xl font-bold text-[11px] uppercase tracking-widest hover:shadow-lg hover:shadow-gold/20 active:scale-[0.98] transition-all disabled:opacity-20 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1 group/btn"
              >
                {isExporting ? (
                  <div className="flex items-center gap-3">
                    <Loader2 size={18} className="animate-spin" />
                    <span>Processing...</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <Download size={18} className="group-hover/btn:translate-y-[-2px] transition-transform duration-300" />
                      <span>Download Archive</span>
                    </div>
                    <span className="text-[9px] opacity-40 font-bold mt-0.5">
                      Batch Total: {(selectedCollectionsForExport || []).reduce((acc, id) => acc + (exportTotals?.[id] || 0), 0)} Documents
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Import Panel */}
          <div className="glass p-6 md:p-8 rounded-[2rem] border border-white/5 space-y-8 relative overflow-hidden group/import">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[60px] -mr-16 -mt-16 pointer-events-none transition-all duration-700 group-hover/import:bg-blue-500/10" />

            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20 shadow-lg shadow-blue-500/5 group-hover:scale-110 transition-transform duration-500">
                <FileUp className="text-blue-500" size={24} />
              </div>
              <div>
                <h4 className="text-[13px] font-bold text-white tracking-wide">Restore Snapshot</h4>
                <p className="text-[10px] text-white/30 font-medium">Emergency database restoration tool</p>
              </div>
            </div>

            <div className="p-6 bg-red-500/[0.02] border border-red-500/20 rounded-2xl space-y-3 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/[0.02] blur-3xl pointer-events-none" />
              <div className="flex items-center gap-2 text-red-500">
                <AlertCircle size={16} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Data Safety Warning</span>
              </div>
              <p className="text-[11px] text-white/50 leading-relaxed font-medium">
                This operation will <span className="text-red-500 font-bold">PERMANENTLY OVERWRITE</span> your current live data. This action is destructive and cannot be undone.
              </p>
            </div>

            <div className="relative group/drop h-full flex flex-col">
              <input
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                disabled={isImporting}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
              />
              <div className={cn(
                "flex-grow min-h-[160px] border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-4 transition-all duration-500",
                isImporting 
                  ? "bg-blue-500/10 border-blue-500 shadow-[inset_0_0_20px_rgba(59,130,246,0.1)]" 
                  : "bg-white/[0.01] border-white/5 group-hover/drop:border-blue-500/40 group-hover/drop:bg-blue-500/[0.02]"
              )}>
                {isImporting ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 size={28} className="text-blue-500 animate-spin" />
                    <div className="text-center">
                      <span className="text-[11px] text-blue-500 font-bold block uppercase tracking-wider">Synchronizing</span>
                      <span className="text-[9px] text-white/20 font-medium mt-0.5 block">Cloud Update in Progress</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="p-4 bg-blue-500/10 rounded-2xl group-hover/drop:scale-110 transition-all duration-500">
                      <FileJson size={28} className="text-blue-500" />
                    </div>
                    <div className="text-center space-y-1 px-6">
                      <span className="text-[11px] text-white font-bold group-hover/drop:text-blue-500 transition-colors uppercase tracking-wider">Select Archive File</span>
                      <p className="text-[10px] text-white/20 font-medium">Drag & Drop or Click to browse</p>
                    </div>
                  </>
                )}
              </div>
            </div>


            {importError && (
              <FormNotice
                isFloating={false}
                type="error"
                title="System Conflict"
                message={importError}
                onClose={() => setImportError(null)}
              />
            )}

            {importStats && (
              <div className="p-6 bg-green-500/[0.03] border border-green-500/20 rounded-[1.5rem] animate-in zoom-in slide-in-from-top-2 duration-700">
                <div className="flex items-center gap-3 mb-5 border-b border-white/5 pb-4">
                  <div className="w-8 h-8 bg-green-500/10 rounded-lg flex items-center justify-center">
                    <CheckCircle2 size={16} className="text-green-500" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-[0.2em] font-black text-green-500/80">Batch Integrity Results</span>
                    <p className="text-[8px] text-white/20 uppercase font-bold">Import cycle completed successfully</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex flex-col items-center p-4 bg-green-500/5 rounded-2xl border border-green-500/10 shadow-sm">
                    <span className="text-lg font-display text-green-500">{importStats.new}</span>
                    <span className="text-[7px] uppercase font-black text-white/40 tracking-tighter">New Records</span>
                  </div>
                  <div className="flex flex-col items-center p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
                    <span className="text-lg font-display text-blue-500">{importStats.overwritten}</span>
                    <span className="text-[7px] uppercase font-black text-white/40 tracking-tighter">Overwritten</span>
                  </div>
                  <div className="flex flex-col items-center p-3 bg-white/5 rounded-xl border border-white/10">
                    <span className="text-lg font-display text-white/40">{importStats.skipped || 0}</span>
                    <span className="text-[7px] uppercase font-black text-white/40 tracking-tighter">Skipped</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 px-2">
              <div className="w-2 h-2 rounded-full bg-gold animate-pulse" />
              <p className="text-[9px] text-white/30 uppercase tracking-widest font-bold">Standard Merlux JSON structure required.</p>
            </div>
          </div>
        </div>
      </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {/* Extra Modal */}
        {showExtraModal && (
          <motion.div
            key="extra-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-md glass p-8 rounded-3xl border border-gold/20"
            >
              {/* Heading + Active toggle inline */}
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-display text-gold">
                  {editingExtra?.id ? 'Edit Extra' : 'Add Extra'}
                </h3>

                <div className="flex items-center gap-3">
                  {/* Active toggle inline with heading */}
                  <div className="flex items-center gap-2">
                    {/* State label with colour */}
                    <span
                      className={cn(
                        "text-[10px] font-bold uppercase transition-colors",
                        editingExtra?.active ? "text-green-400" : "text-red-400"
                      )}
                    >
                      {editingExtra?.active ? "Active" : "Inactive"}
                    </span>

                    {/* Toggle button */}
                    <button
                      onClick={() =>
                        setEditingExtra({ ...editingExtra, active: !editingExtra.active })
                      }
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative",
                        editingExtra?.active ? "bg-green-500" : "bg-red-500/40"
                      )}
                    >
                      <div
                        className={cn(
                          "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                          editingExtra?.active ? "right-1" : "left-1"
                        )}
                      />
                    </button>
                  </div>

                  {/* Close button */}
                  <button
                    onClick={() => setShowExtraModal(false)}
                    className="text-white/40 hover:text-white"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">
                    Name
                  </label>
                  <input
                    type="text"
                    value={editingExtra?.name || ''}
                    onChange={(e) =>
                      setEditingExtra({ ...editingExtra, name: e.target.value })
                    }
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                    placeholder="Baby Seat"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">
                    Description
                  </label>
                  <textarea
                    value={editingExtra?.description || ''}
                    onChange={(e) =>
                      setEditingExtra({ ...editingExtra, description: e.target.value })
                    }
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all min-h-[100px]"
                    placeholder="Safe and comfortable baby seat for infants..."
                  />
                </div>

                {/* Price */}
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">
                    Price ($)
                  </label>
                  <input
                    type="number"
                    value={editingExtra?.price || 0}
                    onChange={(e) =>
                      setEditingExtra({
                        ...editingExtra,
                        price: parseFloat(e.target.value),
                      })
                    }
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                  />
                </div>

                {/* Action buttons */}
                <div className="pt-4 flex gap-4">
                  <button
                    onClick={() => setShowExtraModal(false)}
                    className="flex-1 py-3 text-xs font-bold uppercase border border-white/20 rounded-xl text-white/70 hover:text-white hover:border-white/40 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() =>
                      handleUpdateExtra(editingExtra.id, editingExtra)
                    }
                    className="flex-1 bg-gold text-black py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-white transition-all"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Vehicle Modal */}
        {showVehicleModal && (
          <motion.div
            key="vehicle-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-md glass p-8 rounded-xl border border-gold/20 max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-display text-gold">
                  {editingVehicle?.id ? 'Edit Vehicle' : 'Add Vehicle'}
                </h3>
                <button onClick={() => setShowVehicleModal(false)} className="text-white/40 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Vehicle Name</label>
                    <input
                      type="text"
                      value={editingVehicle?.name || ''}
                      onChange={(e) => setEditingVehicle({ ...editingVehicle, name: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                      placeholder="Luxury Sedan"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Model</label>
                    <input
                      type="text"
                      value={editingVehicle?.model || ''}
                      onChange={(e) => setEditingVehicle({ ...editingVehicle, model: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                      placeholder="Mercedes E-Class"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Number Plate No</label>
                  <input
                    type="text"
                    value={editingVehicle?.plateNo || ''}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, plateNo: e.target.value.toUpperCase() })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                    placeholder="e.g. 1AB-2CD"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Vehicle Type</label>
                  <select
                    value={editingVehicle?.type || 'sedan'}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, type: e.target.value })}
                    className="custom-select w-full py-3 text-sm"
                  >
                    <option value="sedan">Sedan</option>
                    <option value="suv">SUV</option>
                    <option value="van">Van</option>
                    <option value="sprinter">Sprinter</option>
                    <option value="firstclasssedan">First Class Sedan</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Passengers</label>
                    <input
                      type="number"
                      value={editingVehicle?.pax || 0}
                      onChange={(e) => setEditingVehicle({ ...editingVehicle, pax: parseInt(e.target.value) })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Luggage</label>
                    <input
                      type="number"
                      value={editingVehicle?.bags || 0}
                      onChange={(e) => setEditingVehicle({ ...editingVehicle, bags: parseInt(e.target.value) })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Base Fare ($)</label>
                    <input
                      type="number"
                      value={editingVehicle?.basePrice || 0}
                      onChange={(e) => setEditingVehicle({ ...editingVehicle, basePrice: parseFloat(e.target.value) })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Price per KM ($)</label>
                    <input
                      type="number"
                      value={editingVehicle?.price || 0}
                      onChange={(e) => setEditingVehicle({ ...editingVehicle, price: parseFloat(e.target.value) })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Hourly Price ($/HR)</label>
                  <input
                    type="number"
                    value={editingVehicle?.hourlyPrice || 0}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, hourlyPrice: parseFloat(e.target.value) })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Vehicle Image</label>
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editingVehicle?.img || ''}
                        onChange={(e) => setEditingVehicle({ ...editingVehicle, img: e.target.value })}
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                        placeholder="Image URL..."
                      />
                      <label className="cursor-pointer bg-white/5 hover:bg-gold hover:text-black border border-white/10 rounded-xl px-4 flex items-center justify-center transition-all">
                        <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={isUploading} />
                        {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                      </label>
                    </div>
                    {editingVehicle?.img && (
                      <div className="relative aspect-video rounded-xl overflow-hidden border border-white/10 bg-white/5">
                        <img
                          src={editingVehicle.img || null}
                          alt="Preview"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/car/800/450';
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-3">
                          <span className="text-[8px] uppercase tracking-widest font-bold text-white/60">Image Preview</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2 block">KM-Based Surcharges</label>
                  <div className="space-y-2">
                    {(editingVehicle?.kmRanges || []).map((range: any, index: number) => (
                      <div key={`km-${index}`} className="flex gap-2 items-center">
                        <input
                          type="text"
                          placeholder="0-25"
                          value={range.label}
                          onChange={(e) => {
                            const newRanges = [...editingVehicle.kmRanges];
                            newRanges[index].label = e.target.value;
                            setEditingVehicle({ ...editingVehicle, kmRanges: newRanges });
                          }}
                          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none focus:border-gold"
                        />
                        <input
                          type="number"
                          placeholder="$0"
                          value={range.surcharge}
                          onChange={(e) => {
                            const newRanges = [...editingVehicle.kmRanges];
                            newRanges[index].surcharge = parseFloat(e.target.value);
                            setEditingVehicle({ ...editingVehicle, kmRanges: newRanges });
                          }}
                          className="w-24 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none focus:border-gold"
                        />
                        <button
                          onClick={() => {
                            const newRanges = editingVehicle.kmRanges.filter((_: any, i: number) => i !== index);
                            setEditingVehicle({ ...editingVehicle, kmRanges: newRanges });
                          }}
                          className="p-2 text-white/20 hover:text-red-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        const newRanges = [...(editingVehicle.kmRanges || []), { label: '', surcharge: 0 }];
                        setEditingVehicle({ ...editingVehicle, kmRanges: newRanges });
                      }}
                      className="w-full border border-dashed border-white/10 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest text-white/40 hover:border-gold/50 hover:text-gold transition-all"
                    >
                      + Add KM Range
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Excerpt (Short Description)</label>
                  <textarea
                    value={editingVehicle?.excerpt || ''}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, excerpt: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all h-20 resize-none"
                    placeholder="Short summary for fleet listing..."
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2 block">Key Features</label>
                  <div className="space-y-2">
                    {(editingVehicle?.features || []).map((feature: string, index: number) => (
                      <div key={`feature-${index}`} className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={feature}
                          onChange={(e) => {
                            const newFeatures = [...editingVehicle.features];
                            newFeatures[index] = e.target.value;
                            setEditingVehicle({ ...editingVehicle, features: newFeatures });
                          }}
                          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none focus:border-gold"
                        />
                        <button
                          onClick={() => {
                            const newFeatures = (editingVehicle?.features || []).filter((_: any, i: number) => i !== index);
                            setEditingVehicle({ ...editingVehicle, features: newFeatures });
                          }}
                          className="p-2 text-white/20 hover:text-red-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        const newFeatures = [...(editingVehicle?.features || []), ''];
                        setEditingVehicle({ ...editingVehicle, features: newFeatures });
                      }}
                      className="w-full border border-dashed border-white/10 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest text-white/40 hover:border-gold/50 hover:text-gold transition-all"
                    >
                      + Add Feature
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2 block">Best For</label>
                  <div className="space-y-2">
                    {(editingVehicle?.bestFor || []).map((item: string, index: number) => (
                      <div key={`bestfor-${index}`} className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={item}
                          onChange={(e) => {
                            const newBestFor = [...editingVehicle.bestFor];
                            newBestFor[index] = e.target.value;
                            setEditingVehicle({ ...editingVehicle, bestFor: newBestFor });
                          }}
                          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none focus:border-gold"
                        />
                        <button
                          onClick={() => {
                            const newBestFor = (editingVehicle?.bestFor || []).filter((_: any, i: number) => i !== index);
                            setEditingVehicle({ ...editingVehicle, bestFor: newBestFor });
                          }}
                          className="p-2 text-white/20 hover:text-red-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        const newBestFor = [...(editingVehicle?.bestFor || []), ''];
                        setEditingVehicle({ ...editingVehicle, bestFor: newBestFor });
                      }}
                      className="w-full border border-dashed border-white/10 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest text-white/40 hover:border-gold/50 hover:text-gold transition-all"
                    >
                      + Add Best For
                    </button>
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <button
                    onClick={() => setShowVehicleModal(false)}
                    className="flex-1 py-3 text-xs font-bold uppercase border border-white/20 rounded-xl text-white/70 hover:text-white hover:border-white/40 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (editingVehicle.id && editingVehicle.id !== 'new') {
                        handleUpdateVehicle(editingVehicle.id, editingVehicle);
                      } else {
                        handleUpdateVehicle('new', editingVehicle);
                      }
                    }}
                    className="flex-1 bg-gold text-black py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-white transition-all"
                  >
                    {editingVehicle?.id ? 'Save Changes' : 'Add Vehicle'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Coupon Modal */}
        {showCouponModal && (
          <motion.div
            key="coupon-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-md glass p-8 rounded-3xl border border-gold/20 max-h-[90vh] overflow-y-auto"
            >
              {/* Heading row: Title + Active toggle + Close button */}
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-display text-gold">
                  {editingCoupon?.id ? "Edit Coupon" : "Add Coupon"}
                </h3>

                <div className="flex items-center gap-4">
                  {/* Active toggle with coloured label */}
                  <div className="flex items-center gap-2 cursor-pointer">
                    <span
                      className={cn(
                        "text-[10px] uppercase tracking-widest font-bold transition-colors",
                        editingCoupon?.active ? "text-green-400" : "text-red-400"
                      )}
                    >
                      {editingCoupon?.active ? "Active" : "Inactive"}
                    </span>
                    <button
                      onClick={() =>
                        setEditingCoupon({ ...editingCoupon, active: !editingCoupon.active })
                      }
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative",
                        editingCoupon?.active ? "bg-green-500" : "bg-red-500/40"
                      )}
                    >
                      <div
                        className={cn(
                          "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                          editingCoupon?.active ? "right-1" : "left-1"
                        )}
                      />
                    </button>
                  </div>

                  {/* Close button */}
                  <button
                    onClick={() => setShowCouponModal(false)}
                    className="text-white/40 hover:text-white transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {/* Row 1: Coupon Code */}
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">
                    Coupon Code
                  </label>
                  <input
                    type="text"
                    value={editingCoupon?.code || ""}
                    onChange={(e) =>
                      setEditingCoupon({
                        ...editingCoupon,
                        code: e.target.value.toUpperCase(),
                      })
                    }
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                    placeholder="SAVE20"
                  />
                </div>

                {/* Row 2: Value + Type + Usage Limit */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">
                      Value
                    </label>
                    <input
                      type="number"
                      value={editingCoupon?.value || 0}
                      onChange={(e) =>
                        setEditingCoupon({
                          ...editingCoupon,
                          value: parseFloat(e.target.value),
                        })
                      }
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">
                      Type
                    </label>
                    <select
                      value={editingCoupon?.type || "percentage"}
                      onChange={(e) =>
                        setEditingCoupon({ ...editingCoupon, type: e.target.value })
                      }
                      className="custom-select w-full py-3 text-sm"
                    >
                      <option value="percentage">%</option>
                      <option value="fixed">$</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">
                      Usage Limit
                    </label>
                    <input
                      type="number"
                      value={editingCoupon?.usageLimit || 0}
                      onChange={(e) =>
                        setEditingCoupon({
                          ...editingCoupon,
                          usageLimit: parseInt(e.target.value),
                        })
                      }
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                      placeholder="0 for unlimited"
                    />
                  </div>
                </div>

                {/* Row 3: Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">
                      Start Date
                    </label>
                    <input
                      type="date"
                      min={new Date().toISOString().split('T')[0]}
                      value={editingCoupon?.startDate || ""}
                      onChange={(e) =>
                        setEditingCoupon({ ...editingCoupon, startDate: e.target.value })
                      }
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">
                      End Date
                    </label>
                    <input
                      type="date"
                      min={new Date().toISOString().split('T')[0]}
                      value={editingCoupon?.endDate || ""}
                      onChange={(e) =>
                        setEditingCoupon({ ...editingCoupon, endDate: e.target.value })
                      }
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                    />
                  </div>
                </div>

                {/* Row 4: Service Selection */}
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2 block">
                    Applicable Services
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {["airport", "corporate", "wedding", "event", "hourly", "occasions"].map(
                      (service) => (
                        <label
                          key={service}
                          className="flex items-center gap-2 p-2 bg-white/5 rounded-lg border border-white/5 cursor-pointer hover:border-gold/30 transition-all"
                        >
                          <input
                            type="checkbox"
                            checked={editingCoupon?.serviceIds?.includes(service)}
                            onChange={(e) => {
                              const current = editingCoupon?.serviceIds || [];
                              const next = e.target.checked
                                ? [...current, service]
                                : current.filter((s) => s !== service);
                              setEditingCoupon({ ...editingCoupon, serviceIds: next });
                            }}
                            className="w-3 h-3 rounded border-white/10 bg-white/5 text-gold focus:ring-gold"
                          />
                          <span className="text-[10px] uppercase tracking-widest font-bold text-white/60">
                            {service}
                          </span>
                        </label>
                      )
                    )}
                  </div>
                  <p className="text-[8px] text-white/30 mt-2 italic">
                    If none selected, coupon applies to all services.
                  </p>
                </div>

                {/* Actions */}
                <div className="pt-4 flex gap-4">
                  <button
                    onClick={() => setShowCouponModal(false)}
                    className="flex-1 py-3 text-xs font-bold uppercase border border-white/20 rounded-xl text-white/70 hover:text-white hover:border-white/40 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (editingCoupon.id && editingCoupon.id !== 'new') {
                        handleUpdateCoupon(editingCoupon.id, editingCoupon);
                      } else {
                        handleUpdateCoupon('new', editingCoupon);
                      }
                    }}
                    className="border border-white/5 flex-1 bg-gold text-black py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-white transition-all"
                  >
                    {editingCoupon?.id && editingCoupon.id !== 'new' ? "Save Changes" : "Create Coupon"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showPriceAddonModal && (
          <motion.div
            key="price-addon-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-xl glass p-8 rounded-3xl border border-gold/20 max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex justify-between items-center mb-6 border-b border-white/[0.05] pb-4">
                <h3 className="text-xl font-display text-gold">
                  {editingPriceAddon?.id ? "Edit Price Add-on" : "Add Price Add-on"}
                </h3>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 cursor-pointer">
                    <span
                      className={cn(
                        "text-[10px] uppercase tracking-widest font-bold transition-colors",
                        editingPriceAddon?.active ? "text-green-400" : "text-red-400"
                      )}
                    >
                      {editingPriceAddon?.active ? "Active" : "Inactive"}
                    </span>
                    <button
                      onClick={() =>
                        setEditingPriceAddon({ ...editingPriceAddon, active: !editingPriceAddon.active })
                      }
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative",
                        editingPriceAddon?.active ? "bg-green-500" : "bg-red-500/40"
                      )}
                    >
                      <div
                        className={cn(
                          "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                          editingPriceAddon?.active ? "right-1" : "left-1"
                        )}
                      />
                    </button>
                  </div>

                  <button
                    onClick={() => setShowPriceAddonModal(false)}
                    className="text-white/40 hover:text-white transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                {/* Core Settings Section */}
                <div className="space-y-4">
                  <h4 className="text-[11px] uppercase tracking-wider font-bold text-gold/80 border-b border-white/[0.03] pb-2">Basic Information</h4>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">
                      Add-on Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editingPriceAddon?.name || ""}
                      onChange={(e) =>
                        setEditingPriceAddon({
                          ...editingPriceAddon,
                          name: e.target.value,
                        })
                      }
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                      placeholder="Fuel Surcharge (e.g. Peak Surcharge)"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">
                        Value <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        value={editingPriceAddon?.value || 0}
                        onChange={(e) =>
                          setEditingPriceAddon({
                            ...editingPriceAddon,
                            value: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">
                        Value Type
                      </label>
                      <select
                        value={editingPriceAddon?.type || "percentage"}
                        onChange={(e) =>
                          setEditingPriceAddon({ ...editingPriceAddon, type: e.target.value })
                        }
                        className="custom-select w-full py-3 text-sm"
                      >
                        <option value="percentage">% Percentage</option>
                        <option value="fixed">$ Fixed Amount</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">
                        Operation
                      </label>
                      <select
                        value={editingPriceAddon?.operation || "addition"}
                        onChange={(e) =>
                          setEditingPriceAddon({ ...editingPriceAddon, operation: e.target.value })
                        }
                        className="custom-select w-full py-3 text-sm"
                      >
                        <option value="addition">Addition (+)</option>
                        <option value="subtraction">Subtraction (-)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">
                        Target Price Base
                      </label>
                      <select
                        value={editingPriceAddon?.target || "gross"}
                        onChange={(e) =>
                          setEditingPriceAddon({ ...editingPriceAddon, target: e.target.value })
                        }
                        className="custom-select w-full py-3 text-sm"
                      >
                        <option value="gross">Gross Price (Base)</option>
                        <option value="net">Net Price (Post-Discount)</option>
                        <option value="total">Total Price (Final)</option>
                      </select>
                    </div>
                  </div>

                  {/* Active Validity Date Range */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">
                        Activation Start Date
                      </label>
                      <input
                        type="date"
                        value={editingPriceAddon?.activeStartDate || ""}
                        onChange={(e) =>
                          setEditingPriceAddon({
                            ...editingPriceAddon,
                            activeStartDate: e.target.value,
                          })
                        }
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">
                        Activation End Date
                      </label>
                      <input
                        type="date"
                        value={editingPriceAddon?.activeEndDate || ""}
                        onChange={(e) =>
                          setEditingPriceAddon({
                            ...editingPriceAddon,
                            activeEndDate: e.target.value,
                          })
                        }
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all text-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="pt-2 space-y-2">
                    <label className="flex items-center gap-2.5 p-3.5 bg-white/5 rounded-xl border border-white/5 cursor-pointer hover:border-gold/30 transition-all">
                      <input
                        type="checkbox"
                        checked={!!editingPriceAddon?.hideLabelInBreakdown}
                        onChange={(e) => setEditingPriceAddon({ ...editingPriceAddon, hideLabelInBreakdown: e.target.checked })}
                        className="w-4 h-4 rounded border-white/10 bg-white/5 text-gold focus:ring-gold cursor-pointer"
                      />
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-widest font-bold text-white/80">Hide Label on Price Breakdown</span>
                        <span className="text-[9px] text-white/40">Keep value applied to transaction totals, but do not show separate list item in consumer breakdown summary sheets</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-2.5 p-3.5 bg-white/5 rounded-xl border border-white/5 cursor-pointer hover:border-gold/30 transition-all">
                      <input
                        type="checkbox"
                        checked={!!editingPriceAddon?.hideSatisfyDetails}
                        onChange={(e) => setEditingPriceAddon({ ...editingPriceAddon, hideSatisfyDetails: e.target.checked })}
                        className="w-4 h-4 rounded border-white/10 bg-white/5 text-gold focus:ring-gold cursor-pointer"
                      />
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-widest font-bold text-white/80">Hide Constraint (Satisfy) Details</span>
                        <span className="text-[9px] text-white/40">Hide the detailed list of matching criteria (like dates, times, or GPS areas) under the check item</span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Scope Application Section */}
                <div className="space-y-4 pt-2 border-t border-white/[0.03]">
                  <h4 className="text-[11px] uppercase tracking-wider font-bold text-gold/80 pb-2">Where to Apply</h4>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="flex items-center gap-2 p-2 bg-white/5 rounded-lg border border-white/5 cursor-pointer hover:border-gold/30 transition-all">
                      <input
                        type="checkbox"
                        checked={editingPriceAddon?.applyToBooking !== false}
                        onChange={(e) => setEditingPriceAddon({ ...editingPriceAddon, applyToBooking: e.target.checked })}
                        className="w-3 h-3 rounded border-white/10 bg-white/5 text-gold focus:ring-gold"
                      />
                      <span className="text-[10px] uppercase tracking-widest font-bold text-white/60">Booking Page</span>
                    </label>
                    <label className="flex items-center gap-2 p-2 bg-white/5 rounded-lg border border-white/5 cursor-pointer hover:border-gold/30 transition-all">
                      <input
                        type="checkbox"
                        checked={editingPriceAddon?.applyToOffers !== false}
                        onChange={(e) => setEditingPriceAddon({ ...editingPriceAddon, applyToOffers: e.target.checked })}
                        className="w-3 h-3 rounded border-white/10 bg-white/5 text-gold focus:ring-gold"
                      />
                      <span className="text-[10px] uppercase tracking-widest font-bold text-white/60">Offers Page</span>
                    </label>
                    <label className="flex items-center gap-2 p-2 bg-white/5 rounded-lg border border-white/5 cursor-pointer hover:border-gold/30 transition-all">
                      <input
                        type="checkbox"
                        checked={editingPriceAddon?.applyToTours !== false}
                        onChange={(e) => setEditingPriceAddon({ ...editingPriceAddon, applyToTours: e.target.checked })}
                        className="w-3 h-3 rounded border-white/10 bg-white/5 text-gold focus:ring-gold"
                      />
                      <span className="text-[10px] uppercase tracking-widest font-bold text-white/60">Tours Page</span>
                    </label>
                  </div>
                </div>

                {/* Advanced Conditional Constraints */}
                <div className="space-y-5 pt-4 border-t border-white/[0.05]">
                  <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-2.5">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-gold block">
                      Enable Multiple Connection Operator (LINK LOGIC)
                    </label>
                    <select
                      value={editingPriceAddon?.connectionOperator || "AND"}
                      onChange={(e) =>
                        setEditingPriceAddon({ ...editingPriceAddon, connectionOperator: e.target.value })
                      }
                      className="custom-select w-full py-2.5 text-xs font-bold"
                    >
                      <option value="AND">AND Connection (Require ALL enabled constraints to match)</option>
                      <option value="OR">OR Connection (Require ANY of the enabled constraints to match)</option>
                    </select>
                    <p className="text-[9px] text-white/40 leading-relaxed">
                      Control how constraints interact. Select <strong>AND</strong> to require every enabled constraint to pass, or <strong>OR</strong> to apply if any single enabled constraint is met.
                    </p>
                  </div>

                  <h4 className="text-[11px] uppercase tracking-wide font-bold text-gold/80 flex items-center justify-between">
                    <span>Advanced Conditional Constraints</span>
                    <span className="text-[8px] text-white/30 font-normal uppercase normal-case">
                      (Match Mode: {editingPriceAddon?.connectionOperator || "AND"})
                    </span>
                  </h4>

                  {/* 1. Location Bounding Box */}
                  <div className="space-y-2 bg-white/[0.01] p-3.5 rounded-2xl border border-white/5">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-white/80">GPS Bounding Box Restriction</span>
                        <span className="text-[9px] text-white/30">Apply only when route coordinate values reside within boundaries</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingPriceAddon({ ...editingPriceAddon, limitLocation: !editingPriceAddon.limitLocation })}
                        className={cn(
                          "w-10 h-5 rounded-full transition-all relative shrink-0",
                          editingPriceAddon?.limitLocation ? "bg-gold" : "bg-white/10"
                        )}
                      >
                        <div className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all", editingPriceAddon?.limitLocation ? "right-1" : "left-1")} />
                      </button>
                    </div>

                    {editingPriceAddon?.limitLocation && (
                      <div className="space-y-3 pt-3 border-t border-white/5">
                        <BBoxMap
                          bboxNorth={Number(editingPriceAddon?.bboxNorth) || -37.5}
                          bboxSouth={Number(editingPriceAddon?.bboxSouth) || -38.5}
                          bboxEast={Number(editingPriceAddon?.bboxEast) || 145.5}
                          bboxWest={Number(editingPriceAddon?.bboxWest) || 144.5}
                          bboxes={editingPriceAddon?.bboxes || []}
                          onChange={(bounds) => setEditingPriceAddon({
                            ...editingPriceAddon,
                            bboxNorth: bounds.north,
                            bboxSouth: bounds.south,
                            bboxEast: bounds.east,
                            bboxWest: bounds.west,
                          })}
                          onBBoxesChange={(updatedBBoxes) => setEditingPriceAddon({
                            ...editingPriceAddon,
                            bboxes: updatedBBoxes
                          })}
                        />

                        <div>
                          <label className="text-[9px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Coordinate to Check</label>
                          <select
                            value={editingPriceAddon?.bboxTarget || "pickup"}
                            onChange={(e) => setEditingPriceAddon({ ...editingPriceAddon, bboxTarget: e.target.value })}
                            className="custom-select w-full py-2 text-xs"
                          >
                            <option value="pickup">Pickup Location</option>
                            <option value="dropoff">Dropoff Location</option>
                            <option value="both">Both Pickup & Dropoff</option>
                            <option value="either">Either Pickup or Dropoff</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 2. Specific Date Selection */}
                  <div className="space-y-2 bg-white/[0.01] p-3.5 rounded-2xl border border-white/5">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-white/80">Date Range Limit</span>
                        <span className="text-[9px] text-white/30">Make add-on active only for specific reservation dates</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingPriceAddon({ ...editingPriceAddon, limitDates: !editingPriceAddon.limitDates })}
                        className={cn(
                          "w-10 h-5 rounded-full transition-all relative shrink-0",
                          editingPriceAddon?.limitDates ? "bg-gold" : "bg-white/10"
                        )}
                      >
                        <div className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all", editingPriceAddon?.limitDates ? "right-1" : "left-1")} />
                      </button>
                    </div>

                    {editingPriceAddon?.limitDates && (
                      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/5">
                        <div>
                          <label className="text-[9px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Start Date</label>
                          <input
                            type="date"
                            value={editingPriceAddon?.startDate || ""}
                            onChange={(e) => setEditingPriceAddon({ ...editingPriceAddon, startDate: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none focus:border-gold text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] uppercase tracking-widest font-bold text-white/40 mb-1 block">End Date</label>
                          <input
                            type="date"
                            value={editingPriceAddon?.endDate || ""}
                            onChange={(e) => setEditingPriceAddon({ ...editingPriceAddon, endDate: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none focus:border-gold text-white"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 3. Specific Time Selection */}
                  <div className="space-y-2 bg-white/[0.01] p-3.5 rounded-2xl border border-white/5">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-white/80">Time Window Limit</span>
                        <span className="text-[9px] text-white/30">Apply surcharge/discount within daily clock time ranges</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingPriceAddon({ ...editingPriceAddon, limitTime: !editingPriceAddon.limitTime })}
                        className={cn(
                          "w-10 h-5 rounded-full transition-all relative shrink-0",
                          editingPriceAddon?.limitTime ? "bg-gold" : "bg-white/10"
                        )}
                      >
                        <div className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all", editingPriceAddon?.limitTime ? "right-1" : "left-1")} />
                      </button>
                    </div>

                    {editingPriceAddon?.limitTime && (
                      <div className="space-y-3 pt-3 border-t border-white/5">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[9px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Start Time</label>
                            <input
                              type="time"
                              value={editingPriceAddon?.startTime || ""}
                              onChange={(e) => setEditingPriceAddon({ ...editingPriceAddon, startTime: e.target.value })}
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none focus:border-gold text-white"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] uppercase tracking-widest font-bold text-white/40 mb-1 block">End Time</label>
                            <input
                              type="time"
                              value={editingPriceAddon?.endTime || ""}
                              onChange={(e) => setEditingPriceAddon({ ...editingPriceAddon, endTime: e.target.value })}
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none focus:border-gold text-white"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[9px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Time to Check</label>
                          <select
                            value={editingPriceAddon?.timeTarget || "pickup"}
                            onChange={(e) => setEditingPriceAddon({ ...editingPriceAddon, timeTarget: e.target.value })}
                            className="custom-select w-full py-2 text-xs"
                          >
                            <option value="pickup">Pickup Time Only</option>
                            <option value="return">Return Time Only</option>
                            <option value="any">Any Time (Either Pickup or Return)</option>
                            <option value="both">Both Times (Pickup and Return must both align)</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 4. Days of the Week Selection */}
                  <div className="space-y-2 bg-white/[0.01] p-3.5 rounded-2xl border border-white/5">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-white/80">Weekly Days Limit</span>
                        <span className="text-[9px] text-white/30">Choose specific days of the week when this applies</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingPriceAddon({ ...editingPriceAddon, limitDays: !editingPriceAddon.limitDays })}
                        className={cn(
                          "w-10 h-5 rounded-full transition-all relative shrink-0",
                          editingPriceAddon?.limitDays ? "bg-gold" : "bg-white/10"
                        )}
                      >
                        <div className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all", editingPriceAddon?.limitDays ? "right-1" : "left-1")} />
                      </button>
                    </div>

                    {editingPriceAddon?.limitDays && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-white/5">
                        {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => {
                          const current = editingPriceAddon?.selectedDays || [];
                          const isChecked = current.includes(day);
                          return (
                            <label key={day} className="flex items-center gap-1.5 p-1.5 bg-white/5 rounded-lg border border-white/5 cursor-pointer hover:border-gold/30 transition-all">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  const next = e.target.checked
                                    ? [...current, day]
                                    : current.filter((d: string) => d !== day);
                                  setEditingPriceAddon({ ...editingPriceAddon, selectedDays: next });
                                }}
                                className="w-3 h-3 rounded bg-white/5 text-gold border-white/10 focus:ring-gold"
                              />
                              <span className="text-[9px] uppercase tracking-widest font-bold text-white/70">{day.substring(0, 3)}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 5. Fleet Selection */}
                  <div className="space-y-2 bg-white/[0.01] p-3.5 rounded-2xl border border-white/5">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-white/80">Vehicle Fleet Limit</span>
                        <span className="text-[9px] text-white/30">Apply only to specific vehicles in your active fleet register</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingPriceAddon({ ...editingPriceAddon, limitFleet: !editingPriceAddon.limitFleet })}
                        className={cn(
                          "w-10 h-5 rounded-full transition-all relative shrink-0",
                          editingPriceAddon?.limitFleet ? "bg-gold" : "bg-white/10"
                        )}
                      >
                        <div className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all", editingPriceAddon?.limitFleet ? "right-1" : "left-1")} />
                      </button>
                    </div>

                    {editingPriceAddon?.limitFleet && (
                      <div className="space-y-2 pt-3 border-t border-white/5">
                        {(!fleet || fleet.length === 0) ? (
                          <p className="text-[10px] text-white/30 italic">No vehicles found in fleet settings.</p>
                        ) : (
                          <div className="grid grid-cols-2 gap-2 max-h-28 overflow-y-auto custom-scrollbar p-1">
                            {fleet.map((v) => {
                              const current = editingPriceAddon?.selectedFleet || [];
                              const isChecked = current.includes(v.id) || current.includes(v.name);
                              return (
                                <label key={v.id} className="flex items-center gap-2 p-1.5 bg-white/5 rounded-lg border border-white/5 cursor-pointer hover:border-gold/30 transition-all">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      const next = e.target.checked
                                        ? [...current, v.name]
                                        : current.filter((item: string) => item !== v.name && item !== v.id);
                                      setEditingPriceAddon({ ...editingPriceAddon, selectedFleet: next });
                                    }}
                                    className="w-3 h-3 rounded bg-white/5 text-gold border-white/10 focus:ring-gold"
                                  />
                                  <span className="text-[9px] uppercase tracking-wider font-bold text-white/70 truncate">{v.name}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 6. Service Selection */}
                  <div className="space-y-2 bg-white/[0.01] p-3.5 rounded-2xl border border-white/5">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-white/80">Service Type Limit</span>
                        <span className="text-[9px] text-white/30">Limit surcharge to wedding, corporate, airport services, etc.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingPriceAddon({ ...editingPriceAddon, limitService: !editingPriceAddon.limitService })}
                        className={cn(
                          "w-10 h-5 rounded-full transition-all relative shrink-0",
                          editingPriceAddon?.limitService ? "bg-gold" : "bg-white/10"
                        )}
                      >
                        <div className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all", editingPriceAddon?.limitService ? "right-1" : "left-1")} />
                      </button>
                    </div>

                    {editingPriceAddon?.limitService && (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pt-3 border-t border-white/5">
                        {["airport", "corporate", "wedding", "event", "hourly", "occasions", "offers", "tours"].map((service) => {
                          const current = editingPriceAddon?.selectedServices || [];
                          const isChecked = current.includes(service);
                          return (
                            <label key={service} className="flex items-center gap-2 p-1.5 bg-white/5 rounded-lg border border-white/5 cursor-pointer hover:border-gold/30 transition-all">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  const next = e.target.checked
                                    ? [...current, service]
                                    : current.filter((s: string) => s !== service);
                                  setEditingPriceAddon({ ...editingPriceAddon, selectedServices: next });
                                }}
                                className="w-3 h-3 rounded bg-white/5 text-gold border-white/10 focus:ring-gold"
                              />
                              <span className="text-[9px] uppercase tracking-widest font-bold text-white/70">{service}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 7. Ride Type: One-way / Return */}
                  <div className="space-y-2 bg-white/[0.01] p-3.5 rounded-2xl border border-white/5">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-white/80">Ride Type Restriction</span>
                        <span className="text-[9px] text-white/30 font-display">Apply to Return, One-way, or Any booking format</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingPriceAddon({ ...editingPriceAddon, limitRideType: !editingPriceAddon.limitRideType })}
                        className={cn(
                          "w-10 h-5 rounded-full transition-all relative shrink-0",
                          editingPriceAddon?.limitRideType ? "bg-gold" : "bg-white/10"
                        )}
                      >
                        <div className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all", editingPriceAddon?.limitRideType ? "right-1" : "left-1")} />
                      </button>
                    </div>

                    {editingPriceAddon?.limitRideType && (
                      <div className="pt-3 border-t border-white/5">
                        <label className="text-[9px] uppercase tracking-widest font-gold font-bold text-white/40 mb-1 block">Applicable Format</label>
                        <select
                          value={editingPriceAddon?.rideTypeTarget || "oneway"}
                          onChange={(e) => setEditingPriceAddon({ ...editingPriceAddon, rideTypeTarget: e.target.value })}
                          className="custom-select w-full py-2 text-xs"
                        >
                          <option value="oneway">One-Way Rides Only</option>
                          <option value="return">Return Rides Only</option>
                          <option value="any">Either Format (Any)</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* 8. Booking Extras / Add-ons Restriction */}
                  <div className="space-y-4 bg-white/[0.01] p-3.5 rounded-2xl border border-white/5">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-white/80">Extras / Add-ons Restriction</span>
                        <span className="text-[9px] text-white/30 font-display">Apply only when specific child seats, luggage, or premium upgrades are selected</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingPriceAddon({ ...editingPriceAddon, limitExtras: !editingPriceAddon.limitExtras })}
                        className={cn(
                          "w-10 h-5 rounded-full transition-all relative shrink-0",
                          editingPriceAddon?.limitExtras ? "bg-gold" : "bg-white/10"
                        )}
                      >
                        <div className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all", editingPriceAddon?.limitExtras ? "right-1" : "left-1")} />
                      </button>
                    </div>

                    {editingPriceAddon?.limitExtras && (
                      <div className="pt-3 border-t border-white/5 space-y-2">
                        <p className="text-[9px] uppercase tracking-widest font-bold text-white/40 mb-2">Select Restricting Extras (Customer must select at least one of these)</p>
                        {extras.length === 0 ? (
                          <p className="text-[10px] text-white/30 italic">No extras configured in Extras Management.</p>
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            {extras.map((extra: any) => {
                              const current = editingPriceAddon?.selectedExtras || [];
                              const isChecked = current.includes(extra.id) || current.includes(extra.name);
                              return (
                                <label key={extra.id} className="flex items-center gap-2 p-1.5 bg-white/5 rounded-lg border border-white/5 cursor-pointer hover:border-gold/30 transition-all">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      const next = e.target.checked
                                        ? [...current, extra.id]
                                        : current.filter((id: string) => id !== extra.id && id !== extra.name);
                                      setEditingPriceAddon({ ...editingPriceAddon, selectedExtras: next });
                                    }}
                                    className="w-3 h-3 rounded bg-white/5 text-gold border-white/10 focus:ring-gold"
                                  />
                                  <span className="text-[9px] uppercase tracking-widest font-bold text-white/70">{extra.name}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 flex gap-4 min-h-[50px] border-t border-white/[0.05]">
                  <button
                    onClick={() => setShowPriceAddonModal(false)}
                    className="flex-1 py-3 text-xs font-bold uppercase border border-white/20 rounded-xl text-white/70 hover:text-white hover:border-white/40 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (editingPriceAddon.id && editingPriceAddon.id !== 'new') {
                        handleUpdatePriceAddon(editingPriceAddon.id, editingPriceAddon);
                      } else {
                        handleUpdatePriceAddon('new', editingPriceAddon);
                      }
                    }}
                    disabled={isSavingPriceAddon}
                    className="border border-white/5 flex-1 bg-gold text-black py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-white transition-all disabled:opacity-50"
                  >
                    {isSavingPriceAddon ? <Loader2 size={16} className="animate-spin m-auto" /> : (editingPriceAddon?.id ? "Save Changes" : "Create Add-on")}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showSmsTemplateModal && (
          <div key="sms-template-modal" className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSmsTemplateModal(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="relative w-full max-w-4xl bg-[#0A0A0A] rounded-[1.25rem] sm:rounded-[1.75rem] lg:rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl"
            >
              <div className="p-3.5 sm:p-6 lg:p-10 max-h-[95vh] overflow-y-auto custom-scrollbar">

                {/* Header */}
                <div className="flex justify-between items-start mb-3.5 sm:mb-6 lg:mb-10 gap-2">
                  <div>
                    <h3 className="text-sm sm:text-xl lg:text-2xl font-display text-gold uppercase tracking-[0.13em] sm:tracking-[0.18em] lg:tracking-[0.2em]">
                      {editingSmsTemplate?.id && editingSmsTemplate.id !== 'new' ? 'Edit SMS Template' : 'New SMS Template'}
                    </h3>
                    <p className="text-white/40 text-[6px] sm:text-[8px] lg:text-[10px] uppercase tracking-[0.2em] font-bold mt-1 sm:mt-2">
                      Configure message content
                    </p>
                  </div>
                  <button
                    onClick={() => setShowSmsTemplateModal(false)}
                    className="p-1.5 sm:p-2.5 lg:p-3 hover:bg-white/5 rounded-full transition-all group flex-shrink-0"
                  >
                    <X size={24} className="text-white/20 group-hover:text-white transition-colors" />
                  </button>
                </div>

                <div className="space-y-3 sm:space-y-5 lg:space-y-8">

                  {/* Config Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4 lg:gap-6 p-3 sm:p-4 lg:p-6 bg-white/5 border border-white/10 rounded-[0.875rem] sm:rounded-[1.25rem] lg:rounded-2xl">
                    <div>
                      <label className="text-[6px] sm:text-[8px] lg:text-[10px] uppercase tracking-[0.18em] lg:tracking-widest font-bold text-white/30 mb-1.5 sm:mb-2 lg:mb-3 block ml-0.5 sm:ml-1">
                        Template Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Booking Confirmation"
                        value={editingSmsTemplate?.name || ''}
                        onChange={(e) => setEditingSmsTemplate({ ...editingSmsTemplate, name: e.target.value })}
                        className="w-full bg-black/40 border border-white/10 rounded-[0.5rem] sm:rounded-[0.875rem] lg:rounded-2xl px-2.5 sm:px-3.5 lg:px-5 py-2 sm:py-2.5 lg:py-4 text-[10px] sm:text-xs lg:text-sm outline-none focus:border-gold transition-all"
                      />
                    </div>

                    <div>
                      <label className="text-[6px] sm:text-[8px] lg:text-[10px] uppercase tracking-[0.18em] lg:tracking-widest font-bold text-white/30 mb-1.5 sm:mb-2 lg:mb-3 block ml-0.5 sm:ml-1">
                        Trigger Event
                      </label>
                      <div className="relative">
                        <select
                          value={editingSmsTemplate?.event || ''}
                          onChange={(e) => setEditingSmsTemplate({ ...editingSmsTemplate, event: e.target.value })}
                          className="w-full bg-black/40 border border-white/10 rounded-[0.5rem] sm:rounded-[0.875rem] lg:rounded-2xl px-2.5 sm:px-3.5 lg:px-5 py-2 sm:py-2.5 lg:py-4 text-[10px] sm:text-xs lg:text-sm outline-none focus:border-gold transition-all appearance-none custom-select"
                        >
                          <option value="booking_created">Booking Created</option>
                          <option value="status_confirmed">Booking Confirmed</option>
                          <option value="status_assigned">Driver Assigned</option>
                          <option value="status_accepted">Driver Accepted</option>
                          <option value="status_arrived">Driver Arrived</option>
                          <option value="status_started">Ride Started</option>
                          <option value="status_completed">Ride Completed</option>
                          <option value="status_cancelled">Ride Cancelled</option>
                          <option value="pickup_early_alert">Pickup Early Alert</option>
                          <option value="booking_feedback">Feedback Submitted</option>
                          <option value="pending_ride_alert_14d">Pending Ride Alert (14 Days)</option>
                          <option value="pending_ride_alert_7d">Pending Ride Alert (7 Days)</option>
                        </select>
                        <ChevronDown
                          className="absolute right-2.5 sm:right-4 lg:right-5 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none"
                          size={12}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Message Content */}
                  <div>
                    <div className="flex justify-between items-center mb-2 sm:mb-2.5 lg:mb-3 px-0.5 sm:px-1">
                      <label className="text-[6px] sm:text-[8px] lg:text-[10px] uppercase tracking-[0.18em] lg:tracking-widest font-bold text-white/30">
                        Message Content
                      </label>
                      <span className="text-[6px] sm:text-[7px] lg:text-[8px] text-gold/40 uppercase font-black tracking-widest">
                        ~160 chars recommended
                      </span>
                    </div>
                    <div className="relative">
                      <textarea
                        rows={4}
                        placeholder="Hello {customerName}, your booking {bookingId} is confirmed!"
                        value={editingSmsTemplate?.content || ''}
                        onChange={(e) => setEditingSmsTemplate({ ...editingSmsTemplate, content: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-[0.875rem] sm:rounded-[1.125rem] lg:rounded-[1.5rem] px-3 sm:px-4 lg:px-5 py-2.5 sm:py-3 lg:py-4 text-[10px] sm:text-xs lg:text-sm outline-none focus:border-gold transition-all resize-none font-medium leading-relaxed"
                      />
                      <div className="mt-2 sm:mt-3 lg:mt-4 flex flex-wrap gap-1.5 sm:gap-2">
                        {['{customerName}', '{bookingId}', '{driverName}', '{pickupAddress}', '{date}', '{time}', '{status}'].map(tag => (
                          <button
                            key={tag}
                            onClick={() => setEditingSmsTemplate({ ...editingSmsTemplate, content: (editingSmsTemplate.content || '') + tag })}
                            className="text-[6.5px] sm:text-[8px] lg:text-[9px] bg-white/5 hover:bg-gold/10 text-white/40 hover:text-gold px-2 sm:px-2.5 lg:px-3 py-1 sm:py-1.5 rounded-full transition-all border border-white/5 font-mono tracking-tighter"
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Recipients & Toggle */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5 lg:gap-8 pt-2 sm:pt-3 lg:pt-4">

                    <div>
                      <label className="text-[6px] sm:text-[8px] lg:text-[10px] uppercase tracking-[0.18em] lg:tracking-widest font-bold text-white/30 mb-2.5 sm:mb-3 lg:mb-4 block ml-0.5 sm:ml-1">
                        Recipient Roles
                      </label>
                      <div className="flex flex-col gap-1.5 sm:gap-2">
                        {['customer', 'admin', 'driver'].map(role => (
                          <button
                            key={role}
                            onClick={() => {
                              const recipients = editingSmsTemplate?.recipients || [];
                              if (recipients.includes(role)) {
                                setEditingSmsTemplate({ ...editingSmsTemplate, recipients: recipients.filter((r: string) => r !== role) });
                              } else {
                                setEditingSmsTemplate({ ...editingSmsTemplate, recipients: [...recipients, role] });
                              }
                            }}
                            className={cn(
                              "flex items-center justify-between px-3 sm:px-4 lg:px-4 py-2.5 sm:py-3 lg:py-4 rounded-[0.625rem] sm:rounded-[0.875rem] lg:rounded-2xl border transition-all text-[7.5px] sm:text-[9px] lg:text-xs font-bold uppercase tracking-[0.12em] sm:tracking-[0.15em] lg:tracking-widest",
                              editingSmsTemplate?.recipients?.includes(role)
                                ? "bg-gold text-black border-gold shadow-[0_0_16px_rgba(212,175,55,0.1)]"
                                : "bg-white/5 border-white/10 text-white/30 hover:border-white/30"
                            )}
                          >
                            <span className="capitalize">{role}</span>
                            <div className={cn(
                              "w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 rounded-[0.25rem] sm:rounded-[0.3rem] lg:rounded-lg border flex items-center justify-center transition-all",
                              editingSmsTemplate?.recipients?.includes(role)
                                ? "bg-black/20 border-black/20"
                                : "bg-black/20 border-white/10"
                            )}>
                              {editingSmsTemplate?.recipients?.includes(role) && (
                                <Check size={12} className="text-black" />
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col justify-end">
                      <div className="p-3 sm:p-4 lg:p-6 bg-white/5 rounded-[0.875rem] sm:rounded-[1.125rem] lg:rounded-[1.5rem] border border-white/10 flex items-center justify-between gap-3 group">
                        <div>
                          <p className="text-[9px] sm:text-[11px] lg:text-sm font-bold font-display uppercase tracking-[0.13em] sm:tracking-[0.15em] lg:tracking-widest text-gold group-hover:text-white transition-colors">
                            Enabled
                          </p>
                          <p className="text-[6px] sm:text-[7px] lg:text-[9px] text-white/20 uppercase tracking-[0.18em] lg:tracking-widest font-bold mt-0.5 sm:mt-1">
                            Activate template
                          </p>
                        </div>
                        <button
                          onClick={() => setEditingSmsTemplate({ ...editingSmsTemplate, active: !editingSmsTemplate?.active })}
                          className={cn(
                            "w-10 h-[22px] sm:w-11 sm:h-[24px] lg:w-12 lg:h-6 rounded-full relative transition-all duration-300 flex-shrink-0",
                            editingSmsTemplate?.active
                              ? "bg-gold shadow-[0_0_12px_rgba(212,175,55,0.3)] lg:shadow-[0_0_15px_rgba(212,175,55,0.3)]"
                              : "bg-white/10"
                          )}
                        >
                          <div className={cn(
                            "absolute top-[3px] w-4 h-4 rounded-full bg-white transition-all duration-300 shadow-sm",
                            editingSmsTemplate?.active ? "right-[3px]" : "left-[3px]"
                          )} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-3 sm:pt-5 lg:pt-10 flex gap-2 sm:gap-3 lg:gap-4">
                    <button
                      onClick={() => setShowSmsTemplateModal(false)}
                      className="flex-1 py-3 sm:py-4 lg:py-5 bg-white/5 hover:bg-white/10 rounded-[0.625rem] sm:rounded-[0.875rem] lg:rounded-2xl text-[6.5px] sm:text-[8px] lg:text-[10px] font-black uppercase tracking-[0.18em] sm:tracking-[0.22em] lg:tracking-[0.2em] transition-all text-white/40 hover:text-white border border-white/10"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleUpdateSmsTemplate(editingSmsTemplate)}
                      disabled={isSavingSmsTemplate || !editingSmsTemplate?.name || !editingSmsTemplate?.content}
                      className="flex-1 py-3 sm:py-4 lg:py-5 bg-gold hover:bg-white text-black rounded-[0.625rem] sm:rounded-[0.875rem] lg:rounded-2xl text-[6.5px] sm:text-[8px] lg:text-[10px] font-black uppercase tracking-[0.18em] sm:tracking-[0.22em] lg:tracking-[0.2em] transition-all disabled:opacity-50 flex items-center justify-center gap-2 sm:gap-2.5 lg:gap-3 shadow-[0_6px_20px_rgba(212,175,55,0.2)] lg:shadow-[0_10px_30px_rgba(212,175,55,0.2)]"
                    >
                      {isSavingSmsTemplate ? (
                        <Loader2 className="animate-spin text-black" size={18} />
                      ) : (
                        <Save size={18} />
                      )}
                      {editingSmsTemplate?.id && editingSmsTemplate.id !== 'new' ? 'Update' : 'Create'} Template
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showEmailTemplateModal && (
          <div key="email-template-modal" className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEmailTemplateModal(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="relative w-full max-w-6xl bg-[#0A0A0A] rounded-[1rem] sm:rounded-[1.5rem] lg:rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl"
            >
              <div className="p-3.5 sm:p-6 lg:p-12 max-h-[95vh] overflow-y-auto custom-scrollbar">

                {/* Header */}
                <div className="flex justify-between items-start mb-3.5 sm:mb-6 lg:mb-12 gap-2">
                  <div>
                    <h3 className="text-sm sm:text-lg lg:text-2xl font-display text-gold">
                      {editingEmailTemplate?.id && editingEmailTemplate.id !== 'new' ? 'Edit Email Template' : 'New Email Template'}
                    </h3>
                    <p className="text-white/40 text-[6px] sm:text-[8px] uppercase tracking-[0.22em] sm:tracking-[0.3em] font-bold mt-1 sm:mt-2">
                      Design your notification experience
                    </p>
                  </div>
                  <button
                    onClick={() => setShowEmailTemplateModal(false)}
                    className="p-1.5 sm:p-2.5 lg:p-3 hover:bg-white/5 rounded-full transition-all group flex-shrink-0"
                  >
                    <X size={14} className="sm:hidden text-white/20 group-hover:text-white transition-colors" />
                    <X size={18} className="hidden sm:block lg:hidden text-white/20 group-hover:text-white transition-colors" />
                    <X size={24} className="hidden lg:block text-white/20 group-hover:text-white transition-colors" />
                  </button>
                </div>

                <div className="space-y-3.5 sm:space-y-5 lg:space-y-12">

                  {/* Config Header */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3 lg:gap-8 p-3 sm:p-4 lg:p-8 bg-white/5 border border-white/10 rounded-[0.875rem] sm:rounded-[1.25rem] lg:rounded-3xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-0.5 sm:w-1 h-full bg-gold/50" />

                    <div>
                      <label className="text-[6px] sm:text-[8px] lg:text-[10px] uppercase tracking-[0.18em] lg:tracking-widest font-bold text-white/30 mb-1.5 sm:mb-2 lg:mb-3 block ml-0.5 sm:ml-1">
                        Template Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Booking Confirmation"
                        value={editingEmailTemplate?.name || ''}
                        onChange={(e) => setEditingEmailTemplate({ ...editingEmailTemplate, name: e.target.value })}
                        className="w-full bg-black/40 border border-white/10 rounded-[0.5rem] sm:rounded-[0.75rem] lg:rounded-2xl px-2.5 sm:px-3.5 lg:px-5 py-2 sm:py-2.5 lg:py-4 text-[10px] sm:text-xs lg:text-sm outline-none focus:border-gold transition-all"
                      />
                    </div>

                    <div>
                      <label className="text-[6px] sm:text-[8px] lg:text-[10px] uppercase tracking-[0.18em] lg:tracking-widest font-bold text-white/30 mb-1.5 sm:mb-2 lg:mb-3 block ml-0.5 sm:ml-1">
                        Trigger Event
                      </label>
                      <div className="relative">
                        <select
                          value={editingEmailTemplate?.event || ''}
                          onChange={(e) => setEditingEmailTemplate({ ...editingEmailTemplate, event: e.target.value })}
                          className="w-full bg-black/40 border border-white/10 rounded-[0.5rem] sm:rounded-[0.75rem] lg:rounded-2xl px-2.5 sm:px-3.5 lg:px-5 py-2 sm:py-2.5 lg:py-4 text-[10px] sm:text-xs lg:text-sm outline-none focus:border-gold transition-all appearance-none custom-select"
                        >
                          <option value="booking_created">Booking Created</option>
                          <option value="status_confirmed">Booking Confirmed</option>
                          <option value="status_assigned">Driver Assigned</option>
                          <option value="status_accepted">Driver Accepted</option>
                          <option value="status_arrived">Driver Arrived</option>
                          <option value="status_started">Ride Started</option>
                          <option value="status_completed">Ride Completed</option>
                          <option value="status_cancelled">Ride Cancelled</option>
                          <option value="pickup_early_alert">Pickup Early Alert</option>
                          <option value="booking_feedback">Feedback Submitted</option>
                          <option value="pending_ride_alert_14d">Pending Ride Alert (14 Days)</option>
                          <option value="pending_ride_alert_7d">Pending Ride Alert (7 Days)</option>
                        </select>
                        <ChevronDown className="absolute right-2.5 sm:right-4 lg:right-5 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none" size={12} />
                      </div>
                    </div>

                    <div className="sm:col-span-2 lg:col-span-1">
                      <label className="text-[6px] sm:text-[8px] lg:text-[10px] uppercase tracking-[0.18em] lg:tracking-widest font-bold text-white/30 mb-1.5 sm:mb-2 lg:mb-3 block ml-0.5 sm:ml-1">
                        Email Subject Line
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Your Booking {bookingId}"
                        value={editingEmailTemplate?.subject || ''}
                        onChange={(e) => setEditingEmailTemplate({ ...editingEmailTemplate, subject: e.target.value })}
                        className="w-full bg-black/40 border border-white/10 rounded-[0.5rem] sm:rounded-[0.75rem] lg:rounded-2xl px-2.5 sm:px-3.5 lg:px-5 py-2 sm:py-2.5 lg:py-4 text-[10px] sm:text-xs lg:text-sm outline-none focus:border-gold transition-all"
                      />
                    </div>
                  </div>

                  {/* Editor & Preview Row */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-5 lg:gap-8">

                    {/* Left: Editor */}
                    <div className="space-y-2.5 sm:space-y-4 lg:space-y-6 flex flex-col">
                      <div className="flex items-center gap-1.5 sm:gap-2 px-0.5 sm:px-1">
                        <Code2 size={11} className="text-gold sm:hidden" />
                        <Code2 size={14} className="text-gold hidden sm:block" />
                        <label className="text-[6px] sm:text-[8px] lg:text-[10px] uppercase tracking-[0.18em] lg:tracking-widest font-bold text-white/30">
                          HTML Content Source
                        </label>
                      </div>
                      <div className="flex-1 relative flex flex-col">
                        <textarea
                          placeholder="Hello {customerName}, your booking {bookingId} is confirmed!"
                          value={editingEmailTemplate?.content || ''}
                          onChange={(e) => setEditingEmailTemplate({ ...editingEmailTemplate, content: e.target.value })}
                          className="flex-1 min-h-[140px] sm:min-h-[240px] lg:min-h-[400px] w-full bg-white/5 border border-white/10 rounded-[0.875rem] sm:rounded-[1.125rem] lg:rounded-3xl px-3 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-6 text-[9px] sm:text-[11px] lg:text-sm outline-none focus:border-gold transition-all resize-none font-mono leading-relaxed"
                        />
                        <div className="mt-2 sm:mt-3 lg:mt-4 flex flex-wrap gap-1.5 sm:gap-2">
                          {['{customerName}', '{bookingId}', '{driverName}', '{driverPhone}', '{pickupAddress}', '{dropoffAddress}', '{date}', '{time}', '{status}', '{serviceType}', '{distance}', '{price}', '{passengers}', '{flightNumber}', '{luggage}'].map(tag => (
                            <button
                              key={tag}
                              onClick={() => setEditingEmailTemplate({ ...editingEmailTemplate, content: (editingEmailTemplate.content || '') + tag })}
                              className="text-[6.5px] sm:text-[7.5px] lg:text-[8px] bg-white/5 hover:bg-gold/10 text-white/40 hover:text-gold px-1.5 sm:px-2 lg:px-2.5 py-1 sm:py-1.5 rounded-[0.3rem] sm:rounded-lg transition-all border border-white/5 font-mono tracking-tighter"
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Right: Live Preview */}
                    <div className="space-y-2.5 sm:space-y-4 lg:space-y-6 flex flex-col">
                      <div className="flex items-center gap-1.5 sm:gap-2 px-0.5 sm:px-1">
                        <Eye size={11} className="text-gold sm:hidden" />
                        <Eye size={14} className="text-gold hidden sm:block" />
                        <label className="text-[6px] sm:text-[8px] lg:text-[10px] uppercase tracking-[0.18em] lg:tracking-widest font-bold text-white/30">
                          Live Preview Visualizer
                        </label>
                      </div>
                      <div className="flex-1 bg-white rounded-[0.875rem] sm:rounded-[1.125rem] lg:rounded-3xl overflow-hidden border border-white/10 shadow-inner relative group">
                        <iframe
                          key={editingEmailTemplate?.content?.length || 0}
                          srcDoc={editingEmailTemplate?.content || '<div style="font-family: sans-serif; text-align: center; color: #999; padding: 40px 20px; font-size: 12px;">Real-time preview will appear here as you code...</div>'}
                          title="Live Email Preview"
                          className="w-full h-full min-h-[160px] sm:min-h-[260px] lg:min-h-[450px] border-none"
                          sandbox="allow-same-origin allow-scripts"
                        />
                        <div className="absolute top-2 sm:top-3 lg:top-4 right-2 sm:right-3 lg:right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-[6px] sm:text-[7px] lg:text-[8px] bg-black/60 backdrop-blur px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-white/60 uppercase font-black">
                            Interactive Preview
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recipients & Toggle Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5 lg:gap-8 pt-3 sm:pt-4 lg:pt-6 border-t border-white/5">

                    <div>
                      <label className="text-[6px] sm:text-[8px] lg:text-[10px] uppercase tracking-[0.18em] lg:tracking-widest font-bold text-white/30 mb-2.5 sm:mb-3.5 lg:mb-5 block ml-0.5 sm:ml-1">
                        Dispatch Recipients
                      </label>
                      <div className="flex flex-wrap gap-1.5 sm:gap-2 lg:gap-3">
                        {['customer', 'admin', 'driver'].map(role => (
                          <button
                            key={role}
                            onClick={() => {
                              const recipients = editingEmailTemplate?.recipients || [];
                              if (recipients.includes(role)) {
                                setEditingEmailTemplate({ ...editingEmailTemplate, recipients: recipients.filter((r: string) => r !== role) });
                              } else {
                                setEditingEmailTemplate({ ...editingEmailTemplate, recipients: [...recipients, role] });
                              }
                            }}
                            className={cn(
                              "flex items-center gap-2 sm:gap-3 lg:gap-4 px-2.5 sm:px-3.5 lg:px-6 py-2 sm:py-2.5 lg:py-4 rounded-[0.625rem] sm:rounded-[0.875rem] lg:rounded-2xl border transition-all text-[7px] sm:text-[8px] lg:text-[10px] font-black uppercase tracking-[0.1em] sm:tracking-[0.12em] lg:tracking-widest min-w-[80px] sm:min-w-[100px] lg:min-w-[140px]",
                              editingEmailTemplate?.recipients?.includes(role)
                                ? "bg-gold text-black border-gold shadow-[0_4px_14px_rgba(212,175,55,0.2)] lg:shadow-[0_8px_20px_rgba(212,175,55,0.2)]"
                                : "bg-white/5 border-white/10 text-white/30 hover:border-white/30"
                            )}
                          >
                            <span className="flex-1 text-left capitalize">{role}</span>
                            <div className={cn(
                              "w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 rounded-[0.25rem] sm:rounded-[0.3rem] lg:rounded-lg flex items-center justify-center transition-all",
                              editingEmailTemplate?.recipients?.includes(role) ? "bg-black/20" : "bg-white/10"
                            )}>
                              {editingEmailTemplate?.recipients?.includes(role) && (
                                <Check size={8} className="sm:hidden text-black" />
                              )}
                              {editingEmailTemplate?.recipients?.includes(role) && (
                                <Check size={10} className="hidden sm:block lg:hidden text-black" />
                              )}
                              {editingEmailTemplate?.recipients?.includes(role) && (
                                <Check size={12} className="hidden lg:block text-black" />
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col justify-end">
                      <div className="p-3 sm:p-4 lg:p-8 bg-white/5 rounded-[0.875rem] sm:rounded-[1.125rem] lg:rounded-3xl border border-white/10 flex items-center justify-between gap-3 group/status">
                        <div>
                          <p className="text-[9px] sm:text-[11px] lg:text-sm font-bold font-display uppercase tracking-[0.13em] sm:tracking-[0.15em] lg:tracking-widest text-gold group-hover/status:text-white transition-colors">
                            Activation Status
                          </p>
                          <p className="text-[6px] sm:text-[7px] lg:text-[9px] text-white/20 uppercase tracking-[0.18em] lg:tracking-widest font-bold mt-0.5 sm:mt-1">
                            Template is currently {editingEmailTemplate?.active ? 'Live' : 'Draft'}
                          </p>
                        </div>
                        <button
                          onClick={() => setEditingEmailTemplate({ ...editingEmailTemplate, active: !editingEmailTemplate?.active })}
                          className={cn(
                            "w-10 h-[22px] sm:w-12 sm:h-6 lg:w-14 lg:h-7 rounded-full relative transition-all duration-500 flex-shrink-0",
                            editingEmailTemplate?.active
                              ? "bg-gold shadow-[0_0_16px_rgba(212,175,55,0.35)] lg:shadow-[0_0_25px_rgba(212,175,55,0.4)]"
                              : "bg-white/10"
                          )}
                        >
                          <div className={cn(
                            "absolute top-[3px] w-4 h-4 sm:w-[18px] sm:h-[18px] rounded-full bg-white transition-all duration-500 shadow-md",
                            editingEmailTemplate?.active
                              ? "right-[3px]"
                              : "left-[3px]"
                          )} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-3 sm:pt-5 lg:pt-8 flex gap-2 sm:gap-3 lg:gap-6">
                    <button
                      onClick={() => setShowEmailTemplateModal(false)}
                      className="flex-1 py-3 sm:py-4 lg:py-6 bg-white/5 hover:bg-white/10 rounded-[0.625rem] sm:rounded-[0.875rem] lg:rounded-2xl text-[6.5px] sm:text-[8px] lg:text-[10px] font-black uppercase tracking-[0.18em] sm:tracking-[0.22em] lg:tracking-[0.3em] transition-all text-white/30 hover:text-white border border-white/10"
                    >
                      Dismiss Changes
                    </button>
                    <button
                      onClick={() => handleUpdateEmailTemplate(editingEmailTemplate)}
                      disabled={isSavingEmailTemplate || !editingEmailTemplate?.name || !editingEmailTemplate?.content}
                      className="flex-1 py-3 sm:py-4 lg:py-6 bg-gold hover:bg-white text-black rounded-[0.625rem] sm:rounded-[0.875rem] lg:rounded-2xl text-[6.5px] sm:text-[8px] lg:text-[10px] font-black uppercase tracking-[0.18em] sm:tracking-[0.22em] lg:tracking-[0.3em] transition-all disabled:opacity-50 flex items-center justify-center gap-2 sm:gap-3 lg:gap-4 shadow-[0_8px_20px_rgba(212,175,55,0.2)] lg:shadow-[0_15px_40px_rgba(212,175,55,0.25)]"
                    >
                      {isSavingEmailTemplate
                        ? <Loader2 className="animate-spin text-black" size={14} />
                        : <Save size={14} className="sm:hidden" />
                      }
                      {isSavingEmailTemplate
                        ? <Loader2 className="animate-spin text-black hidden sm:block lg:hidden" size={16} />
                        : <Save size={16} className="hidden sm:block lg:hidden" />
                      }
                      {isSavingEmailTemplate
                        ? <Loader2 className="animate-spin text-black hidden lg:block" size={20} />
                        : <Save size={20} className="hidden lg:block" />
                      }
                      {editingEmailTemplate?.id && editingEmailTemplate.id !== 'new' ? 'Sync Update' : 'Publish Template'}
                    </button>
                  </div>

                </div>
              </div>
            </motion.div>
          </div>
        )}

                  {showImportConfirm && (
            <motion.div
              key="import-confirm-modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[10000] flex items-center justify-center p-6"
            >
              <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowImportConfirm(false)} />
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="glass relative max-w-md w-full p-8 border border-white/10 rounded-[2rem] space-y-8"
              >
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 animate-pulse">
                    <AlertCircle size={32} />
                  </div>
                  <div>
                    <h3 className="text-xl font-display text-white">Confirm Overwrite</h3>
                    <p className="text-[10px] uppercase tracking-widest font-black text-red-500 mt-1">Irreversible System Action</p>
                  </div>
                  <p className="text-xs text-white/40 leading-relaxed">
                    You are about to import a backup file. This will <span className="text-red-500 font-bold underline">overwrite</span> existing documents in your database. Ensure you have exported a current backup first.
                  </p>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => setShowImportConfirm(false)}
                    className="flex-1 px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white hover:bg-white/10 transition-all"
                  >
                    Abort
                  </button>
                  <button
                    onClick={processImport}
                    className="flex-1 px-6 py-4 bg-gold text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-gold/20"
                  >
                    Confirm Import
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

      </AnimatePresence>
    </div>
  );
};

export default SettingsTab;
