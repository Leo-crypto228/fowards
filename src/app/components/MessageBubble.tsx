import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AiMessage } from "../api/aiApi";
import { DiagnosticBadge } from "./DiagnosticBadge";
import mascot from "figma:asset/cd3b49eafdee7adc585eb4cea8cc18850443b810.png";

interface Props {
  message: AiMessage;
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div style={{
        display: "flex",
        justifyContent: "flex-end",
        marginBottom: 22,
      }}>
        <div style={{
          maxWidth: "78%",
          background: "rgba(255,255,255,0.07)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "22px 22px 6px 22px",
          padding: "12px 17px",
          color: "#fff",
          fontSize: 16,
          lineHeight: 1.45,
          whiteSpace: "pre-wrap" as const,
        }}>
          {message.content}
          {message.mode === "diagnostic" && (
            <div style={{ marginTop: 6 }}>
              <DiagnosticBadge mode="diagnostic" />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Assistant
  return (
    <div style={{
      display: "flex",
      justifyContent: "flex-start",
      marginBottom: 22,
      gap: 11,
    }}>
      {/* Avatar — mascot 34px */}
      <img
        src={mascot}
        alt=""
        style={{
          width: 34,
          height: "auto",
          flexShrink: 0,
          marginTop: 2,
          filter: "drop-shadow(0 0 6px rgba(160,100,255,0.5))",
        }}
      />

      {/* Texte */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {message.mode === "diagnostic" && (
          <div style={{ marginBottom: 6 }}>
            <DiagnosticBadge mode="diagnostic" />
          </div>
        )}
        <div className="ai-markdown" style={{
          color: "rgba(240,240,250,0.92)",
          fontSize: 16,
          lineHeight: 1.55,
        }}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              hr: () => (
                <hr style={{
                  border: "none",
                  borderTop: "0.5px solid rgba(255,255,255,0.12)",
                  margin: "16px 0",
                }} />
              ),
              p: ({ children }) => (
                <p style={{ margin: "6px 0" }}>{children}</p>
              ),
              pre: ({ children }) => (
                <pre style={{
                  margin: "10px 0",
                  padding: "12px 14px",
                  borderRadius: 14,
                  background: "rgba(12,14,22,0.85)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#cfe3ff",
                  fontFamily: "monospace",
                  fontSize: 13.5,
                  overflowX: "auto",
                }}>
                  {children}
                </pre>
              ),
              code: ({ children, className }) => {
                const isBlock = className?.startsWith("language-");
                if (isBlock) return <code style={{ fontFamily: "monospace" }}>{children}</code>;
                return (
                  <code style={{
                    background: "rgba(12,14,22,0.7)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 5,
                    padding: "1px 5px",
                    fontSize: "0.88em",
                    color: "#cfe3ff",
                    fontFamily: "monospace",
                  }}>
                    {children}
                  </code>
                );
              },
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
