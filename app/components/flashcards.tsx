"use client";

import React, { useState, useEffect, useRef } from "react";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";

const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

type Flashcard = {
  question: string;
  answer: string;
};

type StoredSet = {
  subject: string;
  flashcards: Flashcard[];
};

const STORAGE_KEY = "ai_flashcard_sets";

const parseFlashcards = (text: string): Flashcard[] => {
  const cards: Flashcard[] = [];
  const regex = /Q:\s*([\s\S]+?)\s*A:\s*([\s\S]+?)(?=Q:|$)/g;
  let match;
  while ((match = regex.exec(text))) {
    cards.push({
      question: match[1].trim(),
      answer: match[2].trim(),
    });
  }
  return cards;
};

const useTypingPlaceholder = (examples: string[], typingSpeed = 70, pause = 1200) => {
  const [placeholder, setPlaceholder] = useState("");
  const [exampleIdx, setExampleIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const currentExample = examples[exampleIdx];
    if (!deleting) {
      if (charIdx < currentExample.length) {
        timeoutRef.current = setTimeout(() => {
          setPlaceholder(currentExample.slice(0, charIdx + 1));
          setCharIdx((c) => c + 1);
        }, typingSpeed);
      } else {
        timeoutRef.current = setTimeout(() => {
          setDeleting(true);
        }, pause);
      }
    } else {
      if (charIdx > 0) {
        timeoutRef.current = setTimeout(() => {
          setPlaceholder(currentExample.slice(0, charIdx - 1));
          setCharIdx((c) => c - 1);
        }, typingSpeed / 2);
      } else {
        setDeleting(false);
        setExampleIdx((i) => (i + 1) % examples.length);
      }
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [charIdx, deleting, exampleIdx, examples, typingSpeed, pause]);

  return `${placeholder}${!deleting && charIdx < examples[exampleIdx].length ? "|" : ""}...`;
};

function getStoredSets(): StoredSet[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StoredSet[];
  } catch {
    return [];
  }
}

function saveStoredSets(sets: StoredSet[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sets));
}

function getUniqueSubjectName(base: string, sets: StoredSet[]): string {
  const regex = new RegExp(`^${escapeRegExp(base)}(?:\\((\\d+)\\))?$`);
  let maxIndex = -1;
  let foundBase = false;
  sets.forEach((set) => {
    const match = set.subject.match(regex);
    if (match) {
      if (match[1]) {
        const idx = parseInt(match[1], 10);
        if (!isNaN(idx) && idx > maxIndex) {
          maxIndex = idx;
        }
      } else {
        foundBase = true;
      }
    }
  });
  if (!foundBase) return base;
  return `${base}(${maxIndex + 1})`;
}

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function addStoredSet(subject: string, flashcards: Flashcard[]): string {
  const sets = getStoredSets();
  const uniqueSubject = getUniqueSubjectName(subject, sets);
  sets.unshift({ subject: uniqueSubject, flashcards });
  saveStoredSets(sets);
  return uniqueSubject;
}

function updateStoredSet(subject: string, flashcards: Flashcard[]) {
  const sets = getStoredSets();
  const idx = sets.findIndex((s) => s.subject === subject);
  if (idx !== -1) {
    sets[idx].flashcards = flashcards;
    saveStoredSets(sets);
  }
}

