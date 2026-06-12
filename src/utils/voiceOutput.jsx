// src/utils/voiceOutput.jsx

/**
 * Universal browser-native text-to-speech engine with built-in Latin sanitization filters.
 * @param {string} rawMessage - Raw conversational text output returned from the Groq JSON schema payload.
 * @param {Function} setSysSpeaking - State mutator to handle interface microphone pausing.
 */
export function speakResponse(rawMessage, setSysSpeaking) {
  if (!rawMessage || !window.speechSynthesis) return;

  // Immediately cancel any lingering or queued audio lines to maintain real-time cadence
  window.speechSynthesis.cancel();

  // Detect if the incoming string contains Arabic script elements
  const hasArabicCharacters = /[\u0600-\u06FF]/.test(rawMessage);
  let sanitizedMessage = rawMessage;

  if (hasArabicCharacters) {
    /**
     * THE ARABIC CLEANING REGEX FILTER:
     * 1. Eliminates all Latin characters (a-z, A-Z)
     * 2. Strips out standard structural markdown symbols: [ ] \ / ` * _
     * 3. Prevents low-tier LLMs from corrupting speech audio outputs during bilingual transitions
     */
    sanitizedMessage = rawMessage.replace(/[a-zA-Z\[\]\\\/`*_\ud83c\ud000-\udbff\udfff]/g, '').trim();
    
    console.log(`%c[TTS REGEX FILTER] Raw input: "${rawMessage}" -> Sanitized for Arabic engine: "${sanitizedMessage}"`, "color: #0d9488; font-weight: bold;");
  }

  // If the cleanup completely emptied out the text string, exit safely
  if (!sanitizedMessage) return;

  const utterance = new SpeechSynthesisUtterance(sanitizedMessage);

  // Dynamic voice assignment based on the target script layout
  if (hasArabicCharacters) {
    utterance.lang = 'ar-QA'; // Configured directly for local Doha vocalization profiles
  } else {
    utterance.lang = 'en-US';
  }

  // Bind interface state locks to pause your useQicVoiceLoop listener hooks cleanly
  utterance.onstart = () => {
    console.log("[TTS AUDIO] System Audio playback started.");
    setSysSpeaking(true);
  };

  utterance.onend = () => {
    console.log("[TTS AUDIO] System Audio playback finished.");
    setSysSpeaking(false);
  };

  utterance.onerror = (e) => {
    console.warn("[TTS AUDIO] Error encountered during synthesis execution:", e.error);
    setSysSpeaking(false);
  };

  window.speechSynthesis.speak(utterance);
}