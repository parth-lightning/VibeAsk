import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader } from "@/components/ui/loader";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/types";
import { User, Search, Mic, Globe, TicketCheck } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Sources, type Source } from "./Sources";

interface MessageBubbleProps {
  message: ChatMessage;
  isFullscreen?: boolean;
}

export function MessageBubble({
  message,
  isFullscreen = false,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isVoice = message.isVoice || false;

  // Check if message has parts (UIMessage format) or just content (ChatMessage format)
  const hasParts = "parts" in message && Array.isArray(message.parts);

  // Extract web sources from webSearch tool output for rendering
  const webSources: Source[] = hasParts
    ? (message as any).parts
        .filter(
          (part: any) =>
            part.type === "tool-webSearch" && part.state === "output-available"
        )
        .flatMap(
          (part: any) =>
            part.output?.sources?.map((s: any) => ({
              title: s.title || "Untitled",
              url: s.url,
            })) || []
        )
    : [];

  return (
    <div
      className={cn(
        "flex gap-3 animate-fade-in",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <Avatar className="h-8 w-8 flex-shrink-0">
        {isUser ? (
          <AvatarFallback className="bg-[#2563eb]">
            <User className="h-4 w-4 text-white" />
          </AvatarFallback>
        ) : (
          <div className="w-full h-full border border-gray-200 rounded-full">
            <img
              src="https://sih-widget.vercel.app/chatbot-avatar.webp"
              alt="CampusSetu"
              className="object-contain"
            />
          </div>
        )}
      </Avatar>

      <div
        className={cn(
          "rounded-2xl px-4 py-2 space-y-2 shadow-sm",
          isFullscreen ? "max-w-[70%]" : "max-w-[80%]",
          isUser ? "bg-[#2563eb] text-white" : "bg-white text-gray-800"
        )}
        style={{ overflowWrap: "break-word", wordBreak: "break-word" }}
      >
        {/* Voice indicator badge */}
        {isVoice && (
          <div className="flex items-center gap-1 mb-1 opacity-70">
            <Mic className="h-3 w-3" />
            <span className="text-xs">Voice message</span>
          </div>
        )}

        {/* Render simple content for ChatMessage (voice transcripts) */}
        {!hasParts && message.content && (
          <div className="text-sm prose prose-sm max-w-none dark:prose-invert prose-p:leading-relaxed">
            <p className="mb-0 whitespace-pre-wrap break-words">
              {message.content}
            </p>
          </div>
        )}

        {/* Render parts for UIMessage (text chat from Vercel AI SDK) */}
        {hasParts &&
          (message as any).parts.map((part: any, index: number) => {
            switch (part.type) {
              case "text":
                return (
                  <div
                    key={index}
                    className="text-sm prose prose-sm max-w-none dark:prose-invert prose-p:leading-relaxed prose-pre:p-0"
                  >
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw]}
                      components={{
                        // Custom styling for markdown elements
                        p: ({ children }) => (
                          <p className="mb-2 last:mb-0 whitespace-pre-wrap break-words">
                            {children}
                          </p>
                        ),
                        ul: ({ children }) => (
                          <ul className="list-disc list-inside mb-2 space-y-1">
                            {children}
                          </ul>
                        ),
                        ol: ({ children }) => (
                          <ol className="list-decimal list-inside mb-2 space-y-1">
                            {children}
                          </ol>
                        ),
                        li: ({ children }) => (
                          <li className="ml-2">{children}</li>
                        ),
                        code: ({ inline, children, ...props }: any) =>
                          inline ? (
                            <code
                              className="bg-muted/50 px-1 py-0.5 rounded text-xs font-mono"
                              {...props}
                            >
                              {children}
                            </code>
                          ) : (
                            <code
                              className="block bg-muted/50 p-2 rounded text-xs font-mono overflow-x-auto"
                              {...props}
                            >
                              {children}
                            </code>
                          ),
                        pre: ({ children }) => (
                          <pre className="mb-2 overflow-x-auto">{children}</pre>
                        ),
                        a: ({ children, href }) => (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline hover:text-primary/80 break-all"
                            style={{ overflowWrap: "anywhere" }}
                          >
                            {children}
                          </a>
                        ),
                        strong: ({ children }) => (
                          <strong className="font-bold">{children}</strong>
                        ),
                        em: ({ children }) => (
                          <em className="italic">{children}</em>
                        ),
                        blockquote: ({ children }) => (
                          <blockquote className="border-l-2 border-muted-foreground/20 pl-4 italic my-2">
                            {children}
                          </blockquote>
                        ),
                        h1: ({ children }) => (
                          <h1 className="text-lg font-bold mb-2 mt-3 first:mt-0">
                            {children}
                          </h1>
                        ),
                        h2: ({ children }) => (
                          <h2 className="text-base font-bold mb-2 mt-3 first:mt-0">
                            {children}
                          </h2>
                        ),
                        h3: ({ children }) => (
                          <h3 className="text-sm font-bold mb-1 mt-2 first:mt-0">
                            {children}
                          </h3>
                        ),
                        table: ({ children }) => (
                          <div className="overflow-x-auto my-2">
                            <table className="min-w-full divide-y divide-border">
                              {children}
                            </table>
                          </div>
                        ),
                        th: ({ children }) => (
                          <th className="px-2 py-1 text-left text-xs font-semibold bg-muted/50">
                            {children}
                          </th>
                        ),
                        td: ({ children }) => (
                          <td className="px-2 py-1 text-xs border-t border-border">
                            {children}
                          </td>
                        ),
                      }}
                    >
                      {(part as any).text}
                    </ReactMarkdown>
                  </div>
                );

              // Handle our searchDocuments tool
              case "tool-searchDocuments": {
                const toolPart = part as any;
                const callId = toolPart.toolCallId;

                switch (toolPart.state) {
                  case "input-streaming":
                    return (
                      <div
                        key={callId}
                        className="flex items-center gap-2 text-xs opacity-70"
                      >
                        <Loader size="sm" />
                        <span>Preparing search...</span>
                      </div>
                    );

                  case "input-available":
                    return (
                      <div
                        key={callId}
                        className="flex items-center gap-2 text-xs opacity-70"
                      >
                        <Loader size="sm" />
                        <Search className="h-3 w-3" />
                        <span>
                          Searching documents for: "{toolPart.input.query}"
                        </span>
                      </div>
                    );

                  case "output-available":
                    // Don't show anything - the AI will use this in its response
                    return null;

                  case "output-error":
                    return (
                      <div
                        key={callId}
                        className="text-xs text-destructive opacity-70"
                      >
                        Error searching documents: {toolPart.errorText}
                      </div>
                    );
                }
                break;
              }

              // Handle webSearch tool for web search fallback
              case "tool-webSearch": {
                const toolPart = part as any;
                const callId = toolPart.toolCallId;

                switch (toolPart.state) {
                  case "input-streaming":
                    return (
                      <div
                        key={callId}
                        className="flex items-center gap-2 text-xs opacity-70"
                      >
                        <Loader size="sm" />
                        <Globe className="h-3 w-3" />
                        <span>Preparing web search...</span>
                      </div>
                    );

                  case "input-available":
                    return (
                      <div
                        key={callId}
                        className="flex items-center gap-2 text-xs opacity-70"
                      >
                        <Loader size="sm" />
                        <Globe className="h-3 w-3" />
                        <span>Searching the web...</span>
                      </div>
                    );

                  case "output-available":
                    // Sources are rendered separately at the end via webSources
                    return null;

                  case "output-error":
                    return (
                      <div
                        key={callId}
                        className="text-xs text-destructive opacity-70"
                      >
                        Web search failed: {toolPart.errorText}
                      </div>
                    );
                }
                break;
              }

              // Handle dynamic tools if any
              case "dynamic-tool": {
                const dynamicPart = part as any;
                const callId = dynamicPart.toolCallId;

                switch (dynamicPart.state) {
                  case "input-streaming":
                  case "input-available":
                    return (
                      <div
                        key={callId}
                        className="flex items-center gap-2 text-xs opacity-70"
                      >
                        <Loader size="sm" />
                        <span>Processing {dynamicPart.toolName}...</span>
                      </div>
                    );

                  case "output-available":
                    return null;

                  case "output-error":
                    return (
                      <div
                        key={callId}
                        className="text-xs text-destructive opacity-70"
                      >
                        Error: {dynamicPart.errorText}
                      </div>
                    );
                }
                break;
              }

              // Handle escalateToHuman tool - show ticket raised confirmation
              case "tool-escalateToHuman": {
                const toolPart = part as any;
                const callId = toolPart.toolCallId;

                switch (toolPart.state) {
                  case "input-streaming":
                  case "input-available":
                    return (
                      <div
                        key={callId}
                        className="flex items-center gap-2 text-xs opacity-70"
                      >
                        <Loader size="sm" />
                        <TicketCheck className="h-3 w-3" />
                        <span>Creating support ticket...</span>
                      </div>
                    );

                  case "output-available":
                    // Show the escalation confirmation
                    return (
                      <div
                        key={callId}
                        className="mt-3 pt-3 border-t border-border"
                      >
                        <div className="flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400">
                          <TicketCheck className="h-4 w-4" />
                          <span>Your ticket has been raised.</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          A college administrator will contact you soon.
                        </p>
                      </div>
                    );

                  case "output-error":
                    return (
                      <div
                        key={callId}
                        className="text-xs text-destructive opacity-70"
                      >
                        Failed to create ticket: {toolPart.errorText}
                      </div>
                    );
                }
                break;
              }

              default:
                return null;
            }
          })}

        {/* Render web sources at the end of the message */}
        {webSources.length > 0 && <Sources sources={webSources} />}
      </div>
    </div>
  );
}
