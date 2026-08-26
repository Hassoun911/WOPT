"use client";

import { useEffect } from "react";

const TOKEN_KEY = "wopt:admin-token:v1";
const LINK_ID = "hassoun-admin-forgot-password-link";

export default function PasswordResetLink() {
  useEffect(() => {
    const sync = () => {
      const signedIn = Boolean(window.localStorage.getItem(TOKEN_KEY));
      const existing = document.getElementById(LINK_ID);
      if (signedIn) {
        existing?.remove();
        return;
      }

      const form = document.querySelector<HTMLFormElement>('main form');
      if (!form || existing) return;

      const link = document.createElement('a');
      link.id = LINK_ID;
      link.href = '/admin/reset/';
      link.textContent = 'Forgot password? Reset it here';
      link.style.display = 'block';
      link.style.textAlign = 'center';
      link.style.color = '#0b5b47';
      link.style.fontSize = '14px';
      link.style.fontWeight = '800';
      link.style.textDecoration = 'underline';
      link.style.textUnderlineOffset = '3px';
      link.style.padding = '2px 8px 6px';
      link.style.marginTop = '-2px';

      const submit = form.querySelector<HTMLButtonElement>('button[type="submit"], button');
      if (submit) form.insertBefore(link, submit);
      else form.appendChild(link);
    };

    sync();
    const timer = window.setInterval(sync, 300);
    window.addEventListener('storage', sync);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('storage', sync);
      document.getElementById(LINK_ID)?.remove();
    };
  }, []);

  return null;
}
