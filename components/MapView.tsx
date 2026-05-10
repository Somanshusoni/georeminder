
import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { Reminder, UserLocation } from '../types';
import { formatDistance } from '../utils/geoUtils';

const TOMTOM_KEY = import.meta.env.VITE_TOMTOM_API_KEY;

// Fix for default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom User Marker (Blue Pulse)
const userIcon = L.divIcon({
  className: 'user-location-marker',
  html: `<div class="relative">
    <div class="absolute -inset-2 bg-blue-500 rounded-full animate-ping opacity-25"></div>
    <div class="relative w-4 h-4 bg-blue-600 border-2 border-white rounded-full shadow-lg"></div>
  </div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

interface MapViewProps {
  reminders: Reminder[];
  userLoc: UserLocation | null;
  filter: string;
  navigatingId?: string | null;
  onNavigate?: (id: string) => void;
}

const MapController = ({ userLoc }: { userLoc: UserLocation | null }) => {
  const map = useMap();
  const hasCentered = React.useRef(false);
  
  React.useEffect(() => {
    if (userLoc && !hasCentered.current) {
      map.flyTo([userLoc.lat, userLoc.lng], 14, { duration: 1.5 });
      hasCentered.current = true;
    }
  }, [userLoc, map]);
  return null;
};

export const MapView: React.FC<MapViewProps> = ({ reminders, userLoc, filter, navigatingId, onNavigate }) => {
  const center: [number, number] = userLoc ? [userLoc.lat, userLoc.lng] : [0, 0];

  return (
    <div className="h-[500px] w-full rounded-3xl overflow-hidden shadow-2xl border border-white/20 relative group">
      <MapContainer 
        center={center} 
        zoom={13} 
        className="h-full w-full"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.tomtom.com">TomTom</a>'
          url={`https://api.tomtom.com/map/1/tile/basic/main/{z}/{x}/{y}.png?key=${TOMTOM_KEY}&tileSize=256`}
        />
        
        {userLoc && (
          <Marker position={[userLoc.lat, userLoc.lng]} icon={userIcon}>
            <Popup className="rounded-xl overflow-hidden">
              <div className="p-2 font-bold text-indigo-600">You are here</div>
            </Popup>
          </Marker>
        )}

        {reminders.map((r) => (
          <React.Fragment key={r.id}>
            <Marker position={[r.lat, r.lng]}>
              <Popup className="rounded-2xl">
                <div className="p-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{r.emoji || '📌'}</span>
                    <h4 className="font-bold text-slate-800">{r.title}</h4>
                  </div>
                  {r.items && r.items.length > 0 && (
                    <ul className="text-xs text-slate-500 mb-2 list-disc pl-4 font-medium">
                      {r.items.map((item, i) => <li key={i}>{item}</li>)}
                    </ul>
                  )}
                  
                  {filter === 'active' && onNavigate && (
                    <button
                      onClick={() => onNavigate(r.id)}
                      className={`w-full mb-2 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        navigatingId === r.id 
                          ? "bg-red-100 text-red-600 hover:bg-red-200" 
                          : "bg-blue-600 text-white hover:bg-blue-700"
                      }`}
                    >
                      {navigatingId === r.id ? "Stop Routing" : "Navigate Here"}
                    </button>
                  )}

                  <div className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-wider text-indigo-500">
                    <div className="flex justify-between items-center">
                      <span>{r.radiusMeters}m radius</span>
                      {r.lastDistance && !r.routeDistance && <span>{formatDistance(r.lastDistance)} away</span>}
                    </div>
                    {r.routeDistance && r.routeETA && (
                      <div className="flex justify-between items-center text-blue-600 bg-blue-50 px-2 py-1 rounded">
                        <span>{r.travelMode || 'Walking'} ETA:</span>
                        <span>{r.routeETA} ({formatDistance(r.routeDistance)})</span>
                      </div>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
            <Circle 
              center={[r.lat, r.lng]} 
              radius={r.radiusMeters} 
              pathOptions={{ 
                color: r.status === 'triggered' ? '#ef4444' : '#6366f1',
                fillColor: r.status === 'triggered' ? '#ef4444' : '#6366f1',
                fillOpacity: 0.1,
                dashArray: '5, 10'
              }} 
            />
            {r.routePoints && r.routePoints.length > 0 && navigatingId === r.id && (
              <Polyline 
                positions={r.routePoints} 
                pathOptions={{ 
                  color: r.status === 'triggered' ? '#ef4444' : '#3b82f6', 
                  weight: 5, 
                  opacity: 0.7,
                  dashArray: r.status === 'triggered' ? undefined : '10, 10',
                  lineCap: 'round',
                  lineJoin: 'round'
                }} 
              />
            )}
          </React.Fragment>
        ))}

        <MapController userLoc={userLoc} />
      </MapContainer>

      {/* Control Overlay */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
        <div className="bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full shadow-lg text-[10px] font-bold text-slate-500 border border-white/50">
          MODE: {filter.toUpperCase()}
        </div>
      </div>
    </div>
  );
};
