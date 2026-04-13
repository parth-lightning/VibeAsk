import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FloatingButtonProps {
  onClick: () => void;
  unreadCount?: number;
  isOpen?: boolean;
}

export function FloatingButton({
  onClick,
  unreadCount = 0,
  isOpen = false,
}: FloatingButtonProps) {
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Button
        size="lg"
        className={cn(
          "h-14 w-14 rounded-full shadow-2xl",
          "bg-[#2563eb] text-white",
          "hover:scale-110 transition-all duration-200"
        )}
        onClick={onClick}
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <MessageCircle className="h-6 w-6" />
        )}
        {!isOpen && unreadCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-6 w-6 flex items-center justify-center p-0 text-xs"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </Badge>
        )}
        <span className="sr-only">{isOpen ? "Close chat" : "Open chat"}</span>
      </Button>
    </div>
  );
}
