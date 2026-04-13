import { useState } from "react";
import { ChevronDown, ChevronUp, Globe, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Source {
  title: string;
  url: string;
}

interface SourcesProps {
  sources: Source[];
  className?: string;
}

/**
 * Collapsible Sources component to display web search citations
 * Shows a trigger button with source count that expands to show URLs
 */
export function Sources({ sources, className }: SourcesProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (sources.length === 0) return null;

  return (
    <div className={cn("mt-2", className)}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-[#004aad] transition-colors font-medium"
      >
        <Globe className="h-3 w-3" />
        <span>
          {sources.length} web source{sources.length > 1 ? "s" : ""}
        </span>
        {isExpanded ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-1.5 space-y-1 pl-3 border-l border-muted-foreground/30">
          {sources.map((source, i) => (
            <a
              key={i}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-1 text-xs text-[#004aad] hover:underline max-w-full overflow-hidden"
            >
              <ExternalLink className="h-3 w-3 flex-shrink-0 mt-0.5" />
              <span className="line-clamp-1 break-all">
                {source.title || new URL(source.url).hostname}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
