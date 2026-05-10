
import React, { useState, useEffect, useRef } from 'react';
import { X, MapPin, Send, Wand2, Loader2, Navigation, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPicker } from './MapPicker';
import { Reminder, TravelMode } from '../types';
import { getSmartReminderInfo } from '../services/geminiService';
import { calculateDistance, formatDistance } from '../utils/geoUtils';

interface AddReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (reminder: Omit<Reminder, 'id' | 'createdAt' | 'status'>) => void;
  userLat: number;
  userLng: number;
}

// Google Maps script loading removed to work without API key

export const AddReminderModal: React.FC<AddReminderModalProps> = ({ isOpen, onClose, onSave, userLat, userLng }) => {
  const [title, setTitle] = useState('');
  const [locationInput, setLocationInput] = useState('');
  const [items, setItems] = useState<string[]>([]);
  const [newItem, setNewItem] = useState('');
  const [searchCategory, setSearchCategory] = useState<string>('');
  const [isDynamicNearest, setIsDynamicNearest] = useState(false);
  const [isWaypointMode, setIsWaypointMode] = useState(false);
  const [travelMode, setTravelMode] = useState<TravelMode>('walking');
  const [radius, setRadius] = useState(200);
  const [lat, setLat] = useState(userLat);
  const [lng, setLng] = useState(userLng);
  const [smartLoading, setSmartLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{
    address: string;
    lat: number;
    lng: number;
    storeName?: string;
    phone?: string;
    website?: string;
    category?: string;
    brand?: string;
    distance?: string;
    area?: string;
    streetName?: string;
  }>>([]);
  const autocompleteRef = useRef<any>(null);

  useEffect(() => {
    if (isOpen) {
      setLat(userLat);
      setLng(userLng);
    }
  }, [isOpen, userLat, userLng]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() && items.length === 0 && !searchCategory.trim()) return;
    
    // Default title if empty
    const finalTitle = title.trim() || searchCategory.trim() || (items.length > 0 ? items[0] : 'Reminder');
    const finalItemsStr = items.join(', ');
    const finalNotes = locationInput ? `Location: ${locationInput}${finalItemsStr ? ` | Items: ${finalItemsStr}` : ""}` : finalItemsStr;
    const fullInput = finalNotes ? `${finalTitle}: ${finalNotes}` : finalTitle;
    
    const reminderData: any = { 
      title: finalTitle, 
      items, 
      originalInput: fullInput,
      radiusMeters: radius, 
      travelMode,
    };
    
    if (isWaypointMode && searchCategory) {
      reminderData.isWaypointRouting = true;
      reminderData.finalLat = lat;
      reminderData.finalLng = lng;
      reminderData.finalAddress = locationInput;
      reminderData.searchCategory = searchCategory;
      reminderData.lat = userLat; // temporary target until route is calculated
      reminderData.lng = userLng;
    } else {
      reminderData.lat = lat;
      reminderData.lng = lng;
      if (isDynamicNearest && searchCategory) {
        reminderData.searchCategory = searchCategory;
      }
    }
    
    onSave(reminderData);
    
    setTitle('');
    setLocationInput('');
    setItems([]);
    setNewItem('');
    setSearchCategory('');
    setIsDynamicNearest(false);
    setIsWaypointMode(false);
    onClose();
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (newItem.trim()) {
      setItems([...items, newItem.trim()]);
      setNewItem('');
    }
  };

  const handleSmartSuggest = async () => {
    const quickSearchVal = (document.getElementById('place-search') as HTMLInputElement)?.value;
    const searchTarget = quickSearchVal || `${title} ${locationInput} ${items.join(' ')}`.trim();
    
    if (!searchTarget) return;
    setSmartLoading(true);
    setSearchResults([]);
    
    const combinedPrompt = searchTarget + ", India";
    const tomtomKey = import.meta.env.VITE_TOMTOM_API_KEY;
    
    try {
      // TomTom Search API — fetch 5 results, biased by user's current location
      const latParam = userLat ? `&lat=${userLat}&lon=${userLng}` : '';
      const geoRes = await fetch(
        `https://api.tomtom.com/search/2/search/${encodeURIComponent(combinedPrompt)}.json?key=${tomtomKey}&limit=5&countrySet=IN${latParam}&radius=50000`
      );
      const geoData = await geoRes.json();
      
      if (geoData.results && geoData.results.length > 0) {
        const results = geoData.results.map((place: any) => {
          const poi = place.poi;
          const dist = place.dist; // TomTom returns distance in meters if lat/lon provided
          let distLabel = '';
          if (dist != null) {
            distLabel = dist < 1000 ? `${Math.round(dist)}m away` : `${(dist / 1000).toFixed(1)}km away`;
          }
          return {
            address: place.address?.freeformAddress || "Unknown address",
            lat: place.position.lat,
            lng: place.position.lon,
            storeName: poi?.name,
            phone: poi?.phone,
            website: poi?.url,
            category: poi?.categories?.[0],
            brand: poi?.brands?.[0]?.name,
            distance: distLabel,
            area: [place.address?.municipalitySubdivision, place.address?.municipality, place.address?.countrySubdivision].filter(Boolean).join(', '),
            streetName: place.address?.streetName,
          };
        });
        setSearchResults(results);
      } else {
        alert("No results found. Try a more specific name or add an area/city.");
      }
    } catch (err) {
      console.error("Search error:", err);
      alert("Search failed. Please check your internet connection.");
    } finally {
      setSmartLoading(false);
    }
  };

  const distanceToCurrent = calculateDistance(userLat, userLng, lat, lng);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
          <h2 className="text-xl font-bold text-slate-800">New Reminder</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6">
          <div className="space-y-4">
            {/* 1. ROUTING MODE SELECTION (MOVED TO TOP) */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <label className="block text-sm font-bold text-slate-800 border-b pb-2 mb-2">How do you want to find this?</label>
              <div className="space-y-3">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input 
                    type="radio" 
                    checked={!isWaypointMode && !isDynamicNearest}
                    onChange={() => { setIsWaypointMode(false); setIsDynamicNearest(false); }}
                    className="mt-1 w-4 h-4 text-blue-600"
                    name="routingMode"
                  />
                  <div>
                    <span className="block text-sm font-bold text-slate-700 group-hover:text-blue-600 transition">Go to an exact Map Pin</span>
                    <span className="block text-[10px] text-slate-500">You know exactly where you want to go.</span>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input 
                    type="radio" 
                    checked={!isWaypointMode && isDynamicNearest}
                    onChange={() => { setIsWaypointMode(false); setIsDynamicNearest(true); }}
                    className="mt-1 w-4 h-4 text-blue-600"
                    name="routingMode"
                  />
                  <div>
                    <span className="block text-sm font-bold text-slate-700 group-hover:text-blue-600 transition">Find Nearest Automatically</span>
                    <span className="block text-[10px] text-slate-500">Finds the closest shop around you as you move.</span>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input 
                    type="radio" 
                    checked={isWaypointMode}
                    onChange={() => { setIsWaypointMode(true); setIsDynamicNearest(false); }}
                    className="mt-1 w-4 h-4 text-blue-600"
                    name="routingMode"
                  />
                  <div>
                    <span className="block text-sm font-bold text-slate-700 group-hover:text-blue-600 transition">Find a Stop "On The Way"</span>
                    <span className="block text-[10px] text-slate-500">Finds a shop on the path to your Final Destination.</span>
                  </div>
                </label>
              </div>

              {(isDynamicNearest || isWaypointMode) && (
                <div className="mt-4 pt-3 border-t border-slate-200 bg-white p-3 rounded-lg border border-blue-100 shadow-sm">
                  <label className="block text-xs font-bold text-blue-800 mb-1">
                    What kind of place are you looking for?
                  </label>
                  <input
                    type="text"
                    required={(isDynamicNearest || isWaypointMode)}
                    value={searchCategory}
                    onChange={(e) => setSearchCategory(e.target.value)}
                    placeholder="e.g. Bookstore, Pharmacy, ATM"
                    className="w-full px-3 py-2 text-sm border-2 border-blue-100 rounded-lg focus:ring-0 focus:border-blue-500 outline-none"
                  />
                </div>
              )}
            </div>

            {/* 2. REMINDER DETAILS */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Reminder Title <span className="text-slate-400 font-normal text-xs">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={searchCategory ? `e.g. ${searchCategory} run` : "e.g. Buy Milk"}
                  className="w-full px-4 py-2 bg-slate-50 border rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Checklist Items</label>
                <div className="flex flex-col gap-2 mb-2">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-indigo-50 text-indigo-700 px-3 py-2 rounded-xl text-sm font-medium border border-indigo-100">
                      <span>{item}</span>
                      <button type="button" onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-indigo-400 hover:text-indigo-600">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddItem(e);
                      }
                    }}
                    placeholder="Add an item..."
                    className="flex-1 px-4 py-2 bg-slate-50 border rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <button type="button" onClick={handleAddItem} className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-xl font-bold hover:bg-indigo-200">
                    + Add
                  </button>
                </div>
              </div>
            </div>

            {/* 3. LOCATION SEARCH & MAP (HIDDEN IF DYNAMIC NEAREST) */}
            {!isDynamicNearest && (
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    {isWaypointMode ? "Search for Final Destination" : "Search for Exact Location"}
                  </label>
                  <div className="flex gap-2 mb-3">
                    <div className="relative flex-1 group">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        id="place-search"
                        type="text"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSmartSuggest();
                          }
                        }}
                        placeholder="Enter area, city, or place..."
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <button type="button" onClick={handleSmartSuggest} disabled={smartLoading} className="px-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 flex items-center justify-center min-w-[80px]">
                      {smartLoading ? <Loader2 size={18} className="animate-spin" /> : "Find"}
                    </button>
                  </div>

                  {/* Search Results */}
                  <AnimatePresence>
                    {searchResults.length > 0 && (
                      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mb-4 rounded-xl border border-blue-200 overflow-hidden shadow-sm">
                        <div className="bg-blue-600 px-3 py-2 flex justify-between items-center">
                          <p className="text-[10px] font-bold text-white uppercase tracking-widest">{searchResults.length} results found</p>
                          <button type="button" onClick={() => setSearchResults([])} className="text-white/70 hover:text-white text-xs font-bold">✕ Close</button>
                        </div>
                        <div className="max-h-[240px] overflow-y-auto divide-y divide-slate-100">
                          {searchResults.map((result, idx) => (
                            <button key={idx} type="button" onClick={() => {
                                setLat(result.lat);
                                setLng(result.lng);
                                setLocationInput(result.address.split(',')[0]);
                                setSearchResults([]);
                              }} 
                              className="w-full text-left p-3 hover:bg-blue-50 transition-colors group"
                            >
                              <h4 className="text-sm font-bold text-slate-800">{result.storeName || result.address.split(',')[0]}</h4>
                              <p className="text-[11px] text-slate-500 mt-1">📍 {result.address}</p>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-end">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {isWaypointMode ? "Pin Final Destination" : "Pin Target Location"}
                    </label>
                    <span className="text-[10px] font-bold bg-slate-100 px-2 py-0.5 rounded-full text-slate-600">{formatDistance(distanceToCurrent)} away</span>
                  </div>
                  <MapPicker 
                    key={`${lat},${lng}`}
                    initialLat={lat} 
                    initialLng={lng} 
                    radius={radius}
                    onLocationSelect={(newLat, newLng) => { setLat(newLat); setLng(newLng); }} 
                  />
                </div>
              </div>
            )}

            {/* 4. SETTINGS */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Travel Mode</label>
                <select value={travelMode} onChange={(e) => setTravelMode(e.target.value as TravelMode)} className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 font-medium">
                  <option value="walking">Walking</option>
                  <option value="driving">Driving</option>
                  <option value="cycling">Cycling</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Trigger Radius</label>
                <select value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 font-medium">
                  <option value={100}>100m</option>
                  <option value={200}>200m</option>
                  <option value={500}>500m</option>
                  <option value={1000}>1km</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-slate-300 rounded-xl text-slate-600 font-bold hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200"
            >
              <Send size={18} />
              Set Reminder
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
