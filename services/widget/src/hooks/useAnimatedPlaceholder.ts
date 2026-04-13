import { useState, useEffect } from "react";

const SAMPLE_QUERIES = [
  // Randomly mixed English, Hindi, and Marwari
  "What's the admission process?",
  "प्रवेश प्रक्रिया क्या है?",
  "प्रवेश प्रक्रिया कुणी आहै?",
  "Tell me about placements",
  "छात्रवृत्ति के बारे में बताएं",
  "नोकरी मौके बारे में बतावो",
  "How do I apply for scholarship?",
  "कोर्स की जानकारी दें",
  "छात्रावास की सुविधाएं क्या हैं?",
  "What courses are available?",
  "हॉस्टल की सुविधाएं क्या हैं?",
  "पात्रता मानदंड क्या हैं?",
  "Tell me about hostel facilities",
  "शुल्क संरचना कैसी है?",
  "कौन से पाठ्यक्रम उपलब्ध हैं?",
  "What are the eligibility criteria?",
  "मुझे नौकरी की तैयारी में मदद दें",
  "शुल्क संरचना कैसी है?",
  "How are fees structured?",
  "पात्रता मानदंड क्या हैं?",
];

const ROTATION_INTERVAL = 2000; // 2 seconds per query

export function useAnimatedPlaceholder() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % SAMPLE_QUERIES.length);
    }, ROTATION_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  return {
    placeholder: SAMPLE_QUERIES[currentIndex],
    allQueries: SAMPLE_QUERIES,
    currentIndex,
  };
}
