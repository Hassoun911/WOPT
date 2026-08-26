"use client";

import { useEffect, useState } from "react";

const TOKEN_KEY = "wopt:admin-token:v1";

export default function PasswordResetLink() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const refresh = () => setShow(!window.localStorage.getItem(TOKEN_KEY));
    refresh();
    const timer = window.setInterval(refresh, 300);
    window.addEventListener("storage", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  if (!show) return null;

  return (
    <div
      style={{
        width: "min(620px, calc(100% - 36px))",
        margin: "14px auto 0",
        textAlign: "center",
        fontFamily: "system-ui,-apple-system,sans-serif"
      }}
    >
      <a
        href="/admin/reset/"
        style={{
          display: "inline-block",
          color: "#0b5b47",
          fontSize: 14,
          fontWeight: 800,
          textDecoration: "underline",
          textUnderlineOffset: 3,
          padding: "10px 12px"
        }}
      >
        Forgot password? Reset it here
      </a>
    </div>
  );
}