// --- Flip Card Animations and Styles (REWRITTEN) ---
// CHANGED FLIP ANIMATION: Now uses a "flip up" (rotateX) instead of "flip sideways" (rotateY)
// REWRITE: Now uses a "vertical flip" (rotateY) instead of "flip up" (rotateX)
const flashcardFlipStyles = `
.flashcard-flip-container {
  perspective: 1200px;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.flashcard-flip {
  width: 100%;
  min-height: 120px;
  position: relative;
  transition: transform 0.7s cubic-bezier(.4,2,.6,1), box-shadow 0.3s, background 0.3s;
  transform-style: preserve-3d;
  cursor: pointer;
  user-select: none;
  box-shadow: 0 8px 32px 0 rgba(0, 148, 222, 0.18), 0 2px 8px 0 rgba(0,0,0,0.10);
  background: linear-gradient(135deg, rgba(0,148,222,0.10) 0%, rgba(255,255,255,0.95) 150%);
  border-radius: 2rem;
  border: 2.5px solid #b6e0fe;
  filter: drop-shadow(0 0 16px #b6e0fe33);
  will-change: transform, box-shadow;
}
.flashcard-flip.flipped {
  /* Instead of rotateX, use rotateY for a "vertical flip" effect */
  transform: rotateY(180deg) scale(1.03);
  box-shadow: 0 12px 36px 0 rgba(0, 222, 148, 0.18), 0 2px 8px 0 rgba(0,0,0,0.10);
}
.flashcard-flip-front, .flashcard-flip-back {
  position: absolute;
  width: 100%;
  min-height: 120px;
  left: 0;
  top: 0;
  backface-visibility: hidden;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  transition: opacity 0.3s;
  height: 100%;
}
.flashcard-flip-front {
  z-index: 2;
  /* No transform, front is default */
}
.flashcard-flip-back {
  /* Instead of rotateX(180deg), use rotateY(180deg) for vertical flip */
  transform: rotateY(180deg);
  z-index: 3;
}
.flashcard-glow {
  box-shadow: 0 0 32px 8px #0094de55, 0 2px 8px 0 rgba(0,0,0,0.10);
  animation: flashcardGlowPulse 1.2s infinite alternate;
}
@keyframes flashcardGlowPulse {
  0% { box-shadow: 0 0 32px 8px #0094de33, 0 2px 8px 0 rgba(0,0,0,0.10);}
  100% { box-shadow: 0 0 48px 16px #0094de66, 0 2px 8px 0 rgba(0,0,0,0.10);}
}
`;

const flashcardSwitchStyles = `
.flashcard-switch-anim {
  animation: flashcardSwitchSleek .32s cubic-bezier(.4,1.2,.6,1);
  z-index: 1;
  box-shadow: 0 10px 32px 0 rgba(0, 148, 222, 0.18), 0 2px 8px 0 rgba(0,0,0,0.10);
}
@keyframes flashcardSwitchSleek {
  0% {
    opacity: 0.7;
    transform: scale(0.98) translateY(24px);
    filter: blur(1.2px) brightness(1.04);
    box-shadow: 0 0 0 0 rgba(0,148,222,0.0);
  }
  40% {
    opacity: 1;
    transform: scale(1.025) translateY(-8px);
    filter: blur(0.3px) brightness(1.01);
    box-shadow: 0 10px 32px 0 rgba(0, 148, 222, 0.18);
  }
  80% {
    opacity: 1;
    transform: scale(0.995) translateY(2px);
    filter: blur(0px) brightness(1);
    box-shadow: 0 2px 8px 0 rgba(0, 148, 222, 0.07);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
    filter: blur(0px) brightness(1);
    box-shadow: 0 2px 8px 0 rgba(0,0,0,0.10);
  }
}
`;

const animatedButtonStyles = `
@keyframes buttonPop {
  0% { transform: scale(1);}
  50% { transform: scale(1.08);}
  100% { transform: scale(1);}
}
.animated-pop:active {
  animation: buttonPop 0.22s cubic-bezier(.4,2,.6,1);
}
.animated-gradient {
  background: linear-gradient(90deg, #0094de 0%, #00e0c6 100%);
  background-size: 200% 200%;
  animation: gradientMove 2.5s ease-in-out infinite alternate;
}
@keyframes gradientMove {
  0% { background-position: 0% 50%;}
  100% { background-position: 100% 50%;}
}
`;

