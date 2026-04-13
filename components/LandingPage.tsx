import React from "react";
import { motion } from "framer-motion";
import { MapPin, BellRing, Map, ArrowRight } from "lucide-react";

interface LandingPageProps {
  onNavigateToLogin: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigateToLogin }) => {
  return (
    <div className="min-h-screen bg-slate-950 text-white font-[Inter] overflow-hidden relative">
      {/* Background gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-[500px] bg-indigo-600/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-purple-600/20 blur-[150px] rounded-full pointer-events-none" />

      {/* Navbar */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <MapPin className="text-white" size={24} />
          </div>
          <span className="text-xl font-bold tracking-tight">GeoReminder</span>
        </div>
        <button
          onClick={onNavigateToLogin}
          className="px-6 py-2.5 bg-white/10 hover:bg-white/20 border border-white/10 backdrop-blur-md rounded-full font-medium transition-all"
        >
          Sign In
        </button>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 flex flex-col items-center justify-center text-center px-4 pt-32 pb-20 max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 mb-8"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
          </span>
          <span className="text-sm font-medium">Smart Geofencing Technology</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
          className="text-6xl md:text-8xl font-extrabold tracking-tight leading-[1.1] mb-8"
        >
          Never forget <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
            where to be.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="text-lg md:text-xl text-slate-400 max-w-2xl mb-12"
        >
          Set dynamic radius reminders for your daily tasks. Need to buy milk? We'll notify you the exact moment you're near the store.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
          className="flex flex-col sm:flex-row gap-4"
        >
          <button
            onClick={onNavigateToLogin}
            className="flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-full font-semibold text-lg shadow-xl shadow-indigo-600/20 transition-all hover:scale-105 active:scale-95"
          >
            Get Started <ArrowRight size={20} />
          </button>
        </motion.div>
      </main>

      {/* Feature Grid */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 py-20 border-t border-white/5 bg-slate-950/50 backdrop-blur-3xl">
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: <Map className="text-indigo-400" size={32} />,
              title: "Pinpoint Accuracy",
              desc: "Save specific locations on the map and attach notes or items you need to remember."
            },
            {
              icon: <BellRing className="text-pink-400" size={32} />,
              title: "Radius Triggers",
              desc: "Configure custom geofence radii. Be alerted at 100m or 5km from your destination."
            },
            {
              icon: <MapPin className="text-purple-400" size={32} />,
              title: "Background Alerts",
              desc: "App tracks your location securely and triggers notifications exactly when you arrive."
            }
          ].map((feature, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 * idx }}
              className="p-8 rounded-3xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.05] transition-colors"
            >
              <div className="w-14 h-14 rounded-2xl bg-white/[0.05] flex items-center justify-center mb-6">
                {feature.icon}
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">{feature.title}</h3>
              <p className="text-slate-400 leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};
