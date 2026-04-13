import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DollarSign,
  GraduationCap,
  BookOpen,
  Users,
  Calendar,
  Award,
  Building,
  FileText,
} from "lucide-react";

interface TopicSuggestion {
  text: string;
  icon: React.ReactNode;
}

const TOPIC_SUGGESTIONS: TopicSuggestion[] = [
  {
    text: "Fee structure for 2025-26",
    icon: <DollarSign className="h-4 w-4" />,
  },
  {
    text: "Admission process and eligibility",
    icon: <GraduationCap className="h-4 w-4" />,
  },
  {
    text: "Available courses and programs",
    icon: <BookOpen className="h-4 w-4" />,
  },
  {
    text: "Placement statistics and companies",
    icon: <Users className="h-4 w-4" />,
  },
  {
    text: "Important dates and deadlines",
    icon: <Calendar className="h-4 w-4" />,
  },
  {
    text: "Scholarship opportunities",
    icon: <Award className="h-4 w-4" />,
  },
  {
    text: "Hostel and accommodation facilities",
    icon: <Building className="h-4 w-4" />,
  },
  {
    text: "Exam pattern and syllabus",
    icon: <FileText className="h-4 w-4" />,
  },
];

interface InitialSuggestionsProps {
  onTopicClick: (topic: string) => void;
  className?: string;
}

export function InitialSuggestions({
  onTopicClick,
  className,
}: InitialSuggestionsProps) {
  return (
    <div className={cn("w-full mt-2 animate-fade-in", className)}>
      <div className="flex flex-wrap gap-2 items-start">
        {TOPIC_SUGGESTIONS.map((suggestion, index) => (
          <Button
            key={index}
            variant="outline"
            size="sm"
            onClick={() => onTopicClick(suggestion.text)}
            className={cn(
              "h-auto py-1.5 px-3 text-left inline-flex items-center gap-2 flex-shrink-0",
              "bg-white text-gray-700 hover:bg-[#FFF4E1] hover:text-[#004aad]",
              "border border-gray-200 hover:border-[#004aad]/50",
              "transition-all duration-200 ease-in-out rounded-full",
              "shadow-sm w-auto"
            )}
          >
            <div className="flex-shrink-0 text-[#004aad]">
              {suggestion.icon}
            </div>
            <span className="text-xs font-normal">{suggestion.text}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
