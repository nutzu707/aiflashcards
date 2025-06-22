import Flashcards from "./components/flashcards";

export default function Home() {
  return (
    <div
      className="flex justify-center min-h-screen"
      style={{
        background: "linear-gradient(135deg, #00A5F7 0%, #38bdf8 100%)",
      }}
    >
      <Flashcards />
    </div>
  );
}
