import { db } from "./utils/firebase";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Reminder, UserLocation, GeoStatus } from "./types";
import { calculateDistance, formatDistance } from "./utils/geoUtils";
import { AddReminderModal } from "./components/AddReminderModal";
import { TriggeredReminderModal } from "./components/TriggeredReminderModal";
import { AIChatAssistant } from "./components/AIChatAssistant";
import { speakReminder } from "./services/ttsService";
import { categorizeReminder, generateTriggeredMessage } from "./services/geminiService";
import { LandingPage } from "./components/LandingPage";
import { LoginPage } from "./components/LoginPage";

const App: React.FC = () => {
  /* ================= UI STATE ================= */

  const [currentScreen, setCurrentScreen] = useState<"landing" | "login" | "dashboard">("landing");
  const [dark, setDark] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTriggeredReminder, setActiveTriggeredReminder] =
    useState<Reminder | null>(null);
  const [aiTriggeredMessage, setAiTriggeredMessage] = useState<string | null>(null);

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

  /* ================= LOAD REMINDERS ================= */

  // Only subscribe to Firestore when the user is authenticated on the dashboard.
  // Subscribing before login causes "Missing or insufficient permissions" errors.
  useEffect(() => {
    if (currentScreen !== "dashboard") return;

    const coll = collection(db, "reminders");

    const unsub = onSnapshot(
      coll,
      (snapshot) => {
        const loaded = snapshot.docs.map((d) => {
          // Destructure out any embedded 'id' field from document data
          // so the real Firestore document ID (d.id) always wins.
          const { id: _discarded, ...rest } = d.data() as Reminder;
          return { id: d.id, ...rest };
        });

        console.log("Reminders updated from Firestore:", loaded);
        setReminders(loaded);
      },
      (err) => {
        console.error("onSnapshot error:", err);
      },
    );

    return () => unsub();
  }, [currentScreen]);

  /* ================= TRACKING ================= */

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

          // Persist to Firestore so onSnapshot doesn't reset status back to 'active'
          updateDoc(doc(db, "reminders", triggered.id), {
            status: "triggered",
            triggeredAt: triggered.triggeredAt,
          }).catch((err) => console.error("Failed to mark triggered:", err));

          // Generate AI contextual message for the popup
          setAiTriggeredMessage(null);
          generateTriggeredMessage(triggered.title, triggered.notes, triggered.createdAt)
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
  }, []);

  /* ================= ADD ================= */

  const handleAddReminder = async (
    data: Omit<Reminder, "id" | "createdAt" | "status">,
  ) => {
    const docRef = await addDoc(collection(db, "reminders"), {
      ...data,
      createdAt: Date.now(),
      status: "active",
    });

    // Fire-and-forget: auto-categorize with Gemini then patch the doc
    categorizeReminder(data.title, data.notes)
      .then(({ category, emoji, categoryColor }) =>
        updateDoc(doc(db, "reminders", docRef.id), { category, emoji, categoryColor })
      )
      .catch(() => {});
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

  const filteredReminders = reminders.filter((r) => r.status === filter);

  /* ================= UI (UNCHANGED) ================= */

  if (currentScreen === "landing") {
    return <LandingPage onNavigateToLogin={() => setCurrentScreen("login")} />;
  }

  if (currentScreen === "login") {
    return (
      <LoginPage 
        onLoginSuccess={() => setCurrentScreen("dashboard")} 
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
          <div className="flex justify-between items-center mb-10">
            <div>
              <h1 className="text-5xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 bg-clip-text text-transparent">
                GeoReminder
              </h1>
              <p className="text-slate-500 text-sm mt-2 font-medium">
                Smart location alerts that trigger exactly when you arrive.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setDark(!dark)}
                className="p-2 rounded-xl bg-white/70 backdrop-blur shadow-md hover:scale-110 transition"
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
                      generateTriggeredMessage(triggered.title, triggered.notes, triggered.createdAt)
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

          {/* Filter Tabs */}
          <div className="flex bg-white/60 backdrop-blur-xl border rounded-2xl p-1 shadow-md mb-6">
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

          {/* Reminder List */}
          <AnimatePresence>
            <div className="space-y-4">
              {filteredReminders.map((reminder) => (
                <motion.div
                  key={reminder.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  whileHover={{ y: -4 }}
                  className="relative z-10 bg-white/80 backdrop-blur-xl p-6 rounded-3xl border border-slate-200 shadow-xl transition-all duration-300"
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

                    <button
                      onClick={() => deleteReminder(reminder.id)}
                      disabled={deletingId === reminder.id}
                      className={`transition shrink-0 ${
                        deletingId === reminder.id
                          ? "opacity-25 cursor-not-allowed"
                          : "opacity-50 hover:text-red-500 hover:opacity-100"
                      }`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {reminder.notes && (
                    <p className="text-sm opacity-70 mb-3">{reminder.notes}</p>
                  )}

                  <div className="flex gap-3 text-xs font-medium">
                    <div className="flex items-center gap-1 bg-indigo-100 text-indigo-600 px-2 py-1 rounded-md">
                      <MapPin size={12} />
                      {reminder.radiusMeters}m
                    </div>

                    {reminder.lastDistance && (
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
              ))}
            </div>
          </AnimatePresence>
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
