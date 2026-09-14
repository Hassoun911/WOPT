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

type AssistantId = "alexa" | "google";

export default function VoiceAssistantsPage() {
  const [selected, setSelected] = useState<AssistantId | null>(null);

  const selectedName = selected === "alexa" ? "Amazon Alexa" : "Google Home";

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
              <button
                type="button"
                onClick={() => setSelected(assistant.id)}
                style={{ width: "100%", marginTop: 18, minHeight: 44, border: 0, borderRadius: 13, background: "#0b5b47", color: "#fff", fontWeight: 850, cursor: "pointer" }}
              >
                Set up {assistant.id === "alexa" ? "Alexa" : "Google Home"}
              </button>
            </section>
          ))}
        </div>

        <section style={{ marginTop: 18, border: "1px solid #e2d2a7", borderRadius: 22, background: "#fff9e8", padding: 20 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Smart Adhan automations</h2>
          <p style={{ margin: "8px 0 0", color: "#6f654e", lineHeight: 1.55 }}>The connection is designed to support automations such as muting a compatible TV when Adhan begins, lowering speaker volume, changing lights, announcing the prayer, and restoring the previous state afterward.</p>
        </section>

        <section style={{ marginTop: 22, borderTop: "1px solid #d8e1dc", paddingTop: 20, color: "#65756f", fontSize: 13, lineHeight: 1.6 }}>
          Hassoun will use the same prayer-time and Islamic-event data as the app so voice answers stay consistent with the web and mobile versions.
        </section>
      </div>

      {selected && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Set up ${selectedName}`}
          onClick={() => setSelected(null)}
          style={{ position: "fixed", inset: 0, zIndex: 5000, display: "grid", placeItems: "center", padding: 18, background: "rgba(5,27,21,.58)", backdropFilter: "blur(6px)" }}
        >
          <section
            onClick={(event) => event.stopPropagation()}
            style={{ width: "min(560px,100%)", maxHeight: "min(680px,88dvh)", overflowY: "auto", borderRadius: 26, background: "#fffdf8", border: "1px solid #d5e1dc", boxShadow: "0 28px 80px rgba(5,36,27,.28)", padding: 24 }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: "#0b5b47", fontWeight: 900, letterSpacing: ".12em" }}>HASSOUN SMART HOME</div>
                <h2 style={{ margin: "7px 0 0", fontSize: 28 }}>Set up {selectedName}</h2>
              </div>
              <button type="button" onClick={() => setSelected(null)} aria-label="Close setup" style={{ width: 40, height: 40, borderRadius: 20, border: "1px solid #d8e1dc", background: "white", color: "#17362e", fontSize: 24, cursor: "pointer" }}>×</button>
            </div>

            <div style={{ marginTop: 20, padding: 16, borderRadius: 18, background: "#edf5f1", border: "1px solid #cfe0d9" }}>
              <strong style={{ display: "block", fontSize: 16, color: "#0b5b47" }}>Connection is not live yet</strong>
              <p style={{ margin: "7px 0 0", color: "#526c63", lineHeight: 1.55 }}>The Hassoun setup screen is ready, but the actual account connection cannot start until the {selected === "alexa" ? "Hassoun Alexa Skill" : "Hassoun Google Home integration"} is published and its production credentials are connected to Hassoun.</p>
            </div>

            <h3 style={{ margin: "22px 0 10px", fontSize: 18 }}>When enabled, setup will be:</h3>
            <div style={{ display: "grid", gap: 10 }}>
              {["Sign in or authorize your voice-assistant account", "Choose the Hassoun prayer-time location/profile", "Enable prayer-time and Islamic-event voice questions", "Optionally enable Smart Adhan automations for compatible TVs, speakers and lights"].map((step, index) => (
                <div key={step} style={{ display: "grid", gridTemplateColumns: "34px 1fr", gap: 10, alignItems: "start", padding: "11px 12px", borderRadius: 14, background: "#f5f7f5" }}>
                  <span style={{ width: 30, height: 30, borderRadius: 15, display: "grid", placeItems: "center", background: "#0b5b47", color: "white", fontWeight: 900 }}>{index + 1}</span>
                  <span style={{ color: "#35584e", lineHeight: 1.45 }}>{step}</span>
                </div>
              ))}
            </div>

            <button type="button" onClick={() => setSelected(null)} style={{ width: "100%", marginTop: 22, minHeight: 46, border: 0, borderRadius: 13, background: "#0b5b47", color: "white", fontWeight: 900, cursor: "pointer" }}>Got it</button>
          </section>
        </div>
      )}
    </main>
  );
}
