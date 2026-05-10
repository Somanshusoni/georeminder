
import React from 'react';
import { Bell, CheckCircle2, Trash2, X, MapPin, Sparkles } from 'lucide-react';
import { Reminder } from '../types';

interface TriggeredReminderModalProps {
  reminder: Reminder | null;
  aiMessage?: string | null;
  onClose: () => void;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
}

export const TriggeredReminderModal: React.FC<TriggeredReminderModalProps> = ({ reminder, aiMessage, onClose, onComplete, onDelete }) => {
  if (!reminder) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-orange-900/40 backdrop-blur-md animate-in fade-in zoom-in duration-300">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border-4 border-orange-400 overflow-hidden">
        <div className="p-6 bg-orange-500 text-white flex items-center gap-4">
          <div className="bg-white/20 p-3 rounded-2xl animate-pulse">
            <Bell size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight leading-tight">Location Reached!</h2>
            <p className="text-orange-100 text-sm font-bold">You are within {reminder.radiusMeters}m</p>
          </div>
          <button onClick={onClose} className="ml-auto p-2 hover:bg-white/10 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-8 space-y-6">
          <div className="space-y-2">
            <h3 className="text-3xl font-black text-slate-800 leading-tight">{reminder.title}</h3>
            <div className="flex items-center gap-2 text-slate-400 font-bold">
              <MapPin size={18} className="text-orange-500" />
              <span>{reminder.originalInput}</span>
            </div>
          </div>

          {aiMessage && (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex gap-3">
              <Sparkles size={18} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800 leading-relaxed font-medium">{aiMessage}</p>
            </div>
          )}

          {reminder.items && reminder.items.length > 0 && (
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-slate-600 font-medium">
              <ul className="list-disc pl-5 space-y-1">
                {reminder.items.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-3 pt-4">
            <button
              onClick={() => {
                onComplete(reminder.id);
                onClose();
              }}
              className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-black text-lg flex items-center justify-center gap-2 shadow-lg shadow-green-200 transition-all active:scale-95"
            >
              <CheckCircle2 size={24} />
              Mark as Done
            </button>
            <button
              onClick={() => {
                onDelete(reminder.id);
                onClose();
              }}
              className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Trash2 size={20} />
              Remove Reminder
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
