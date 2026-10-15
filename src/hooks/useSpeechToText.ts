"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export interface UseSpeechToTextOptions {
	onTranscriptChange?: (transcript: string) => void;
	onFinalTranscript?: (transcript: string) => void;
	lang?: string;
}

export function useSpeechToText(options: UseSpeechToTextOptions = {}) {
	const { onTranscriptChange, onFinalTranscript, lang = "en-US" } = options;
	const [isListening, setIsListening] = useState(false);
	const [transcript, setTranscript] = useState("");
	const [isSupported, setIsSupported] = useState(false);
	// biome-ignore lint/suspicious/noExplicitAny: Browser SpeechRecognition instance
	const recognitionRef = useRef<any>(null);

	useEffect(() => {
		// biome-ignore lint/suspicious/noExplicitAny: SpeechRecognition is vendor-prefixed
		const win = typeof window !== "undefined" ? (window as any) : {};
		const SpeechRecognitionClass =
			win.SpeechRecognition || win.webkitSpeechRecognition;

		setIsSupported(Boolean(SpeechRecognitionClass));

		if (!SpeechRecognitionClass) return;

		const recognition = new SpeechRecognitionClass();
		recognition.continuous = true;
		recognition.interimResults = true;
		recognition.lang = lang;

		recognition.onstart = () => {
			setIsListening(true);
		};

		recognition.onend = () => {
			setIsListening(false);
		};

		// biome-ignore lint/suspicious/noExplicitAny: Speech error event
		recognition.onerror = (event: any) => {
			console.warn("Speech recognition error:", event.error);
			setIsListening(false);
			if (event.error === "not-allowed") {
				toast.error(
					"Microphone access denied. Please grant microphone permissions to use voice dictation.",
				);
			} else if (event.error === "network") {
				toast.error("Network error during speech recognition.");
			} else if (event.error !== "no-speech") {
				toast.error(`Voice error: ${event.error}`);
			}
		};

		// biome-ignore lint/suspicious/noExplicitAny: Speech result event
		recognition.onresult = (event: any) => {
			let currentInterim = "";
			let currentFinal = "";

			for (let i = 0; i < event.results.length; i++) {
				const result = event.results[i];
				if (result.isFinal) {
					currentFinal += result[0].transcript;
				} else {
					currentInterim += result[0].transcript;
				}
			}

			const fullText = `${currentFinal} ${currentInterim}`.trim();
			setTranscript(fullText);
			onTranscriptChange?.(fullText);

			if (currentFinal.trim()) {
				onFinalTranscript?.(currentFinal.trim());
			}
		};

		recognitionRef.current = recognition;

		return () => {
			try {
				recognition.abort();
			} catch (_err) {
				// Ignored
			}
		};
	}, [lang, onTranscriptChange, onFinalTranscript]);

	const startListening = useCallback(() => {
		if (!recognitionRef.current) {
			toast.error("Voice dictation is not supported in this browser.");
			return;
		}
		try {
			setTranscript("");
			recognitionRef.current.start();
		} catch (_err) {
			// Already running
		}
	}, []);

	const stopListening = useCallback(() => {
		if (!recognitionRef.current) return;
		try {
			recognitionRef.current.stop();
		} catch (_err) {
			// Ignored
		}
	}, []);

	const toggleListening = useCallback(() => {
		if (isListening) {
			stopListening();
		} else {
			startListening();
		}
	}, [isListening, startListening, stopListening]);

	const resetTranscript = useCallback(() => {
		setTranscript("");
	}, []);

	return {
		isListening,
		isSupported,
		transcript,
		startListening,
		stopListening,
		toggleListening,
		resetTranscript,
	};
}
