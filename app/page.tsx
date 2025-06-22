import Flashcards from "./components/flashcards";

export default function Home() {
  return (
    <div
      className="flex justify-center min-h-screen"
      style={{
        background:
          "linear-gradient(135deg, #007cf0 0%, #00dfd8 40%, #38bdf8 70%, #2563eb 100%)",
      }}
    >
      <Flashcards />
    </div>
  );
}
