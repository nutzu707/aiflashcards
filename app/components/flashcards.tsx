"use client";

import React, { useState } from "react";

const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY; // Set this in your .env.local

type Flashcard = {
  question: string;
  answer: string;
};

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

const Flashcards = () => {
  const [subject, setSubject] = useState("");
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  // New state to control generator visibility
  const [showGenerator, setShowGenerator] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFlashcards([]);
    setCurrent(0);
    setShowAnswer(false);

    const prompt = `Generate 5 flashcards about "${subject}". For each flashcard, provide a question and its answer in the following format:

Q: [question]
A: [answer]

Only output the flashcards in this format.`;

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

      setFlashcards(cards);
      setShowGenerator(false); // Hide generator after successful generation
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message || "An error occurred.");
      } else {
        setError("An error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFlip = () => setShowAnswer((prev) => !prev);

  const handleCircleClick = (idx: number) => {
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
  };

  return (
    <div className="w-3/4 mt-32">
      <h2 className="text-xl font-bold mb-4 text-center">AI Flashcards Generator</h2>
      {showGenerator ? (
        <>
          <form onSubmit={handleSubmit} className="mb-4 flex flex-col gap-2">
            <input
              type="text"
              className="border p-2 rounded"
              placeholder="Enter a subject (e.g. Photosynthesis, World War II, Calculus)..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              disabled={loading}
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
        </>
      ) : (
        <>
          {error && <div className="text-red-600 mb-2">{error}</div>}
          {flashcards.length > 0 && (
            <div className="flex flex-col items-center">
              <div className="w-full bg-gray-100 p-6 rounded shadow mb-4 min-h-[120px] flex flex-col justify-center items-center">
                <div className="text-gray-700 text-lg font-semibold mb-2">
                  Flashcard {current + 1} of {flashcards.length}
                </div>
                <div className="text-center text-base">
                  {!showAnswer ? (
                    <>
                      <span className="font-bold">Q:</span> {flashcards[current].question}
                    </>
                  ) : (
                    <>
                      <span className="font-bold">A:</span> {flashcards[current].answer}
                    </>
                  )}
                </div>
                <button
                  onClick={handleFlip}
                  className="mt-4 bg-blue-500 text-white px-4 py-1 rounded"
                >
                  {showAnswer ? "Show Question" : "Show Answer"}
                </button>
              </div>
              <div className="flex gap-3 mt-2">
                {/* Only fill circles from left to right up to the current flashcard */}
                {flashcards.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleCircleClick(idx)}
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors cursor-pointer
                      ${
                        idx < current
                          ? "bg-blue-600 border-blue-600"
                          : idx === current
                          ? "bg-blue-600 border-blue-600"
                          : "bg-white border-gray-400 hover:border-blue-400"
                      }
                    `}
                    aria-label={`Go to flashcard ${idx + 1}`}
                    style={{ outline: "none" }}
                  >
                    <span
                      className={`block w-2 h-2 rounded-full ${
                        idx < current
                          ? "bg-white"
                          : idx === current
                          ? "bg-white"
                          : "bg-gray-400"
                      }`}
                    ></span>
                  </button>
                ))}
              </div>
              <button
                onClick={handleBackToGenerator}
                className="mt-6 bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400 transition"
              >
                Back to Generator
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Flashcards;
