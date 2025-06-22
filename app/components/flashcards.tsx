"use client";

import React, { useState, useEffect, useRef } from "react";

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
  // Expecting format: Q: ... A: ... (repeated)
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

// Typing animation hook for placeholder
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

// Helper functions for localStorage
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

// Given a base subject, return a unique subject name (e.g. "Math", "Math(1)", "Math(2)", etc.)
function getUniqueSubjectName(base: string, sets: StoredSet[]): string {
  // Find all sets with subject === base or subject matches base(n)
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
  // Escape regex special chars
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

// --- Flashcard Flip Animation CSS ---
const flashcardFlipStyles = `
.flashcard-flip-container {
  perspective: 1000px;
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
  transition: transform 0.8s cubic-bezier(.4,2,.6,1);
  transform-style: preserve-3d;
  cursor: pointer;
  user-select: none;
}
.flashcard-flip.flipped {
  transform: rotateY(180deg);
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
}
.flashcard-flip-back {
  transform: rotateY(180deg);
}
`;

// --- Flashcard Switch Animation CSS (more alive) ---
const flashcardSwitchStyles = `
.flashcard-switch-anim {
  animation: flashcardSwitchAlive 0.55s cubic-bezier(.4,2,.6,1);
  z-index: 1;
  box-shadow: 0 8px 32px 0 rgba(0, 148, 222, 0.18), 0 1.5px 8px 0 rgba(0,0,0,0.08);
}
@keyframes flashcardSwitchAlive {
  0% {
    opacity: 0;
    transform: scale(0.92) rotateZ(-6deg) translateY(40px);
    filter: blur(2px) brightness(1.1);
    box-shadow: 0 0 0 0 rgba(0,148,222,0.0);
  }
  30% {
    opacity: 1;
    transform: scale(1.04) rotateZ(2deg) translateY(-10px);
    filter: blur(0.5px) brightness(1.05);
    box-shadow: 0 8px 32px 0 rgba(0, 148, 222, 0.18);
  }
  60% {
    opacity: 1;
    transform: scale(0.98) rotateZ(-1deg) translateY(4px);
    filter: blur(0px) brightness(1);
    box-shadow: 0 4px 16px 0 rgba(0, 148, 222, 0.10);
  }
  80% {
    opacity: 1;
    transform: scale(1.01) rotateZ(0.5deg) translateY(-2px);
    filter: blur(0px) brightness(1);
    box-shadow: 0 2px 8px 0 rgba(0, 148, 222, 0.08);
  }
  100% {
    opacity: 1;
    transform: scale(1) rotateZ(0deg) translateY(0);
    filter: blur(0px) brightness(1);
    box-shadow: 0 1.5px 8px 0 rgba(0,0,0,0.08);
  }
}
`;

if (typeof window !== "undefined") {
  // Inject the CSS once for flip
  if (!document.getElementById("flashcard-flip-style")) {
    const style = document.createElement("style");
    style.id = "flashcard-flip-style";
    style.innerHTML = flashcardFlipStyles;
    document.head.appendChild(style);
  }
  // Inject the CSS once for switch
  if (!document.getElementById("flashcard-switch-style")) {
    const style = document.createElement("style");
    style.id = "flashcard-switch-style";
    style.innerHTML = flashcardSwitchStyles;
    document.head.appendChild(style);
  }
}

const Flashcards = () => {
  const [subject, setSubject] = useState("");
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  // New state to control generator visibility
  const [showGenerator, setShowGenerator] = useState(true);

  // New state to track if we're adding more questions
  const [addingMore, setAddingMore] = useState(false);

  // State for stored sets
  const [storedSets, setStoredSets] = useState<StoredSet[]>([]);

  // Track which subject is currently being viewed (for add more, etc.)
  const [activeSubject, setActiveSubject] = useState<string | null>(null);

  // Typing animation for placeholder
  const exampleSubjects = [
    "Quantum Physics",
    "Formula 1",
    "Photosynthesis",
    "World War II",
    "Calculus",
    "Cristiano Ronaldo",
    "Shakespeare",
    "Machine Learning",
    "The French Revolution",
    "Cell Biology"
  ];
  const animatedPlaceholder = useTypingPlaceholder(exampleSubjects);

  // --- Flashcard Switch Animation State ---
  const [switchAnimKey, setSwitchAnimKey] = useState(0);

  // Load stored sets on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      setStoredSets(getStoredSets());
    }
  }, []);

  // Helper to generate flashcards (5 at a time)
  // eslint-disable-next-line
  const generateFlashcards = async (subject: string, prevQuestions: string[] = [], isAddMore = false) => {
    setLoading(true);
    setError(null);

    // If prevQuestions is empty, this is the initial generation
    let prompt = "";
    if (prevQuestions.length === 0) {
      prompt = `Generate 5 flashcards about "${subject}". For each flashcard, provide a question and its answer in the following format:

Q: [question]
A: [answer]

Only output the flashcards in this format.`;
    } else {
      // Add instruction to avoid repeating previous questions
      const prevQs = prevQuestions.map((q, i) => `Q${i + 1}: ${q}`).join("\n");
      prompt = `Generate 5 additional flashcards about "${subject}". Do not repeat any of these questions:

${prevQs}

For each new flashcard, provide a question and its answer in the following format:

Q: [question]
A: [answer]

Only output the flashcards in this format.`;
    }

    try {
      const res = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" +
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

      if (prevQuestions.length === 0) {
        // New set: always add as a new set, possibly with a unique name
        const uniqueSubject = addStoredSet(subject, cards);
        setStoredSets(getStoredSets());
        setSubject(uniqueSubject);
        setActiveSubject(uniqueSubject);
        setFlashcards(cards);
        setShowGenerator(false);
        setCurrent(0);
        setShowAnswer(false);
        setSwitchAnimKey((k) => k + 1);
      } else {
        // Add more to the current set (activeSubject)
        setFlashcards((prev) => {
          const updated = [...prev, ...cards];
          if (activeSubject) {
            updateStoredSet(activeSubject, updated);
            setStoredSets(getStoredSets());
          }
          return updated;
        });
        setCurrent(flashcards.length); // Move to the first of the new cards
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

  // Initial form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFlashcards([]);
    setCurrent(0);
    setShowAnswer(false);
    setActiveSubject(null);
    setSwitchAnimKey((k) => k + 1);
    await generateFlashcards(subject, []);
  };

  // Add 5 more questions
  const handleAddMore = async () => {
    setAddingMore(true);
    // Gather all previous questions to avoid repeats
    const prevQuestions = flashcards.map((card) => card.question);
    await generateFlashcards(activeSubject ?? subject, prevQuestions, true);
  };

  // Flip the flashcard
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

  // When user clicks a stored subject, load its flashcards and go to flashcard view
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

  // Remove a stored set
  const handleDeleteStoredSet = (subjectToDelete: string) => {
    const sets = getStoredSets().filter((s) => s.subject !== subjectToDelete);
    saveStoredSets(sets);
    setStoredSets(sets);
    // If currently viewing this set, go back to generator
    if (!showGenerator && (activeSubject === subjectToDelete || subject === subjectToDelete)) {
      handleBackToGenerator();
    }
  };

  // --- Animation for blue circles ---
  // We'll animate the "current" circle with a scale and color transition.
  // We'll use a little CSS-in-JS for the animation keyframes.

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

  // Track which circle was last animated
  const [lastAnimatedCircle, setLastAnimatedCircle] = useState<number | null>(null);

  // When current changes, animate the corresponding circle
  useEffect(() => {
    setLastAnimatedCircle(current);
  }, [current]);

  // --- Flashcard Switch Animation: trigger on current index change ---
  const [lastCurrent, setLastCurrent] = useState(current);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (lastCurrent !== current) {
      setSwitching(true);
      const timeout = setTimeout(() => setSwitching(false), 550);
      setLastCurrent(current);
      return () => clearTimeout(timeout);
    }
  }, [current, lastCurrent]);

  // --- Arrow navigation handlers ---
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

  // Keyboard navigation for arrows (left/right)
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
    // eslint-disable-next-line
  }, [showGenerator, flashcards.length, current]);

  return (
    <div className="w-3/4 mt-32">
      <h2 className="text-xl font-bold mb-4 text-center">AI Flashcards Generator</h2>
      {showGenerator ? (
        <>
          <form onSubmit={handleSubmit} className="mb-4 flex flex-col gap-2">
            <input
              type="text"
              className="border p-2 rounded"
              placeholder={animatedPlaceholder}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              disabled={loading}
              autoComplete="off"
            />
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
              disabled={loading}
            >
              {loading ? "Generating flashcards..." : "Generate Flashcards"}
            </button>
          </form>
          {error && <div className="text-red-600 mb-2">{error}</div>}
          {/* Show stored sets */}
          {storedSets.length > 0 && (
            <div className="mb-6">
              <div className="font-semibold mb-2 text-gray-700">Your Flashcard Sets:</div>
              <ul className="space-y-2">
                {storedSets.map((set) => (
                  <li key={set.subject} className="flex items-center justify-between group">
                    <div className="flex items-center gap-2">
                      <button
                        className="text-blue-700 underline hover:text-blue-900 text-left"
                        onClick={() => handleStoredSetClick(set)}
                      >
                        {set.subject}
                      </button>
                      <button
                        className="ml-2 text-xs text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                        title="Delete set"
                        onClick={() => handleDeleteStoredSet(set.subject)}
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <>
          {error && <div className="text-red-600 mb-2">{error}</div>}
          {flashcards.length > 0 && (
            <div className="flex flex-col items-center rounded-lg p-4">
              {/* Flashcard Set Title */}
              <div className="w-full flex flex-col items-center mb-2">
                <div className="text-2xl font-bold text-blue-800 text-center">
                  {activeSubject || subject}
                </div>
              </div>
              <div className="w-1/2 h-96 flex flex-row items-center justify-center relative">
                {/* Left Arrow Button */}
                <button
                  onClick={handlePrev}
                  disabled={current === 0}
                  aria-label="Previous flashcard"
                  className={`absolute left-[-3.5rem] top-1/2 -translate-y-1/2 z-10 bg-white border border-gray-300 rounded-full shadow-lg w-14 h-14 flex items-center justify-center text-4xl font-bold text-blue-700 hover:bg-blue-50 transition disabled:opacity-40 disabled:cursor-not-allowed`}
                  style={{ outline: "none" }}
                  tabIndex={0}
                >
                  &#8592;
                </button>
                <div
                  className="flashcard-flip-container w-full h-full"
                  style={{ minHeight: 120 }}
                >
                  <div
                    key={switchAnimKey}
                    className={`flashcard-flip ${showAnswer ? "flipped" : ""} bg-white w-full h-full rounded-xl shadow-2xl ${switching ? "flashcard-switch-anim" : ""}`}
                    onClick={handleFlip}
                    tabIndex={0}
                    role="button"
                    aria-label="Flip flashcard"
                    style={{
                      minHeight: 120,
                      outline: "none",
                    }}
                    onKeyDown={e => {
                      if (e.key === " " || e.key === "Enter") {
                        e.preventDefault();
                        handleFlip();
                      }
                    }}
                  >
                    {/* Front (Question) */}
                    <div className="flashcard-flip-front px-6 py-6 w-full h-full">
                      <div className="text-center text-base">
                        {flashcards[current].question}
                      </div>
                    </div>
                    {/* Back (Answer) */}
                    <div className="flashcard-flip-back px-6 py-6 w-full h-full">
                      <div className="text-center text-base">
                        {flashcards[current].answer}
                      </div>
                    </div>
                  </div>
                </div>
                {/* Right Arrow Button */}
                <button
                  onClick={handleNext}
                  disabled={current === flashcards.length - 1}
                  aria-label="Next flashcard"
                  className={`absolute right-[-3.5rem] top-1/2 -translate-y-1/2 z-10 bg-white border border-gray-300 rounded-full shadow-lg w-14 h-14 flex items-center justify-center text-4xl font-bold text-blue-700 hover:bg-blue-50 transition disabled:opacity-40 disabled:cursor-not-allowed`}
                  style={{ outline: "none" }}
                  tabIndex={0}
                >
                  &#8594;
                </button>
              </div>
              <div className="flex gap-3 mt-32">
                {flashcards.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleCircleClick(idx)}
                    className={`w-4 h-4 rounded-full flex items-center justify-center transition-colors cursor-pointer
                      ${idx <= current
                        ? "bg-[#00659C] opacity-100"
                        : "bg-[#0094DE] opacity-50"
                      }
                      ${idx === current && lastAnimatedCircle === idx ? "flashcard-circle-anim" : ""}
                    `}
                    aria-label={`Go to flashcard ${idx + 1}`}
                    style={{ outline: "none" }}
                  ></button>
                ))}
              </div>
              <div className="flex flex-col items-center w-full">
                <button
                  onClick={handleAddMore}
                  className="mt-6 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition disabled:opacity-50"
                  disabled={loading || addingMore}
                >
                  {addingMore ? "Adding more flashcards..." : "Add 5 More Questions"}
                </button>
                <button
                  onClick={handleBackToGenerator}
                  className="mt-4 bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400 transition"
                >
                  Back to Generator
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Flashcards;
