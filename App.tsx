import { db } from "./utils/firebase";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
  query,
  where,
} from "firebase/firestore";
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus,
  MapPin,
  Trash2,
  CheckCircle2,
  Activity,
  Moon,
  Sun,
  Navigation,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Reminder, UserLocation, GeoStatus } from "./types";
import { calculateDistance, formatDistance } from "./utils/geoUtils";
import { AddReminderModal } from "./components/AddReminderModal";
import { TriggeredReminderModal } from "./components/TriggeredReminderModal";
import { MapView } from "./components/MapView";
import { AIChatAssistant } from "./components/AIChatAssistant";
import { speakReminder } from "./services/ttsService";
import { categorizeReminder, generateTriggeredMessage } from "./services/geminiService";
import { LandingPage } from "./components/LandingPage";
import { LoginPage } from "./components/LoginPage";

const App: React.FC = () => {
  /* ================= UI STATE ================= */

  const [currentScreen, setCurrentScreen] = useState<"landing" | "login" | "dashboard">("landing");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [dark, setDark] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTriggeredReminder, setActiveTriggeredReminder] =
    useState<Reminder | null>(null);
  const [aiTriggeredMessage, setAiTriggeredMessage] = useState<string | null>(null);
  const [navigatingId, setNavigatingId] = useState<string | null>(null);

  /* ================= APP STATE ================= */

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [userLoc, setUserLoc] = useState<UserLocation | null>(null);
  const [filter, setFilter] = useState<"active" | "triggered" | "completed">(
    "active",
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [trackingStatus, setTrackingStatus] = useState<GeoStatus>({
    active: false,
    error: null,
    lastUpdate: null,
  });

  const watchIdRef = useRef<number | null>(null);
  const remindersRef = useRef<Reminder[]>([]);
  const triggeredIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    remindersRef.current = reminders;
  }, [reminders]);

  /* ================= AUTH PERSISTENCE ================= */
  useEffect(() => {
    const token = localStorage.getItem("authToken");
    const email = localStorage.getItem("userEmail");
    
    if (token && email) {
      setUserEmail(email);
      setCurrentScreen("dashboard");
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
    setIsInitializing(false);
  }, [currentScreen]);

  /* ================= LOAD REMINDERS ================= */

  useEffect(() => {
    if (currentScreen !== "dashboard" || !userEmail) return;

    // Isolate data by the mock user's email
    const q = query(collection(db, "reminders"), where("userEmail", "==", userEmail));

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const loaded = snapshot.docs.map((d) => {
          const data = d.data() as Reminder;
          const { id: _discarded, ...rest } = data;
          const existing = remindersRef.current.find(r => r.id === d.id);
          
          return { 
            id: d.id, 
            status: 'active',
            ...rest,
            lastDistance: existing?.lastDistance || rest.lastDistance
          };
        });

        console.log("Reminders updated from Firestore:", loaded.length);
        setReminders(loaded);
      },
      (err) => {
        console.error("onSnapshot error:", err);
        setTrackingStatus(prev => ({ ...prev, error: `Firestore Error: ${err.message}` }));
      },
    );

    return () => unsub();
  }, [currentScreen]);

  /* ================= TRACKING & ROUTING POLLING ================= */

  const lastRouteFetch = useRef<number>(0);

  useEffect(() => {
    if (!trackingStatus.active || !userLoc) return;

    const activeReminders = remindersRef.current.filter(r => r.status === 'active' && r.id === navigatingId);
    if (activeReminders.length === 0) return;

    const needsInitialFetch = activeReminders.some(r => r.routeDistance === undefined);
    const now = Date.now();

    if (needsInitialFetch || now - lastRouteFetch.current > 180000) { // 3 mins polling interval
      lastRouteFetch.current = now;

      const fetchRoutes = async () => {
        const tomtomKey = import.meta.env.VITE_TOMTOM_API_KEY;
        
        let hasChanges = false;
        const updatedReminders = await Promise.all(activeReminders.map(async (r) => {
          let targetLat = r.lat;
          let targetLng = r.lng;
          let changed = false;

          // 1. Dynamic Nearest Shop
          if (r.searchCategory) {
            try {
              const geoRes = await fetch(
                `https://api.tomtom.com/search/2/search/${encodeURIComponent(r.searchCategory)}.json?key=${tomtomKey}&limit=1&countrySet=IN&lat=${userLoc.lat}&lon=${userLoc.lng}&radius=50000`
              );
              const geoData = await geoRes.json();
              if (geoData.results && geoData.results[0]) {
                const nearest = geoData.results[0].position;
                if (nearest.lat !== targetLat || nearest.lon !== targetLng) {
                  targetLat = nearest.lat;
                  targetLng = nearest.lon;
                  changed = true;
                }
              }
            } catch (e) {
              console.error("Dynamic search failed", e);
            }
          }

          // 2. Fetch Route
          let routeDist = r.routeDistance;
          let routeETA = r.routeETA;
          let routePoints = r.routePoints;
          
          try {
            const routeRes = await fetch(
              `https://api.tomtom.com/routing/1/calculateRoute/${userLoc.lat},${userLoc.lng}:${targetLat},${targetLng}/json?key=${tomtomKey}&travelMode=${r.travelMode || 'walking'}`
            );
            const routeData = await routeRes.json();
            if (routeData.routes && routeData.routes[0]) {
              const summary = routeData.routes[0].summary;
              routeDist = summary.lengthInMeters;
              const mins = Math.ceil(summary.travelTimeInSeconds / 60);
              routeETA = `${mins} min${mins > 1 ? 's' : ''}`;
              
              if (routeData.routes[0].legs && routeData.routes[0].legs[0].points) {
                routePoints = routeData.routes[0].legs[0].points.map((p: any) => [p.latitude, p.longitude]);
              }
              changed = true;
            } else {
              console.warn("TomTom found no route. Is it too far for walking?");
              routeDist = -1; // Prevents infinite retry loop
              routeETA = "No Route Possible";
              changed = true;
            }
          } catch(e) {
             console.error("Route fetch failed", e);
             routeDist = -1;
             routeETA = "API Error";
             changed = true;
          }

          if (changed) {
            hasChanges = true;
            return { ...r, lat: targetLat, lng: targetLng, routeDistance: routeDist, routeETA, routePoints };
          }
          return r;
        }));

        if (hasChanges) {
           setReminders(prev => prev.map(p => {
              // If it's the updated one, merge it. 
              // If it's NOT the navigating target anymore, clear its old route data to avoid stale lines.
              const updated = updatedReminders.find(u => u.id === p.id);
              if (updated) {
                return { ...p, ...updated };
              } else if (p.routePoints && p.id !== navigatingId) {
                return { ...p, routePoints: undefined, routeDistance: undefined, routeETA: undefined };
              }
              return p;
           }));
        }
      };

      fetchRoutes();
    }
  }, [userLoc?.lat, userLoc?.lng, trackingStatus.active, navigatingId]);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) return;

    setTrackingStatus((prev) => ({ ...prev, active: true }));

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;

        setUserLoc({
          lat: latitude,
          lng: longitude,
          accuracy,
          timestamp: Date.now(),
        });

        const triggeredThisTick: Reminder[] = [];

        const nextReminders = remindersRef.current.map((r) => {
          if (r.status !== "active") return r;

          const dist = calculateDistance(latitude, longitude, r.lat, r.lng);

          if (dist <= r.radiusMeters) {
            const triggered = {
              ...r,
              status: "triggered" as const,
              triggeredAt: Date.now(),
              lastDistance: dist,
            };

            if (!triggeredIdsRef.current.has(r.id)) {
              triggeredIdsRef.current.add(r.id);
              triggeredThisTick.push(triggered);
            }

            return triggered;
          }

          // Note: lastDistance is local-only — never written to Firestore
          return { ...r, lastDistance: dist };
        });

        setReminders(nextReminders);
        
        // Fire external side effects outside of the React State Updater functional callback
        triggeredThisTick.forEach(triggered => {
          speakReminder(triggered.originalInput || triggered.title);

          // Browser Notification
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification(`🔔 Arrived at ${triggered.title}`, {
              body: (triggered.items && triggered.items.length > 0) ? triggered.items.join(', ') : "You have a reminder here!",
              icon: "/icon-192.png",
            });
          }

          // Persist to Firestore so onSnapshot doesn't reset status back to 'active'
          updateDoc(doc(db, "reminders", triggered.id), {
            status: "triggered",
            triggeredAt: triggered.triggeredAt,
          }).catch((err) => console.error("Failed to mark triggered:", err));

          // Generate AI contextual message for the popup
          setAiTriggeredMessage(null);
          generateTriggeredMessage(triggered.title, triggered.items ? triggered.items.join(', ') : "", triggered.createdAt)
            .then((msg) => setAiTriggeredMessage(msg))
            .catch(() => {});

          setActiveTriggeredReminder(triggered);
        });
      },
      (error) => {
        console.error("Geolocation error:", error);
        setTrackingStatus((prev) => ({
          ...prev,
          active: false,
          error: error.message,
        }));
      },
    );
  }, []);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setTrackingStatus((prev) => ({ ...prev, active: false }));
    lastRouteFetch.current = 0; // Reset so it fetches immediately when started again
  }, []);

  /* ================= ADD ================= */

  const handleAddReminder = async (
    data: Omit<Reminder, "id" | "createdAt" | "status">,
  ) => {
    if (!userEmail) return;
    try {
      const docRef = await addDoc(collection(db, "reminders"), {
        ...data,
        userEmail: userEmail, // Identify which user this belongs to
        createdAt: Date.now(),
        status: "active",
      });

      categorizeReminder(data.title, data.items ? data.items.join(', ') : "")
        .then(({ category, emoji, categoryColor }) =>
          updateDoc(doc(db, "reminders", docRef.id), { category, emoji, categoryColor })
        )
        .catch(() => {});
    } catch (err: any) {
      console.error("Failed to add reminder:", err);
      alert("Error: " + err.message);
    }
  };

  /* ================= DELETE ================= */
  const deleteReminder = async (id: string) => {
    try {
      console.log("Deleting reminder with id:", id);
      setDeletingId(id);
      await deleteDoc(doc(db, "reminders", id));
      console.log("Delete successful for:", id);
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Failed to delete reminder. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  /* ================= COMPLETE ================= */
  const completeReminder = async (id: string) => {
    try {
      console.log("Completing reminder with id:", id);
      await updateDoc(doc(db, "reminders", id), { status: "completed" });
      console.log("Complete successful");
    } catch (err) {
      console.error("Complete failed:", err);
      alert("Failed to complete reminder");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("userEmail");
    setUserEmail(null);
    setReminders([]);
    setCurrentScreen("landing");
  };

  const filteredReminders = reminders.filter((r) => r.status === filter);

  /* ================= UI RENDERING ================= */

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (currentScreen === "landing") {
    return <LandingPage onNavigateToLogin={() => setCurrentScreen("login")} />;
  }

  if (currentScreen === "login") {
    return (
      <LoginPage 
        onLoginSuccess={(email) => {
          setUserEmail(email);
          setCurrentScreen("dashboard");
        }} 
        onBack={() => setCurrentScreen("landing")} 
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`min-h-screen transition-all duration-500 ${
        dark
          ? "bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white"
          : "bg-gradient-to-br from-indigo-50 via-white to-purple-50"
      } font-[Inter] relative overflow-hidden`}
    >
      <div className="absolute -top-20 -left-20 w-[400px] h-[400px] bg-indigo-400/30 rounded-full blur-3xl pointer-events-none" />
      <div className="w-full min-h-screen flex justify-center">
        <div className="w-full max-w-xl px-6 py-10 relative z-10">
          {/* Header */}
          <div className="flex justify-between items-start mb-10">
            <div>
              <h1 className="text-5xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 bg-clip-text text-transparent">
                GeoReminder
              </h1>
              <div className="flex items-center gap-2 mt-2">
                <p className="text-slate-500 text-sm font-medium">
                  {userEmail || "Guest"}
                </p>
                <span className="w-1 h-1 rounded-full bg-slate-300" />
                <button 
                  onClick={handleLogout}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition"
                >
                  Sign Out
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setDark(!dark)}
                className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/70 backdrop-blur shadow-md hover:scale-110 transition"
              >
                {dark ? <Sun size={18} /> : <Moon size={18} />}
              </button>

              <motion.button
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.05 }}
                onClick={() => setIsModalOpen(true)}
                className="h-14 w-14 flex items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 text-white shadow-xl shadow-purple-400/30 transition-all duration-300"
              >
                <Plus size={24} />
              </motion.button>
            </div>
          </div>

          {/* Tracking Card */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="p-6 rounded-3xl backdrop-blur-xl bg-white/70 border border-white/40 shadow-xl mb-6"
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Activity
                  className={`${
                    trackingStatus.active
                      ? "text-green-500 animate-pulse"
                      : "text-gray-400"
                  }`}
                />
                <span className="font-semibold">
                  {trackingStatus.active ? "Tracking Active" : "Tracking Off"}
                </span>
              </div>

              <button
                onClick={trackingStatus.active ? stopTracking : startTracking}
                className={`px-4 py-2 text-sm font-semibold rounded-full ${
                  trackingStatus.active
                    ? "bg-red-500 text-white"
                    : "bg-green-500 text-white"
                }`}
              >
                {trackingStatus.active ? "Stop" : "Start"}
              </button>
              
              {/* DEV TEST BUTTON */}
              <button
                onClick={() => {
                  const activeReminders = remindersRef.current.filter(r => r.status === 'active');
                  if (activeReminders.length === 0) {
                    alert("No active reminders available to test!");
                    return;
                  }
                  
                  // Mock user coordinates to exactly match the first active reminder
                  const target = activeReminders[0];
                  if (navigator.geolocation && watchIdRef.current) {
                    const mockPos = {
                      coords: {
                        latitude: target.lat,
                        longitude: target.lng,
                        accuracy: 10
                      }
                    } as GeolocationPosition;
                    
                    // Manually inject the mocked position into our state simulation 
                    setUserLoc({
                      lat: target.lat,
                      lng: target.lng,
                      accuracy: 10,
                      timestamp: Date.now(),
                    });

                    const triggeredThisTick: Reminder[] = [];

                    const nextReminders = remindersRef.current.map((r) => {
                      if (r.status !== "active") return r;

                      const dist = calculateDistance(target.lat, target.lng, r.lat, r.lng);

                      if (dist <= r.radiusMeters) {
                        const triggered = {
                          ...r,
                          status: "triggered" as const,
                          triggeredAt: Date.now(),
                          lastDistance: dist,
                        };

                        if (!triggeredIdsRef.current.has(r.id)) {
                          triggeredIdsRef.current.add(r.id);
                          triggeredThisTick.push(triggered);
                        }

                        return triggered;
                      }

                      return { ...r, lastDistance: dist };
                    });

                    setReminders(nextReminders);
                    
                    triggeredThisTick.forEach(triggered => {
                      // Import is resolved since we use it directly below
                      speakReminder(triggered.originalInput || triggered.title);

                      updateDoc(doc(db, "reminders", triggered.id), {
                        status: "triggered",
                        triggeredAt: triggered.triggeredAt,
                      }).catch(() => {});

                      setAiTriggeredMessage(null);
                      generateTriggeredMessage(triggered.title, triggered.items ? triggered.items.join(', ') : "", triggered.createdAt)
                        .then((msg) => setAiTriggeredMessage(msg))
                        .catch(() => {});

                      setActiveTriggeredReminder(triggered);
                    });
                  } else {
                    alert("Please click 'Start' tracking first so the mock tracking can override it!");
                  }
                }}
                className="ml-2 px-4 py-2 text-sm font-semibold rounded-full bg-orange-500 text-white hover:bg-orange-600 transition"
              >
                Mock Arrival
              </button>
            </div>
          </motion.div>

          {/* View Toggle & Filter Tabs */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1 flex bg-white/60 backdrop-blur-xl border rounded-2xl p-1 shadow-md">
              {(["active", "triggered", "completed"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setFilter(type)}
                  className={`flex-1 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${
                    filter === type
                      ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            <button
              onClick={() => setViewMode(viewMode === "list" ? "map" : "list")}
              className="px-4 bg-white/60 backdrop-blur-xl border rounded-2xl shadow-md text-indigo-600 font-bold text-sm hover:bg-white transition"
            >
              {viewMode === "list" ? "Map View" : "List View"}
            </button>
          </div>

          {/* Body Content */}
          <div className="relative">
            <AnimatePresence mode="wait">
              {viewMode === "map" ? (
                <motion.div
                  key="map-view"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                >
                  <MapView 
                    reminders={filteredReminders} 
                    userLoc={userLoc} 
                    filter={filter} 
                    navigatingId={navigatingId}
                    onNavigate={(id) => setNavigatingId(navigatingId === id ? null : id)}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="list-view"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  <AnimatePresence mode="popLayout">
                    {filteredReminders.length === 0 ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center py-12 bg-white/40 rounded-3xl border border-dashed border-slate-300"
                      >
                        <p className="text-slate-400 font-medium whitespace-pre-line">
                          {filter === 'active' 
                            ? "Your world is quiet.\nTap + to map a new memory." 
                            : `No ${filter} reminders yet.`}
                        </p>
                      </motion.div>
                    ) : (
                      filteredReminders.map((reminder) => (
                        <motion.div
                          key={reminder.id}
                          layout
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          whileHover={{ y: -4 }}
                          className={`relative z-10 p-6 rounded-3xl border shadow-xl transition-all duration-300 ${
                            navigatingId === reminder.id && filter === 'active'
                              ? "bg-blue-50/90 backdrop-blur-xl border-blue-400 ring-2 ring-blue-500/30"
                              : "bg-white/80 backdrop-blur-xl border-slate-200"
                          }`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1 mr-3">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <h3 className="font-bold text-lg">{reminder.title}</h3>
                                {reminder.emoji && reminder.categoryColor && (
                                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${reminder.categoryColor}`}>
                                    {reminder.emoji} {reminder.category}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {filter === 'active' && (
                                <button
                                  onClick={() => setNavigatingId(navigatingId === reminder.id ? null : reminder.id)}
                                  className={`px-3 py-1 text-xs font-bold rounded-xl transition-colors ${
                                    navigatingId === reminder.id
                                      ? "bg-red-100 text-red-600 hover:bg-red-200"
                                      : "bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-200"
                                  }`}
                                >
                                  {navigatingId === reminder.id ? "Stop Route" : "Navigate"}
                                </button>
                              )}
                              <button
                                onClick={() => deleteReminder(reminder.id)}
                                disabled={deletingId === reminder.id}
                                className={`transition p-1.5 rounded-lg ${
                                  deletingId === reminder.id
                                    ? "opacity-25 cursor-not-allowed"
                                    : "opacity-50 hover:bg-red-50 hover:text-red-500 hover:opacity-100"
                                }`}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>

                          {reminder.items && reminder.items.length > 0 && (
                            <ul className="text-sm opacity-80 mb-3 list-disc pl-5 font-medium">
                              {reminder.items.map((item, i) => (
                                <li key={i}>{item}</li>
                              ))}
                            </ul>
                          )}

                          <div className="flex gap-3 text-xs font-medium">
                            <div className="flex items-center gap-1 bg-indigo-100 text-indigo-600 px-2 py-1 rounded-md">
                              <MapPin size={12} />
                              {reminder.radiusMeters}m
                            </div>

                            {reminder.routeDistance !== undefined && reminder.routeDistance !== -1 && reminder.routeETA && (
                              <div className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-1 rounded-md">
                                <Navigation size={12} />
                                {reminder.routeETA} ({formatDistance(reminder.routeDistance)})
                              </div>
                            )}

                            {reminder.routeDistance === -1 && (
                              <div className="flex items-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded-md">
                                <Navigation size={12} />
                                {reminder.routeETA}
                              </div>
                            )}

                            {reminder.lastDistance && !reminder.routeDistance && (
                              <div className="bg-gray-100 px-2 py-1 rounded-md">
                                {formatDistance(reminder.lastDistance)}
                              </div>
                            )}
                          </div>

                          {reminder.status === "triggered" && (
                            <button
                              onClick={() => completeReminder(reminder.id)}
                              className="mt-4 w-full py-2 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition flex items-center justify-center gap-2"
                            >
                              <CheckCircle2 size={16} />
                              Mark as Done
                            </button>
                          )}
                        </motion.div>
                      ))
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <AddReminderModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleAddReminder}
        userLat={userLoc?.lat || 0}
        userLng={userLoc?.lng || 0}
      />

      <TriggeredReminderModal
        reminder={activeTriggeredReminder}
        aiMessage={aiTriggeredMessage}
        onClose={() => { setActiveTriggeredReminder(null); setAiTriggeredMessage(null); }}
        onComplete={completeReminder}
        onDelete={deleteReminder}
      />

      <AIChatAssistant
        reminders={reminders}
        onCompleteReminder={completeReminder}
        onDeleteReminder={deleteReminder}
      />
    </motion.div>
  );
};

export default App;
