import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

interface SuggestionProps {
  suggestion: string;
  onClick: (suggestion: string) => void;
  className?: string;
}

export function Suggestion({
  suggestion,
  onClick,
  className,
}: SuggestionProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => onClick(suggestion)}
      className={cn(
        "h-auto py-1.5 px-3 text-xs font-normal text-left whitespace-nowrap",
        "bg-white text-gray-700 hover:bg-[#FFF4E1] hover:text-[#004aad]",
        "border border-gray-200 hover:border-[#004aad]/50",
        "transition-all duration-200 ease-in-out rounded-full",
        "shadow-sm",
        className
      )}
    >
      {suggestion}
    </Button>
  );
}

interface SuggestionsProps {
  suggestions: string[];
  onSuggestionClick: (suggestion: string) => void;
  className?: string;
}

export function Suggestions({
  suggestions,
  onSuggestionClick,
  className,
}: SuggestionsProps) {
  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-wrap gap-2 mt-2 animate-fade-in justify-end",
        className
      )}
    >
      {suggestions.map((suggestion, index) => (
        <Suggestion
          key={`${suggestion}-${index}`}
          suggestion={suggestion}
          onClick={onSuggestionClick}
        />
      ))}
    </div>
  );
}
