import { GoogleGenAI, Type } from "@google/genai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey });

/* ─────────────────────────────────────────────────────────────
   1. SMART SUGGEST  (existing – polished title & notes)
───────────────────────────────────────────────────────────── */
export async function getSmartReminderInfo(prompt: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `Extract a clear title and concise notes for a reminder from this text: "${prompt}". 
      Keep notes helpful but short. Format as JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: "A punchy title for the reminder.",
            },
            notes: {
              type: Type.STRING,
              description: "Brief details about what to do.",
            },
            locationName: {
              type: Type.STRING,
              description: "The specific destination or store mentioned.",
            },
          },
          required: ["title", "notes", "locationName"],
        },
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    
    // Attempt to geocode via TomTom Search API
    if (parsed.locationName) {
      try {
        const tomtomKey = import.meta.env.VITE_TOMTOM_API_KEY;
        const geoRes = await fetch(`https://api.tomtom.com/search/2/search/${encodeURIComponent(parsed.locationName)}.json?key=${tomtomKey}&limit=1`);
        const geoData = await geoRes.json();
        if (geoData.results && geoData.results.length > 0) {
          const place = geoData.results[0];
          parsed.lat = place.position.lat;
          parsed.lng = place.position.lon;
          parsed.formattedAddress = place.address?.freeformAddress || place.poi?.name;
        }
      } catch (e) {
        console.warn("TomTom geocoding failed:", e);
      }
    }

    return parsed;
  } catch (error) {
    console.error("Gemini Error:", error);
    return null;
  }
}

/* ─────────────────────────────────────────────────────────────
   2. AUTO-CATEGORIZE  (new)
───────────────────────────────────────────────────────────── */
export const CATEGORY_CONFIG: Record<
  string,
  { emoji: string; color: string }
> = {
  Shopping: { emoji: "🛒", color: "bg-purple-100 text-purple-700" },
  Health:   { emoji: "💊", color: "bg-red-100 text-red-700" },
  Food:     { emoji: "🍽️", color: "bg-orange-100 text-orange-700" },
  Study:    { emoji: "📚", color: "bg-blue-100 text-blue-700" },
  Work:     { emoji: "💼", color: "bg-slate-200 text-slate-700" },
  Finance:  { emoji: "💰", color: "bg-green-100 text-green-700" },
  Travel:   { emoji: "✈️", color: "bg-sky-100 text-sky-700" },
  Fitness:  { emoji: "🏋️", color: "bg-yellow-100 text-yellow-800" },
  Other:    { emoji: "📌", color: "bg-gray-100 text-gray-600" },
};

export async function categorizeReminder(
  title: string,
  notes: string,
): Promise<{ category: string; emoji: string; categoryColor: string }> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `Categorize this reminder into exactly one category.
Title: "${title}"
Notes: "${notes || ""}"
Valid categories: Shopping, Health, Food, Study, Work, Finance, Travel, Fitness, Other`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: {
              type: Type.STRING,
              description:
                "Exactly one of: Shopping, Health, Food, Study, Work, Finance, Travel, Fitness, Other",
            },
          },
          required: ["category"],
        },
      },
    });

    const { category } = JSON.parse(response.text || '{"category":"Other"}');
    const cfg = CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG["Other"];
    return { category, emoji: cfg.emoji, categoryColor: cfg.color };
  } catch {
    return { category: "Other", emoji: "📌", categoryColor: "bg-gray-100 text-gray-600" };
  }
}

/* ─────────────────────────────────────────────────────────────
   3. SMART TRIGGERED MESSAGE  (new)
───────────────────────────────────────────────────────────── */
export async function generateTriggeredMessage(
  title: string,
  notes: string,
  createdAt: number,
): Promise<string> {
  try {
    const hour = new Date().getHours();
    const timeOfDay =
      hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
    const daysSince = Math.floor(
      (Date.now() - createdAt) / (1000 * 60 * 60 * 24),
    );

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `Generate a short, warm, action-oriented 1-2 sentence message for someone who just arrived at their reminder location.
Reminder: "${title}"
Notes: "${notes || "none"}"
Time of day: ${timeOfDay}
This reminder was set ${daysSince === 0 ? "today" : `${daysSince} day(s) ago`}.
Keep it under 35 words. Do not start with Hello or Hi. Be specific and motivating.`,
    });

    return response.text?.trim() || `You've arrived! Time to: ${title}`;
  } catch {
    return `You've arrived! Time to: ${title}`;
  }
}

/* ─────────────────────────────────────────────────────────────
   4. AI CHAT ASSISTANT  (new)
───────────────────────────────────────────────────────────── */
export async function chatWithAssistant(
  userMessage: string,
  history: { role: string; content: string }[],
  reminders: {
    id: string;
    title: string;
    notes: string;
    status: string;
    emoji?: string;
  }[],
): Promise<{
  reply: string;
  action?: { type: string; reminderTitle?: string } | null;
}> {
  const remindersContext =
    reminders.length > 0
      ? reminders
          .map(
            (r) =>
              `- [${r.status}] ${r.emoji ?? ""} "${r.title}"${r.notes ? `: ${r.notes}` : ""}`,
          )
          .join("\n")
      : "No reminders set yet.";

  const systemInstruction = `You are a friendly AI assistant for GeoReminder, a location-based reminder app.

The user's current reminders are:
${remindersContext}

You can:
- Answer questions about their reminders
- Mark a reminder as done (action type "complete")
- Delete a reminder (action type "delete")
- For adding new reminders tell the user to tap the + button (you cannot set a map location)

Be concise, warm, and helpful. If you perform an action, confirm it in your reply.`;

  const contents = [
    ...history.map((m) => ({
      role: (m.role === "user" ? "user" : "model") as "user" | "model",
      parts: [{ text: m.content }],
    })),
    { role: "user" as const, parts: [{ text: userMessage }] },
  ];

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: {
              type: Type.STRING,
              description: "Your response to the user",
            },
            action: {
              type: Type.OBJECT,
              nullable: true,
              properties: {
                type: {
                  type: Type.STRING,
                  description: "Action type: none, complete, or delete",
                },
                reminderTitle: {
                  type: Type.STRING,
                  description:
                    "Approximate title of the reminder to act on (if any)",
                },
              },
              required: ["type"],
            },
          },
          required: ["reply"],
        },
      },
    });

    return JSON.parse(
      response.text || '{"reply":"Sorry, I could not process that."}',
    );
  } catch {
    return { reply: "Sorry, I'm having trouble connecting right now. Please try again in a moment." };
  }
}
