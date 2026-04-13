export function TypingIndicator() {
  return (
    <div className="flex gap-3 items-start">
      <div className="flex items-center gap-1 px-4 py-3 bg-[#FFF4E1] border border-gray-200 rounded-lg">
        <div className="w-2 h-2 rounded-full bg-[#004aad] animate-bounce [animation-delay:-0.3s]" />
        <div className="w-2 h-2 rounded-full bg-[#004aad] animate-bounce [animation-delay:-0.15s]" />
        <div className="w-2 h-2 rounded-full bg-[#004aad] animate-bounce" />
      </div>
    </div>
  );
}
