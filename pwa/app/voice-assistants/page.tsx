"use client";

import { useState } from "react";

const assistantCards = [
  {
    id: "alexa",
    icon: "🔵",
    title: "Amazon Alexa",
    subtitle: "Ask Hassoun for prayer times, countdowns and Islamic dates.",
    examples: [
      "Alexa, ask Hassoun when Maghrib is.",
      "Alexa, ask Hassoun how long until Isha.",
      "Alexa, ask Hassoun what the next Islamic holiday is."
    ]
  },
  {
    id: "google",
    icon: "🟢",
    title: "Google Home",
    subtitle: "Use Hassoun prayer information with your Google Home devices and automations.",
    examples: [
      "Hey Google, ask Hassoun when Maghrib is.",
      "Hey Google, ask Hassoun what the next prayer is.",
      "Hey Google, ask Hassoun what the next Islamic holiday is."
    ]
  }
] as const;

export default function VoiceAssistantsPage() {
  const [selected, setSelected] = useState<"alexa" | "google" | null>(null);

  return (
    <main style={{ minHeight: "100dvh", background: "#f7f4ec", color: "#17362e", padding: "24px 18px 60px" }}>
      <div style={{ width: "min(980px, 100%)", margin: "0 auto" }}>
        <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#0b5b47", fontWeight: 800, marginBottom: 24 }}>← Hassoun</a>

        <section style={{ borderRadius: 28, padding: "28px 26px", background: "linear-gradient(135deg,#074436,#0b5b47)", color: "white", boxShadow: "0 22px 60px rgba(7,68,54,.18)" }}>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: ".14em", color: "#bfe4d7" }}>HASSOUN SMART HOME</div>
          <h1 style={{ margin: "10px 0 10px", fontSize: "clamp(34px,6vw,58px)", lineHeight: 1 }}>Voice Assistants</h1>
          <p style={{ margin: 0, maxWidth: 700, color: "#d9eee7", lineHeight: 1.6 }}>Connect Hassoun with Alexa or Google Home so your household can ask about salah times, countdowns, Hijri dates and Islamic events, and later use prayer events in smart-home automations.</p>
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16, marginTop: 22 }}>
          {assistantCards.map((assistant) => (
            <section key={assistant.id} style={{ border: "1px solid #d8e1dc", borderRadius: 24, background: "#fffdf8", padding: 22, boxShadow: "0 10px 30px rgba(17,65,52,.05)" }}>
              <div style={{ width: 48, height: 48, borderRadius: 16, background: "#edf5f1", display: "grid", placeItems: "center", fontSize: 24 }}>{assistant.icon}</div>
              <h2 style={{ margin: "16px 0 7px", fontSize: 24 }}>{assistant.title}</h2>
              <p style={{ margin: 0, color: "#62756e", lineHeight: 1.55 }}>{assistant.subtitle}</p>
              <div style={{ marginTop: 18, display: "grid", gap: 8 }}>
                {assistant.examples.map((example) => <div key={example} style={{ padding: "10px 12px", borderRadius: 12, background: "#f3f7f5", fontSize: 13 }}>{example}</div>)}
              </div>
              <button onClick={() => setSelected(assistant.id)} style={{ width: "100%", marginTop: 18, minHeight: 44, border: 0, borderRadius: 13, background: "#0b5b47", color: "#fff", fontWeight: 850, cursor: "pointer" }}>Connect to {assistant.id === "alexa" ? "Alexa" : "Google Home"}</button>
            </section>
          ))}
        </div>

        <section style={{ marginTop: 18, border: "1px solid #e2d2a7", borderRadius: 22, background: "#fff9e8", padding: 20 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Smart Adhan automations</h2>
          <p style={{ margin: "8px 0 0", color: "#6f654e", lineHeight: 1.55 }}>The connection is designed to support automations such as muting a compatible TV when Adhan begins, lowering speaker volume, changing lights, announcing the prayer, and restoring the previous state afterward.</p>
        </section>

        {selected && (
          <section style={{ marginTop: 18, border: "1px solid #b8d3c8", borderRadius: 22, background: "#edf5f1", padding: 20 }}>
            <strong style={{ display: "block", fontSize: 18 }}>Connect to {selected === "alexa" ? "Alexa" : "Google Home"}</strong>
            <p style={{ color: "#526c63", lineHeight: 1.55, marginBottom: 0 }}>The Hassoun connection screen is ready. Account linking will become active when the corresponding Alexa Skill / Google Home integration is published and its production credentials are connected to Hassoun. Until then, this page safely keeps the setup entry point in place without pretending a device is linked.</p>
          </section>
        )}

        <section style={{ marginTop: 22, borderTop: "1px solid #d8e1dc", paddingTop: 20, color: "#65756f", fontSize: 13, lineHeight: 1.6 }}>
          Hassoun will use the same prayer-time and Islamic-event data as the app so voice answers stay consistent with the web and mobile versions.
        </section>
      </div>
    </main>
  );
}
