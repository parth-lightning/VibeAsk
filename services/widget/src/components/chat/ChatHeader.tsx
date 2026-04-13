import { Minimize2, X, SquareArrowOutUpRight, Minimize } from "lucide-react";

interface ChatHeaderProps {
  onMinimize: () => void;
  onClose: () => void;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
}

export function ChatHeader({
  onMinimize,
  onClose,
  onToggleFullscreen,
  isFullscreen = false,
}: ChatHeaderProps) {
  return (
    <>
      <div
        className="flex items-center justify-center relative px-4 py-4"
        style={{
          background: "#FFF4E1",
        }}
      >
        {/* Centered logo and title */}
        <div className="flex items-center gap-3">
          {/* Camel icon - bigger */}
          <div className="w-14 h-14 flex-shrink-0">
            <img
              src="https://sih-widget.vercel.app/chatbot-icon.webp"
              alt="CampusSetu"
              className="w-full h-full object-contain"
            />
          </div>

          {/* Title and subtitle */}
          <div className="flex flex-col">
            <h2 className="font-bold text-lg text-[#004aad] leading-tight">
              CampusSetu
            </h2>
            <p className="text-sm text-gray-700 leading-tight">
              Rajasthan Education Assistant
            </p>
          </div>
        </div>

        {/* Fullscreen toggle button - positioned absolutely on right */}
        <div className="absolute right-4 flex items-center gap-2">
          {onToggleFullscreen && (
            <button
              onClick={onToggleFullscreen}
              className="p-1.5 hover:bg-gray-200/50 rounded-full transition-colors"
              aria-label={isFullscreen ? "Exit fullscreen" : "Expand"}
            >
              {isFullscreen ? (
                <Minimize className="h-4 w-4 text-gray-700" />
              ) : (
                <SquareArrowOutUpRight className="h-4 w-4 text-gray-700" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Separator line */}
      <div className="h-[2px] bg-gradient-to-r from-transparent via-[#004aad] to-transparent shadow-sm" />
    </>
  );
}