if (typeof window !== "undefined") {
  if (!document.getElementById("flashcard-flip-style")) {
    const style = document.createElement("style");
    style.id = "flashcard-flip-style";
    style.innerHTML = flashcardFlipStyles;
    document.head.appendChild(style);
  }
  if (!document.getElementById("flashcard-switch-style")) {
    const style = document.createElement("style");
    style.id = "flashcard-switch-style";
    style.innerHTML = flashcardSwitchStyles;
    document.head.appendChild(style);
  }
  if (!document.getElementById("animated-button-style")) {
    const style = document.createElement("style");
    style.id = "animated-button-style";
    style.innerHTML = animatedButtonStyles;
    document.head.appendChild(style);
  }
}

// --- FIX: Always render both sides of the card, let CSS handle visibility via 3D transform ---
// REWRITE: Show the answer on the front if showAnswer is true, otherwise show the question.
// CHANGED: Now uses rotateY for vertical flip, so remove -scale-x-100 and any rotateX logic
const FlashcardFlip = ({
  question,
  answer,
  showAnswer,
  onFlip,
  switching,
  switchAnimKey,
}: {
  question: string;
  answer: string;
  showAnswer: boolean;
  onFlip: () => void;
  switching: boolean;
  switchAnimKey: number;
}) => {
  // Accessibility: focus on card after switch
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (cardRef.current) {
      cardRef.current.focus();
    }
  }, [switchAnimKey]);

  return (
    <div
      className="flashcard-flip-container w-full max-w-2xl h-80"
      style={{ minHeight: 120 }}
    >
      <div
        key={switchAnimKey}
        ref={cardRef}
        className={`flashcard-flip w-full h-full${showAnswer ? " flipped " : ""} ${switching ? "flashcard-switch-anim" : ""} ${!showAnswer ? "flashcard-glow" : ""}`}
        tabIndex={0}
        role="button"
        aria-label="Flip flashcard"
        style={{
          minHeight: 120,
          outline: "none",
        }}
        onClick={onFlip}
        onKeyDown={e => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            onFlip();
          }
        }}
      >
        {/* Always render both sides, let CSS handle visibility */}
        <div className={`flashcard-flip-front w-full h-full${showAnswer ? " scale-x-[-1]" : ""}`}>
          <div className={`flex flex-col items-center justify-center h-full px-12`}>
            <span
              className={`text-center font-extrabold text-3xl ${
                showAnswer ? "text-green-900" : "text-blue-900"
              } animate-fade-in`}
              style={{ letterSpacing: "0.01em" }}
            >
              {showAnswer ? answer : question}
            </span>
            <span
              className={`mt-6 text-base animate-pulse ${
                showAnswer ? "text-green-500" : "text-cyan-500"
              }`}
            >
              {showAnswer ? "Click to show question" : "Click to reveal answer"}
            </span>
          </div>
        </div>
        <div className="flashcard-flip-back w-full h-full">
          <div className="flex flex-col items-center justify-center h-full px-12">
            <span
              className={`text-center font-extrabold  text-3xl ${
                showAnswer ? "text-blue-900" : "text-green-900"
              } animate-fade-in`}
              style={{ letterSpacing: "0.01em" }}
            >
              {showAnswer ? question : answer}
            </span>
            <span
              className={`mt-6 text-base animate-pulse ${
                showAnswer ? "text-cyan-500" : "text-green-500"
              }`}
            >
              {showAnswer ? "Click to reveal answer" : "Click to show question"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const Flashcards = () => {
  const [subject, setSubject] = useState("");
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showGenerator, setShowGenerator] = useState(true);
  const [addingMore, setAddingMore] = useState(false);
  const [storedSets, setStoredSets] = useState<StoredSet[]>([]);
  const [activeSubject, setActiveSubject] = useState<string | null>(null);

  const exampleSubjects = [
    "Photosynthesis",
    "Quantum Physics",
    "World War II",
    "Formula 1",
    "Calculus",
    "Cristiano Ronaldo",
    "Shakespeare",
    "Machine Learning",
    "The French Revolution",
    "Cell Biology"
  ];
  const animatedPlaceholder = useTypingPlaceholder(exampleSubjects);

  const [switchAnimKey, setSwitchAnimKey] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setStoredSets(getStoredSets());
    }
  }, []);

  // --- Flashcard Generation Logic (unchanged) ---
  // eslint-disable-next-line
  const generateFlashcards = async (subject: string, prevQuestions: string[] = [], isAddMore = false) => {
    setLoading(true);
    setError(null);

    let prompt = "";
    if (prevQuestions.length === 0) {
      prompt = `Generate 5 flashcards about "${subject}". For each flashcard, provide a question and its answer in the following format:

Q: [question] (question must be less than 30 words)
A: [answer] (answer must be less than 30 words)

Only output the flashcards in this format.`;
    } else {
      const prevQs = prevQuestions.map((q, i) => `Q${i + 1}: ${q}`).join("\n");
      prompt = `Generate 5 additional flashcards about "${subject}". Do not repeat any of these questions:

${prevQs}

For each new flashcard, provide a question and its answer in the following format:

Q: [question] (question must be less than 30 words)
A: [answer] (answer must be less than 30 words)

Only output the flashcards in this format.`;
    }

    try {
      const res = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=" +
          GEMINI_API_KEY,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }],
              },
            ],
          }),
        }
      );

      if (!res.ok) {
        throw new Error("Failed to fetch flashcards from Gemini");
      }

      const data = await res.json();
      const geminiText =
        data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

      const cards = parseFlashcards(geminiText);

      if (cards.length === 0) {
        throw new Error("Could not parse flashcards from Gemini's response.");
      }

      const filteredCards = cards.filter(card => card.question.split(/\s+/).filter(Boolean).length < 30);

      if (filteredCards.length === 0) {
        throw new Error("Could not parse flashcards with questions under 30 words from Gemini's response.");
      }

      if (prevQuestions.length === 0) {
        const uniqueSubject = addStoredSet(subject, filteredCards);
        setStoredSets(getStoredSets());
        setSubject(uniqueSubject);
        setActiveSubject(uniqueSubject);
        setFlashcards(filteredCards);
        setShowGenerator(false);
        setCurrent(0);
        setShowAnswer(false);
        setSwitchAnimKey((k) => k + 1);
      } else {
        setFlashcards((prev) => {
          const updated = [...prev, ...filteredCards];
          if (activeSubject) {
            updateStoredSet(activeSubject, updated);
            setStoredSets(getStoredSets());
          }
          return updated;
        });
        setCurrent(flashcards.length);
        setShowAnswer(false);
        setSwitchAnimKey((k) => k + 1);
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message || "An error occurred.");
      } else {
        setError("An error occurred.");
      }
    } finally {
      setLoading(false);
      setAddingMore(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFlashcards([]);
    setCurrent(0);
    setShowAnswer(false);
    setActiveSubject(null);
    setSwitchAnimKey((k) => k + 1);
    await generateFlashcards(subject, []);
  };

  const handleAddMore = async () => {
    setAddingMore(true);
    const prevQuestions = flashcards.map((card) => card.question);
    await generateFlashcards(activeSubject ?? subject, prevQuestions, true);
  };

  const handleFlip = () => setShowAnswer((prev) => !prev);

  const handleCircleClick = (idx: number) => {
    if (idx !== current) {
      setSwitchAnimKey((k) => k + 1);
    }
    setCurrent(idx);
    setShowAnswer(false);
  };

  const handleBackToGenerator = () => {
    setShowGenerator(true);
    setFlashcards([]);
    setCurrent(0);
    setShowAnswer(false);
    setError(null);
    setSubject("");
    setActiveSubject(null);
    setSwitchAnimKey((k) => k + 1);
  };

  const handleStoredSetClick = (set: StoredSet) => {
    setSubject(set.subject);
    setActiveSubject(set.subject);
    setFlashcards(set.flashcards);
    setShowGenerator(false);
    setCurrent(0);
    setShowAnswer(false);
    setError(null);
    setSwitchAnimKey((k) => k + 1);
  };

  const handleDeleteStoredSet = (subjectToDelete: string) => {
    const sets = getStoredSets().filter((s) => s.subject !== subjectToDelete);
    saveStoredSets(sets);
    setStoredSets(sets);
    if (!showGenerator && (activeSubject === subjectToDelete || subject === subjectToDelete)) {
      handleBackToGenerator();
    }
  };

  const circleAnimationStyleId = "flashcard-circle-anim-style";
  useEffect(() => {
    if (typeof window !== "undefined" && !document.getElementById(circleAnimationStyleId)) {
      const style = document.createElement("style");
      style.id = circleAnimationStyleId;
      style.innerHTML = `
        @keyframes flashcardCirclePop {
          0% { transform: scale(1); }
          50% { transform: scale(1.35); }
          100% { transform: scale(1); }
        }
        .flashcard-circle-anim {
          animation: flashcardCirclePop 0.35s cubic-bezier(.4,2,.6,1);
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  const [lastAnimatedCircle, setLastAnimatedCircle] = useState<number | null>(null);

  useEffect(() => {
    setLastAnimatedCircle(current);
  }, [current]);

  const [lastCurrent, setLastCurrent] = useState(current);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (lastCurrent !== current) {
      setSwitching(true);
      const timeout = setTimeout(() => setSwitching(false), 180);
      setLastCurrent(current);
      return () => clearTimeout(timeout);
    }
  }, [current, lastCurrent]);

  const handlePrev = () => {
    if (current > 0) {
      setSwitchAnimKey((k) => k + 1);
      setCurrent((c) => c - 1);
      setShowAnswer(false);
    }
  };

  const handleNext = () => {
    if (current < flashcards.length - 1) {
      setSwitchAnimKey((k) => k + 1);
      setCurrent((c) => c + 1);
      setShowAnswer(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!showGenerator && flashcards.length > 0) {
        if (e.key === "ArrowLeft") {
          handlePrev();
        } else if (e.key === "ArrowRight") {
          handleNext();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showGenerator, flashcards.length, current]);

  // --- Animated, Modern, and Playful UI ---
  return (
    <div className="w-full max-w-4xl mx-auto">
      {showGenerator ? (
        <>
          <div className="flex flex-col items-center mt-32 mb-12 animate-fade-in">
            <h2 className="text-6xl font-extrabold text-white mb-2 text-center drop-shadow-lg tracking-tight animate-gradient-text bg-gradient-to-r from-blue-400 via-cyan-400 to-green-300 bg-clip-text text-transparent">
              AI Flashcards Generator
            </h2>
            <p className="text-lg text-gray-600 mb-8 text-center max-w-xl animate-fade-in-slow">
              Instantly generate high-quality flashcards for any subject. Enter a topic and let AI do the rest.
            </p>
          </div>
          <form
            onSubmit={handleSubmit}
            className="mb-8 flex flex-col gap-4 max-w-2xl mx-auto bg-white/90 border border-blue-200 rounded-3xl shadow-2xl p-10 animate-fade-in"
            style={{
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              boxShadow: "0 8px 32px 0 rgba(0, 148, 222, 0.18), 0 2px 8px 0 rgba(0,0,0,0.10)"
            }}
          >
            <label htmlFor="subject" className="text-lg font-semibold text-blue-900 mb-1 tracking-wide">
              Subject or Topic
            </label>
            <input
              id="subject"
              type="text"
              className="border border-blue-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-3 rounded-xl text-blue-900 bg-white placeholder-gray-400 transition-all duration-150 shadow-inner"
              placeholder={animatedPlaceholder}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              disabled={loading}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="submit"
              className="mt-4 animated-pop animated-gradient cursor-pointer text-white font-semibold px-6 py-3 rounded-xl shadow-lg transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed text-lg tracking-wide"
              disabled={loading}
            >
              {loading ? (
                <span>
                  <span className="inline-block animate-spin mr-2 align-middle">&#9696;</span>
                  Generating flashcards...
                </span>
              ) : (
                <>
                  <span className="inline-block  mr-2">✨</span>
                  Generate Flashcards
                </>
              )}
            </button>
          </form>
          {error && (
            <div className="text-red-600 mb-4 text-center font-medium bg-red-50 border border-red-200 rounded-lg py-2 px-4 max-w-xl mx-auto animate-shake">
              {error}
            </div>
          )}
          {storedSets.length > 0 && (
            <div className="mb-10 max-w-2xl mx-auto bg-white/80 border border-gray-200 rounded-2xl shadow-2xl p-6 animate-fade-in-slow" style={{backdropFilter: "blur(4px)"}}>
              <div className="font-semibold mb-3 text-blue-800 text-lg flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7h18" /></svg>
                Your Flashcard Sets
              </div>
              <ul className="space-y-2">
                {storedSets.map((set, i) => (
                  <li
                    key={set.subject}
                    className="flex items-center justify-between group bg-blue-50/60 hover:bg-blue-100 rounded-lg px-4 py-2 transition-all duration-150 animate-fade-in"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        className="text-blue-700 cursor-pointer font-medium underline underline-offset-2 hover:text-blue-900 text-left transition"
                        onClick={() => handleStoredSetClick(set)}
                      >
                        {set.subject}
                      </button>
                    </div>
                    <button
                      className="ml-2 text-sm text-gray-400 cursor-pointer hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                      title="Delete set"
                      onClick={() => handleDeleteStoredSet(set.subject)}
                      aria-label={`Delete set ${set.subject}`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <>
          {error && (
            <div className="text-red-600 mb-4 text-center font-medium bg-red-50 border border-red-200 rounded-lg py-2 px-4 max-w-xl mx-auto animate-shake">
              {error}
            </div>
          )}
          {flashcards.length > 0 && (
            <div className="flex flex-col items-center w-full animate-fade-in">
              {/* Flashcard Set Title */}
              <div className="w-full flex flex-col items-center mt-24 mb-6">
                <div className="text-6xl font-extrabold text-white text-center drop-shadow-lg tracking-tight mb-2 animate-gradient-text bg-gradient-to-r from-blue-400 via-cyan-400 to-green-300 bg-clip-text text-transparent">
                  {activeSubject || subject}
                </div>
                <div className="text-base text-gray-500 text-center mb-2 animate-fade-in-slow">
                  Flashcard {current + 1} of {flashcards.length}
                </div>
              </div>
              <div className="w-full flex flex-row items-center justify-center mb-8 h-96">
                {/* Left Arrow Button */}
                <button
                  onClick={handlePrev}
                  disabled={current === 0}
                  aria-label="Previous flashcard"
                  className={`text-blue-700 bg-white/90 border cursor-pointer border-blue-200 shadow-lg w-16 h-16 mr-6 rounded-full flex items-center justify-center transition hover:bg-blue-50 disabled:opacity-40 animated-pop`}
                  style={{ outline: "none", fontSize: "1.5rem", boxShadow: "0 4px 16px 0 #b6e0fe55" }}
                  tabIndex={0}
                >
                  <ArrowLeftIcon className="w-8 h-8" />
                </button>
                {/* --- REWRITTEN FLIP CARD --- */}
                <FlashcardFlip
                  question={flashcards[current].question}
                  answer={flashcards[current].answer}
                  showAnswer={showAnswer}
                  onFlip={handleFlip}
                  switching={switching}
                  switchAnimKey={switchAnimKey}
                />
                {/* Right Arrow Button */}
                <button
                  onClick={handleNext}
                  disabled={current === flashcards.length - 1}
                  aria-label="Next flashcard"
                  className={`text-blue-700 bg-white/90 border cursor-pointer border-blue-200 shadow-lg w-16 h-16 ml-6 rounded-full flex items-center justify-center transition hover:bg-blue-50 disabled:opacity-40 animated-pop`}
                  style={{ outline: "none", fontSize: "1.5rem", boxShadow: "0 4px 16px 0 #b6e0fe55" }}
                  tabIndex={0}
                >
                  <ArrowRightIcon className="w-8 h-8" />
                </button>
              </div>
              {(() => {
                // Maximum number of circles per line before wrapping
                const MAX_PER_LINE = 20;
                const lines = [];
                for (let i = 0; i < flashcards.length; i += MAX_PER_LINE) {
                  lines.push(flashcards.slice(i, i + MAX_PER_LINE));
                }
                return (
                  <div className="flex flex-col gap-2 mt-2 mb-8 items-center animate-fade-in-slow">
                    {lines.map((line, lineIdx) => (
                      <div key={lineIdx} className="flex gap-3">
                        {line.map((_, idxInLine) => {
                          const idx = lineIdx * MAX_PER_LINE + idxInLine;
                          return (
                            <button
                              key={idx}
                              onClick={() => handleCircleClick(idx)}
                              className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors cursor-pointer border-2 border-white shadow
                                ${idx <= current
                                  ? "bg-[#0094DE] opacity-100"
                                  : "bg-[#b6e0fe] opacity-60"
                                }
                                ${idx === current && lastAnimatedCircle === idx ? "flashcard-circle-anim" : ""}
                              `}
                              aria-label={`Go to flashcard ${idx + 1}`}
                              style={{ outline: "none", boxShadow: idx === current ? "0 0 8px 2px #0094de88" : undefined, transition: "box-shadow 0.2s" }}
                            ></button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                );
              })()}
              <div className="flex justify-center gap-4 mt-16 flex-row items-center w-full animate-fade-in-slow">
                <button
                  onClick={handleBackToGenerator}
                  className="bg-gray-200 cursor-pointer text-lg text-gray-800 px-6 py-3 rounded-xl hover:bg-gray-300 transition font-semibold shadow animated-pop"
                >
                  <span className="inline-block mr-2">←</span> Back to Generator
                </button>
                <button
                  onClick={handleAddMore}
                  className="animated-pop animated-gradient cursor-pointer text-white font-semibold px-6 py-3 rounded-xl shadow-lg transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed text-lg tracking-wide"
                  disabled={loading || addingMore}
                >
                  {addingMore ? (
                    <span>
                      <span className="inline-block animate-spin mr-2 align-middle">&#9696;</span>
                      Adding more flashcards...
                    </span>
                  ) : (
                    <>
                      <span className="inline-block mr-2">➕</span>
                      Add 5 More Questions
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {/* Animations for fade-in, gradient text, shake, etc. */}
      <style>{`
        @keyframes fadeIn {
          0% { opacity: 0; transform: translateY(32px);}
          100% { opacity: 1; transform: translateY(0);}
        }
        .animate-fade-in { animation: fadeIn 0.7s cubic-bezier(.4,2,.6,1) both;}
        .animate-fade-in-slow { animation: fadeIn 1.2s cubic-bezier(.4,2,.6,1) both;}
        @keyframes gradientText {
          0% { background-position: 0% 50%;}
          100% { background-position: 100% 50%;}
        }
        .animate-gradient-text {
          background-size: 200% 200%;
          animation: gradientText 3.5s ease-in-out infinite alternate;
        }
        @keyframes shake {
          0% { transform: translateX(0);}
          20% { transform: translateX(-6px);}
          40% { transform: translateX(6px);}
          60% { transform: translateX(-4px);}
          80% { transform: translateX(4px);}
          100% { transform: translateX(0);}
        }
        .animate-shake { animation: shake 0.4s cubic-bezier(.4,2,.6,1);}
      `}</style>
    </div>
  );
};

export default Flashcards;