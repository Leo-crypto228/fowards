import { useEffect, useState } from "react";
import { Navigate } from "react-router";
import { supabase } from "../api/supabaseClient";

const ADMIN_UUID = "8d6efce7-fae0-4d37-b9b5-72cf5de13b13";

interface AdminGuardProps {
  children: React.ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
  const [status, setStatus] = useState<"loading" | "authorized" | "unauthorized">("loading");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id === ADMIN_UUID) {
        setStatus("authorized");
      } else {
        setStatus("unauthorized");
      }
    }).catch(() => {
      setStatus("unauthorized");
    });
  }, []);

  if (status === "loading") {
    return (
      <div
        style={{
          minHeight: "100dvh",
          background: "#000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "3px solid rgba(99,102,241,0.20)",
            borderTopColor: "#6366f1",
            animation: "spin 0.8s linear infinite",
          }}
        />
      </div>
    );
  }

  if (status === "unauthorized") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}