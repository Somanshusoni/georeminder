import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, ArrowRight, UserPlus, LogIn } from "lucide-react";

interface LoginPageProps {
  onLoginSuccess: (email: string) => void;
  onBack: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  onBack,
}) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Simple email/password validation
      if (!email.trim() || !password.trim()) {
        alert("Please enter both email and password.");
        return;
      }

      if (password.length < 3) {
        alert("Password must be at least 3 characters.");
        return;
      }

      // Store user info locally (Mock Auth)
      localStorage.setItem("authToken", "user-token-" + Date.now());
      localStorage.setItem("userEmail", email);
      
      onLoginSuccess(email);
    } catch (error) {
      console.error("Login error:", error);
      alert("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-[Inter] overflow-hidden relative">
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-500/20 blur-[120px] rounded-full mix-blend-multiply pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-500/20 blur-[120px] rounded-full mix-blend-multiply pointer-events-none" />
      </div>

      <button
        onClick={onBack}
        className="absolute top-8 left-8 text-slate-500 hover:text-slate-900 transition flex gap-2 items-center z-20 group font-medium"
      >
        <ArrowRight
          className="rotate-180 transition-transform group-hover:-translate-x-1"
          size={18}
        />
        Back to Home
      </button>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden relative z-10 p-8 border border-white"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 20,
              delay: 0.1,
            }}
            className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-[1.2rem] mx-auto mb-6 flex items-center justify-center shadow-lg shadow-indigo-200"
          >
            {isLogin ? (
              <LogIn className="text-white" size={28} />
            ) : (
              <UserPlus className="text-white" size={28} />
            )}
          </motion.div>

          <h2 className="text-3xl font-extrabold text-slate-900 mb-2">
            {isLogin ? "Welcome Back" : "Create Account"}
          </h2>
          <p className="text-slate-500 font-medium">
            {isLogin
              ? "Sign in to access your geo-reminders"
              : "Start mapping your memories today"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative group">
            <Mail
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors"
              size={20}
            />
            <input
              type="email"
              required
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none transition-all placeholder:text-slate-400 font-medium text-slate-900"
            />
          </div>

          <div className="relative group">
            <Lock
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors"
              size={20}
            />
            <input
              type="password"
              required
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none transition-all placeholder:text-slate-400 font-medium text-slate-900"
            />
          </div>

          <AnimatePresence>
            {isLogin && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="text-right pb-2"
              >
                <a
                  href="#"
                  className="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  Forgot password?
                </a>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={isLoading || !email || !password}
            className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-2xl font-bold shadow-xl shadow-indigo-600/20 hover:shadow-indigo-600/40 transition-all hover:-translate-y-1 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-indigo-600/20 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full block"
              />
            ) : (
              "Continue to Dashboard"
            )}
          </button>
        </form>


        <p className="mt-8 text-center text-sm font-medium text-slate-600">
          {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-indigo-600 hover:text-indigo-700 font-bold"
          >
            {isLogin ? "Sign Up" : "Sign In"}
          </button>
        </p>

        <p className="mt-4 text-center text-xs font-medium text-slate-400">
          Use any email & password to get started
        </p>
      </motion.div>
    </div>
  );
};
