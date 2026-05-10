
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
    if (!title.trim() && items.length === 0) return;
    
    // Default title if empty
    const finalTitle = title.trim() || (items.length > 0 ? items[0] : 'Reminder');
    const finalItemsStr = items.join(', ');
    const finalNotes = locationInput ? `Location: ${locationInput}${finalItemsStr ? ` | Items: ${finalItemsStr}` : ""}` : finalItemsStr;
    const fullInput = finalNotes ? `${finalTitle}: ${finalNotes}` : finalTitle;
    
    onSave({ 
      title: finalTitle, 
      items, 
      originalInput: fullInput,
      radiusMeters: radius, 
      lat, 
      lng,
      travelMode,
      searchCategory: isDynamicNearest && searchCategory ? searchCategory : undefined
    });
    
    setTitle('');
    setLocationInput('');
    setItems([]);
    setNewItem('');
    setSearchCategory('');
    setIsDynamicNearest(false);
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
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Quick Search (India Only)</label>
              <div className="flex gap-2">
                <div className="relative flex-1 group">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                  <input
                    id="place-search"
                    type="text"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSmartSuggest();
                      }
                    }}
                    placeholder="Enter store, city, or area..."
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSmartSuggest}
                  disabled={smartLoading}
                  className="px-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center"
                >
                  {smartLoading ? <Loader2 size={18} className="animate-spin" /> : "Search"}
                </button>
              </div>

              <AnimatePresence>
                {searchResults.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mt-3 space-y-0 rounded-xl border border-blue-200 overflow-hidden shadow-sm"
                  >
                    <div className="bg-blue-600 px-3 py-2 flex justify-between items-center">
                      <p className="text-[10px] font-bold text-white uppercase tracking-widest">
                        {searchResults.length} result{searchResults.length > 1 ? 's' : ''} found — tap to select
                      </p>
                      <button
                        type="button"
                        onClick={() => setSearchResults([])}
                        className="text-white/70 hover:text-white text-xs font-bold"
                      >
                        ✕ Close
                      </button>
                    </div>
                    <div className="max-h-[240px] overflow-y-auto divide-y divide-slate-100">
                      {searchResults.map((result, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setLat(result.lat);
                            setLng(result.lng);
                            
                            // Auto-fill form fields
                            if (result.storeName) {
                              setTitle(result.storeName);
                            }
                            
                            if (result.area) {
                              setLocationInput(result.area);
                            } else if (result.address) {
                              // Fallback: use a portion of the address if specific area components are missing
                              const parts = result.address.split(', ');
                              if (parts.length > 1) {
                                setLocationInput(parts.slice(1, 3).join(', '));
                              }
                            }

                            if (result.category) {
                              setSearchCategory(result.category);
                            }
                            
                            // Optionally auto-add context as an item
                            if (result.category) {
                              setItems(prev => [...prev, result.category]);
                            }
                            
                            setSearchResults([]);
                          }}
                          className="w-full text-left p-3 hover:bg-blue-50 transition-colors group"
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex-1 min-w-0">
                              {/* Store Name */}
                              <h4 className="text-sm font-bold text-slate-800 group-hover:text-blue-700 transition truncate">
                                {result.storeName || result.address.split(',')[0]}
                              </h4>
                              
                              {/* Tags */}
                              <div className="flex flex-wrap gap-1 mt-1">
                                {result.brand && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">
                                    {result.brand}
                                  </span>
                                )}
                                {result.category && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full capitalize">
                                    {result.category}
                                  </span>
                                )}
                              </div>

                              {/* Address */}
                              <p className="text-[11px] text-slate-500 mt-1 truncate">
                                📍 {result.address}
                              </p>

                              {/* Phone & Website */}
                              <div className="flex flex-wrap gap-2 mt-1">
                                {result.phone && (
                                  <span className="text-[10px] text-slate-400">📞 {result.phone}</span>
                                )}
                                {result.website && (
                                  <span className="text-[10px] text-blue-400">🌐 {result.website}</span>
                                )}
                              </div>
                            </div>

                            {/* Distance badge */}
                            <div className="shrink-0 flex flex-col items-end gap-1">
                              {result.distance && (
                                <span className="text-[9px] font-bold px-2 py-0.5 bg-green-100 text-green-700 rounded-full whitespace-nowrap">
                                  {result.distance}
                                </span>
                              )}
                              <span className="text-[10px] text-blue-500 font-bold opacity-0 group-hover:opacity-100 transition">
                                Select →
                              </span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Reminder (Store / Item Name)</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setSearchResults([]);
                  }}
                  placeholder="e.g. Starbucks or Buy Milk"
                  className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none pr-10"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Area / City Location</label>
              <div className="relative">
                <input
                  type="text"
                  value={locationInput}
                  onChange={(e) => {
                    setLocationInput(e.target.value);
                    setSearchResults([]);
                  }}
                  placeholder="e.g. MG Road, Bangalore"
                  className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Checklist Items (Products / Services)</label>
              
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
                  placeholder="e.g. Fruits, Xerox, Photoshoot"
                  className="flex-1 px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-xl font-bold hover:bg-indigo-200 transition-colors"
                >
                  + Add
                </button>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={isDynamicNearest}
                  onChange={(e) => setIsDynamicNearest(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm font-semibold text-slate-700">Always reroute to nearest shop</span>
              </label>
              {isDynamicNearest && (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Store Category (e.g. Supermarket, Pharmacy)</label>
                  <input
                    type="text"
                    value={searchCategory}
                    onChange={(e) => setSearchCategory(e.target.value)}
                    placeholder="Enter category to search dynamically..."
                    className="w-full px-3 py-1.5 text-sm border rounded-lg focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">App will search for the nearest "{searchCategory || 'shop'}" every 3 mins while tracking.</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Travel Mode</label>
                <select
                  value={travelMode}
                  onChange={(e) => setTravelMode(e.target.value as TravelMode)}
                  className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value="walking">Walking</option>
                  <option value="driving">Driving</option>
                  <option value="cycling">Cycling</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Trigger Radius</label>
                <select
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                  className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value={100}>100m (Nearby)</option>
                  <option value={200}>200m (Walking)</option>
                  <option value={500}>500m (Standard)</option>
                  <option value={1000}>1km (Driving)</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => { setLat(userLat); setLng(userLng); }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors font-medium text-sm"
                >
                  <MapPin size={16} />
                  Current Location
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-end">
                  <label className="block text-sm font-medium text-slate-700">Set Reminder Location</label>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold border border-blue-100">
                    <Navigation size={10} />
                    {formatDistance(distanceToCurrent)} from you
                  </div>
                </div>
                <p className="text-[11px] text-amber-600 font-semibold bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100 flex items-center gap-1.5">
                  <MapPin size={12} />
                  Tip: If your store isn't on the map, simply tap on the map to manually place the pinpoint!
                </p>
              </div>
              <MapPicker 
                key={`${lat},${lng}`}
                initialLat={lat} 
                initialLng={lng} 
                radius={radius}
                onLocationSelect={(newLat, newLng) => { setLat(newLat); setLng(newLng); }} 
              />
              <p className="text-center text-[10px] text-slate-400 italic">
                Selected Destination: {lat.toFixed(4)}, {lng.toFixed(4)}
              </p>
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
