import { useEffect, useRef, useState, useCallback } from 'react';

const SpeechLib = window.SpeechRecognition || window.webkitSpeechRecognition;
const globalRec = SpeechLib ? new SpeechLib() : null;

if (globalRec) {
  globalRec.continuous = true;     
  globalRec.interimResults = true;  
  globalRec.lang = 'en-US';
}

export function useQicVoiceLoop(onSpeechCaptured, isSystemSpeaking) {
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  
  const onSpeechCapturedRef = useRef(onSpeechCaptured);
  const silenceTimerRef = useRef(null);
  const autoMuteTimerRef = useRef(null);

  useEffect(() => {
    onSpeechCapturedRef.current = onSpeechCaptured;
  }, [onSpeechCaptured]);

  const toggleListening = useCallback(() => {
    setIsMicEnabled(prev => {
      const newState = !prev;
      if (!newState) {
        try { globalRec.stop(); } catch(e) {}
        setLiveTranscript('');
        if (autoMuteTimerRef.current) clearTimeout(autoMuteTimerRef.current);
      }
      return newState;
    });
  }, []);

  const resetAutoMuteTimer = useCallback(() => {
    if (autoMuteTimerRef.current) clearTimeout(autoMuteTimerRef.current);
    autoMuteTimerRef.current = setTimeout(() => {
      setIsMicEnabled(false);
      setLiveTranscript('');
    }, 60000); 
  }, []);

  useEffect(() => {
    if (!globalRec) return;

    if (!isMicEnabled || isSystemSpeaking) {
      try { globalRec.stop(); } catch (e) {}
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      return;
    }

    globalRec.onstart = () => {
      resetAutoMuteTimer();
    };

    globalRec.onresult = (e) => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      resetAutoMuteTimer(); 

      let finalSentence = '';
      let interimSentence = '';

      for (let i = e.resultIndex; i < e.results.length; ++i) {
        if (e.results[i].isFinal) {
          finalSentence += e.results[i][0].transcript;
        } else {
          interimSentence += e.results[i][0].transcript;
        }
      }

      const activeText = finalSentence || interimSentence;
      if (!activeText.trim()) return;

      setLiveTranscript(activeText);

      silenceTimerRef.current = setTimeout(() => {
        if (onSpeechCapturedRef.current) {
          onSpeechCapturedRef.current(activeText);
        }
        setLiveTranscript(''); 
        try { globalRec.stop(); } catch (err) {}
      }, 2500); 
    };

    globalRec.onend = () => {
      if (isMicEnabled && !isSystemSpeaking) {
        try { globalRec.start(); } catch (err) {}
      }
    };

    try { globalRec.start(); } catch (e) {}

    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      globalRec.onstart = null;
      globalRec.onresult = null;
      globalRec.onend = null;
    };
  }, [isMicEnabled, isSystemSpeaking, resetAutoMuteTimer]);

  return { isMicEnabled, toggleListening, liveTranscript };
}