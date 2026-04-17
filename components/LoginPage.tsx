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

      // Store user info locally
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

        <div className="mt-8 flex items-center gap-4 text-slate-400">
          <div className="flex-1 border-t border-slate-200"></div>
          <span className="text-sm font-medium">OR CONTINUE WITH</span>
          <div className="flex-1 border-t border-slate-200"></div>
        </div>

        <div className="mt-6">
          <button className="w-full py-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition font-medium text-slate-700 flex justify-center items-center gap-2">
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Google
          </button>
        </div>

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
