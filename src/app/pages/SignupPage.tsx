import { useEffect } from "react";
import { useNavigate } from "react-router";

/** /signup redirects to /login which now embeds the signup panel */
export function SignupPage() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/login", { replace: true });
  }, [navigate]);
  return null;
}