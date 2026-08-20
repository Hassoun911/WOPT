"use client";

import { useEffect, useState } from "react";

const TOKEN_KEY = "wopt:admin-token:v1";

export default function PasswordResetLink() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(!window.localStorage.getItem(TOKEN_KEY));
  }, []);

  if (!show) return null;

  return (
    <a
      href="/admin/reset/"
      style={{
        position: "fixed",
        left: "50%",
        top: "calc(50% + 215px)",
        transform: "translateX(-50%)",
        zIndex: 10001,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 34,
        padding: "6px 14px",
        borderRadius: 10,
        background: "#ffffff",
        border: "1px solid #cbd8d3",
        boxShadow: "0 4px 14px rgba(0,0,0,0.08)",
        color: "#0b5b47",
        fontFamily: "system-ui,-apple-system,sans-serif",
        fontSize: 13,
        lineHeight: 1.2,
        fontWeight: 800,
        textDecoration: "none",
        whiteSpace: "nowrap"
      }}
    >
      Forgot password? Reset it here
    </a>
  );
}
