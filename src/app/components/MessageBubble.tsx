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
        marginBottom: 14,
      }}>
        <div style={{
          maxWidth: "78%",
          background: "rgba(255,255,255,0.09)",
          borderRadius: "18px 18px 4px 18px",
          padding: "10px 14px",
          color: "rgba(235,235,245,0.9)",
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

  // Assistant — pas de bulle, texte direct sur le fond
  return (
    <div style={{
      display: "flex",
      justifyContent: "flex-start",
      marginBottom: 16,
      gap: 10,
    }}>
      {/* Avatar IA */}
      <div style={{
        width: 28,
        height: 28,
        borderRadius: "50%",
        background: "rgba(255,255,255,0.06)",
        border: "0.5px solid rgba(255,255,255,0.12)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        marginTop: 3,
        fontSize: 11,
        color: "rgba(235,235,245,0.5)",
        fontWeight: 700,
        letterSpacing: "0.02em",
      }}>
        IA
      </div>

      {/* Texte sans encadré — pleine largeur */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {message.mode === "diagnostic" && (
          <div style={{ marginBottom: 6 }}>
            <DiagnosticBadge mode="diagnostic" />
          </div>
        )}
        <div className="ai-markdown" style={{
          color: "rgba(235,235,245,0.88)",
          fontSize: 15,
          lineHeight: 1.65,
        }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
