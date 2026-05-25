import { useState, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, DirectionsRenderer, Marker } from '@react-google-maps/api';
import { Loader2 } from 'lucide-react';
import { GOOGLE_MAPS_LIBRARIES, GOOGLE_MAPS_ID } from '../../lib/google-maps';

// Resilient fallback for Google Maps API Key
const GOOGLE_MAPS_API_KEY =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
  import.meta.env.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (process.env as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';

interface RouteMapProps {
  booking: any;
  onClose?: () => void;
}

// Check if address is a real-world address that can be searched
const isRealAddress = (address: any): boolean => {
  if (!address || typeof address !== 'string') return false;
  const lower = address.toLowerCase().trim();
  return (
    lower !== '' &&
    lower !== 'as directed' &&
    lower !== 'as_directed' &&
    lower !== 'no drop off' &&
    lower !== 'no dropoff' &&
    lower !== 'no drop-off' &&
    lower !== 'n/a' &&
    lower !== 'tbd' &&
    lower !== 'optional' &&
    lower !== 'hourly'
  );
};

export default function RouteMap({ booking, onClose }: RouteMapProps) {
  const { isLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_ID,
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [mapDirections, setMapDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [isMapLoading, setIsMapLoading] = useState(true);
  const [markers, setMarkers] = useState<{ position: google.maps.LatLngLiteral, label?: string, icon?: any }[]>([]);
  const [isDesktop, setIsDesktop] = useState(typeof window !== 'undefined' ? window.innerWidth >= 768 : true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isLoaded && booking) {
      const fetchDirections = async () => {
        setIsMapLoading(true);
        try {
          const directionsService = new google.maps.DirectionsService();
          const geocoder = new google.maps.Geocoder();

          // Filter and format waypoints carefully
          const waypoints = (booking.waypoints || [])
            .map((wp: any) => {
              const location = typeof wp === 'string' ? wp : wp.address;
              if (!location) return null;
              return { location, stopover: true };
            })
            .filter((wp: any) => wp !== null);

          const pickup = isRealAddress(booking.pickup) ? booking.pickup : '';
          const dropoff = isRealAddress(booking.dropoff) ? booking.dropoff : '';
          
          const validWaypoints = waypoints.filter((wp: any) => isRealAddress(wp.location));

          if (!pickup) {
            setIsMapLoading(false);
            return;
          }

          // Determine logical destination and route waypoints
          let destination = '';
          let routeWaypoints = [...validWaypoints];
          
          if (dropoff) {
            destination = dropoff;
          } else if (validWaypoints.length > 0) {
            // Use the last waypoint as destination
            destination = validWaypoints[validWaypoints.length - 1].location;
            routeWaypoints = validWaypoints.slice(0, -1);
          }

          // If we have a destination different from origin OR we have waypoints, attempt a route
          if (destination && destination !== pickup) {
            try {
              const result = await directionsService.route({
                origin: pickup,
                destination: typeof destination === 'string' ? destination : (destination as any).location || pickup,
                waypoints: routeWaypoints,
                travelMode: google.maps.TravelMode.DRIVING,
              });
              setMapDirections(result);
              setMarkers([]); // DirectionsRenderer handles markers
            } catch (routeErr: any) {
              console.warn('Directions request failed, falling back to geocoding:', routeErr);
              const newMarkers: any[] = [];
              
              const addMarker = async (address: string, label: string) => {
                try {
                  const res = await geocoder.geocode({ address });
                  if (res.results[0]) {
                    newMarkers.push({ position: res.results[0].geometry.location.toJSON(), label });
                  }
                } catch (e) {
                  console.error(`Geocode failed for ${address}`, e);
                }
              };

              await addMarker(pickup, 'P');
              for (let i = 0; i < validWaypoints.length; i++) {
                await addMarker(validWaypoints[i].location, (i + 1).toString());
              }
              if (dropoff && dropoff !== pickup) {
                await addMarker(dropoff, 'D');
              }

              setMarkers(newMarkers);
              setMapDirections(null);
            }
          } else {
            // Only Pickup - Geocode and show single marker
            try {
              const response = await geocoder.geocode({ address: pickup });
              if (response.results[0]) {
                const pos = response.results[0].geometry.location.toJSON();
                setMarkers([{ position: pos, label: 'P' }]);
                setMapDirections(null);
              }
            } catch (e) {
              console.error('Pickup geocode failed:', e);
            }
          }
        } catch (err) {
          console.error('Outer route logic failed:', err);
        } finally {
          setIsMapLoading(false);
        }
      };
      fetchDirections();
    }
  }, [isLoaded, booking]);

  // Synchronize Google Map Bounds when directions are updated, on device/size change or window resize to guarantee they fit and centralize perfectly
  useEffect(() => {
    if (!map) return;

    const triggerFit = () => {
      if (mapDirections) {
        const route = mapDirections.routes[0];
        if (route && route.bounds) {
          map.fitBounds(route.bounds);
        }
      } else if (markers.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        markers.forEach(m => bounds.extend(m.position));
        map.fitBounds(bounds);
        if (markers.length === 1) {
          map.setZoom(15);
        }
      }
    };

    // Run initially or when dependencies change
    triggerFit();

    // Trigger full resize event mapping event
    const handleMapResize = () => {
      google.maps.event.trigger(map, 'resize');
      setTimeout(() => {
        triggerFit();
      }, 100);
    };

    window.addEventListener('resize', handleMapResize);
    return () => {
      window.removeEventListener('resize', handleMapResize);
    };
  }, [map, mapDirections, markers]);

  if (!isLoaded) {
    return (
      <div className="h-full min-h-[450px] md:min-h-[600px] flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-gold animate-spin" />
          <p className="text-gold text-[10px] items-center uppercase tracking-widest font-black">Initialising Engine...</p>
        </div>
      </div>
    );
  }

  const defaultCenter = { lat: -37.8136, lng: 144.9631 }; // Melbourne

  return (
    <div className="relative w-full md:h-[500px] min-h-[450px] md:min-h-[500px]">
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={defaultCenter}
        zoom={12}
        onLoad={(mapInstance) => setMap(mapInstance)}
        options={{
          styles: [
            { "elementType": "geometry", "stylers": [{ "color": "#212121" }] },
            { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
            { "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
            { "elementType": "labels.text.stroke", "stylers": [{ "color": "#212121" }] },
            { "featureType": "administrative", "elementType": "geometry", "stylers": [{ "color": "#757575" }] },
            { "featureType": "administrative.country", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] },
            { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
            { "featureType": "road", "elementType": "geometry.fill", "stylers": [{ "color": "#2c2c2c" }] },
            { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#3c3c3c" }] },
            { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#000000" }] }
          ],
          disableDefaultUI: !isDesktop,
          zoomControl: true,
          mapTypeControl: isDesktop,
          fullscreenControl: isDesktop,
          streetViewControl: isDesktop,
        }}
      >
        {mapDirections && (
          <DirectionsRenderer
            directions={mapDirections}
            options={{
              polylineOptions: {
                strokeColor: '#D4AF37',
                strokeWeight: 4,
                strokeOpacity: 0.8
              },
              suppressMarkers: false,
              preserveViewport: false,
            }}
          />
        )}
        
        {markers.map((marker, idx) => (
          <Marker
            key={`marker-${idx}`}
            position={marker.position}
            label={{
              text: marker.label || '',
              color: '#000',
              fontWeight: 'bold',
              fontSize: '12px'
            }}
          />
        ))}
      </GoogleMap>

      {isMapLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
          <Loader2 className="w-6 h-6 text-gold animate-spin" />
        </div>
      )}
    </div>
  );
}
