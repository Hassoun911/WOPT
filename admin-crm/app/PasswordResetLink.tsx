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
        top: "calc(50% + 190px)",
        transform: "translateX(-50%)",
        zIndex: 10001,
        color: "#0b5b47",
        fontFamily: "system-ui,-apple-system,sans-serif",
        fontSize: 13,
        fontWeight: 800,
        textDecoration: "underline",
        textUnderlineOffset: 3
      }}
    >
      Forgot password? Reset it here
    </a>
  );
}
