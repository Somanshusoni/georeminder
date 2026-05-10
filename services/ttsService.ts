export function speakReminder(text: string) {
  if (!text) return;

  try {
    if (!("speechSynthesis" in window)) {
      console.warn("Text-to-speech not supported in this browser.");
      return;
    }

    // Cancel any ongoing speech so they don't queue up excessively
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(`You are near to ${text}. Buy the product.`);
    
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(v => v.lang.startsWith('en-'));
    if (englishVoice) {
      utterance.voice = englishVoice;
    }
    
    window.speechSynthesis.speak(utterance);
  } catch (error) {
    console.warn("Voice reminder unavailable:", (error as Error).message);
  }
}
