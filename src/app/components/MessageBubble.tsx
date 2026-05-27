import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AiMessage } from "../api/aiApi";
import { DiagnosticBadge } from "./DiagnosticBadge";

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
        marginBottom: 12,
      }}>
        <div style={{
          maxWidth: "80%",
          background: "#4f46e5",
          borderRadius: "18px 18px 4px 18px",
          padding: "10px 14px",
          color: "#fff",
          fontSize: 15,
          lineHeight: 1.5,
        }}>
          <p style={{ margin: 0 }}>{message.content}</p>
          {message.mode === "diagnostic" && (
            <div style={{ marginTop: 6 }}>
              <DiagnosticBadge mode="diagnostic" />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Assistant bubble
  return (
    <div style={{
      display: "flex",
      justifyContent: "flex-start",
      marginBottom: 12,
      gap: 8,
    }}>
      {/* Avatar IA */}
      <div style={{
        width: 32,
        height: 32,
        borderRadius: "50%",
        background: "rgba(255,255,255,0.08)",
        border: "0.5px solid rgba(255,255,255,0.15)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        marginTop: 2,
        fontSize: 13,
        color: "rgba(235,235,245,0.7)",
        fontWeight: 700,
      }}>
        IA
      </div>

      <div style={{ maxWidth: "84%", minWidth: 0 }}>
        {message.mode === "diagnostic" && (
          <div style={{ marginBottom: 6 }}>
            <DiagnosticBadge mode="diagnostic" />
          </div>
        )}
        <div style={{
          background: "rgba(255,255,255,0.05)",
          borderRadius: "4px 18px 18px 18px",
          padding: "10px 14px",
          border: "0.5px solid rgba(255,255,255,0.08)",
        }}>
          <div className="ai-markdown" style={{
            color: "rgba(235,235,245,0.92)",
            fontSize: 15,
            lineHeight: 1.6,
          }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
