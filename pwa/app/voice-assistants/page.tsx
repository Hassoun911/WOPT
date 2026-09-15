"use client";

import { useState } from "react";

const assistantCards = [
  {
    id: "alexa",
    icon: "🔵",
    title: "Amazon Alexa",
    status: "LIVE IN DEVELOPMENT / TESTING",
    statusTone: "#0b7a5b",
    subtitle: "The Hassoun Alexa skill is working for prayer-time questions, countdowns, Hijri dates, Islamic events, Echo Show visuals and requested prayer reminders.",
    examples: [
      "Alexa, open Hassoun.",
      "Alexa, ask Hassoun when Maghrib is.",
      "Alexa, ask Hassoun how long until Isha."
    ]
  },
  {
    id: "google",
    icon: "🟢",
    title: "Google Home",
    status: "COMING LATER",
    statusTone: "#8a6b24",
    subtitle: "Google Home is planned, but a production Google Home integration is not connected yet.",
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
          <p style={{ margin: 0, maxWidth: 760, color: "#d9eee7", lineHeight: 1.6 }}>Alexa is already working in Hassoun development/testing. This page now shows what is live today and what still needs Amazon or Google production setup, instead of blocking everything behind a generic “not live” message.</p>
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16, marginTop: 22 }}>
          {assistantCards.map((assistant) => (
            <section key={assistant.id} style={{ border: "1px solid #d8e1dc", borderRadius: 24, background: "#fffdf8", padding: 22, boxShadow: "0 10px 30px rgba(17,65,52,.05)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: 16, background: "#edf5f1", display: "grid", placeItems: "center", fontSize: 24 }}>{assistant.icon}</div>
                <span style={{ borderRadius: 999, padding: "7px 10px", background: `${assistant.statusTone}14`, color: assistant.statusTone, fontSize: 11, fontWeight: 900, letterSpacing: ".06em" }}>{assistant.status}</span>
              </div>
              <h2 style={{ margin: "16px 0 7px", fontSize: 24 }}>{assistant.title}</h2>
              <p style={{ margin: 0, color: "#62756e", lineHeight: 1.55 }}>{assistant.subtitle}</p>
              <div style={{ marginTop: 18, display: "grid", gap: 8 }}>
                {assistant.examples.map((example) => <div key={example} style={{ padding: "10px 12px", borderRadius: 12, background: "#f3f7f5", fontSize: 13 }}>{example}</div>)}
              </div>
              <button type="button" onClick={() => setSelected(assistant.id)} style={{ width: "100%", marginTop: 18, minHeight: 44, border: 0, borderRadius: 13, background: "#0b5b47", color: "#fff", fontWeight: 850, cursor: "pointer" }}>
                {assistant.id === "alexa" ? "Alexa setup & status" : "Google Home status"}
              </button>
            </section>
          ))}
        </div>

        <section style={{ marginTop: 18, border: "1px solid #cfe0d9", borderRadius: 22, background: "#edf5f1", padding: 20 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>What is live on Alexa now</h2>
          <p style={{ margin: "8px 0 0", color: "#526c63", lineHeight: 1.6 }}>Voice Q&amp;A, Echo Show prayer dashboard, next-prayer countdown, Hijri date, Islamic-event answers, the Next Prayer widget package and user-requested next-prayer reminders are built. Account linking is not required for those core development-skill features.</p>
          <p style={{ margin: "10px 0 0", color: "#526c63", lineHeight: 1.6 }}><strong>Location note:</strong> Alexa requests that do not yet carry a Hassoun profile/location continue to use the legacy Windsor default. Per-device Hassoun profiles and account-linked locations are the next connection layer.</p>
        </section>

        <section style={{ marginTop: 18, border: "1px solid #e2d2a7", borderRadius: 22, background: "#fff9e8", padding: 20 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Smart Adhan automations</h2>
          <p style={{ margin: "8px 0 0", color: "#6f654e", lineHeight: 1.55 }}>TV muting, speaker-volume changes, lights and automatic state restoration are not live yet. Those require an approved Alexa smart-home/routine capability and should remain separate from the working prayer voice skill.</p>
        </section>

        <section style={{ marginTop: 22, borderTop: "1px solid #d8e1dc", paddingTop: 20, color: "#65756f", fontSize: 13, lineHeight: 1.6 }}>
          Hassoun uses the same prayer backend as the app. Where a trusted local profile is available it can override calculated times; otherwise the global system can calculate by location. Alexa still needs the account/device-location layer to select those profiles automatically per Echo device.
        </section>
      </div>

      {selected && (
        <div role="dialog" aria-modal="true" aria-label={`${selectedName} status`} onClick={() => setSelected(null)} style={{ position: "fixed", inset: 0, zIndex: 5000, display: "grid", placeItems: "center", padding: 18, background: "rgba(5,27,21,.58)", backdropFilter: "blur(6px)" }}>
          <section onClick={(event) => event.stopPropagation()} style={{ width: "min(560px,100%)", maxHeight: "min(720px,88dvh)", overflowY: "auto", borderRadius: 26, background: "#fffdf8", border: "1px solid #d5e1dc", boxShadow: "0 28px 80px rgba(5,36,27,.28)", padding: 24 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: "#0b5b47", fontWeight: 900, letterSpacing: ".12em" }}>HASSOUN SMART HOME</div>
                <h2 style={{ margin: "7px 0 0", fontSize: 28 }}>{selectedName}</h2>
              </div>
              <button type="button" onClick={() => setSelected(null)} aria-label="Close" style={{ width: 40, height: 40, borderRadius: 20, border: "1px solid #d8e1dc", background: "white", color: "#17362e", fontSize: 24, cursor: "pointer" }}>×</button>
            </div>

            {selected === "alexa" ? (
              <>
                <div style={{ marginTop: 20, padding: 16, borderRadius: 18, background: "#eaf7f1", border: "1px solid #bfe0d2" }}>
                  <strong style={{ display: "block", fontSize: 16, color: "#0b6b50" }}>Alexa is working in development/testing</strong>
                  <p style={{ margin: "7px 0 0", color: "#526c63", lineHeight: 1.55 }}>The Hassoun skill can answer prayer questions and render the Echo Show experience now. The remaining production work is Amazon certification/publication plus optional account linking for Hassoun profiles and per-device locations.</p>
                </div>
                <h3 style={{ margin: "22px 0 10px", fontSize: 18 }}>Use it now on the development Alexa account</h3>
                <div style={{ display: "grid", gap: 10 }}>
                  {["Make sure the Echo is signed into the Alexa account that has the Hassoun development skill enabled", "Say “Alexa, open Hassoun”", "Try “Alexa, ask Hassoun when Maghrib is” or “how long until Isha”", "Grant Reminders permission if you ask Hassoun to create next-prayer reminders"].map((step, index) => (
                    <div key={step} style={{ display: "grid", gridTemplateColumns: "34px 1fr", gap: 10, alignItems: "start", padding: "11px 12px", borderRadius: 14, background: "#f5f7f5" }}>
                      <span style={{ width: 30, height: 30, borderRadius: 15, display: "grid", placeItems: "center", background: "#0b5b47", color: "white", fontWeight: 900 }}>{index + 1}</span>
                      <span style={{ color: "#35584e", lineHeight: 1.45 }}>{step}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 16, padding: 14, borderRadius: 14, background: "#fff7df", border: "1px solid #e2d2a7", color: "#6f654e", lineHeight: 1.55 }}>
                  <strong>Not finished yet:</strong> Hassoun account linking, saved-profile selection and assigning a different Hassoun location to each Echo device. Those are separate from the voice skill that already works.
                </div>
              </>
            ) : (
              <div style={{ marginTop: 20, padding: 16, borderRadius: 18, background: "#fff7df", border: "1px solid #e2d2a7" }}>
                <strong style={{ display: "block", fontSize: 16, color: "#715b22" }}>Google Home is not connected yet</strong>
                <p style={{ margin: "7px 0 0", color: "#6f654e", lineHeight: 1.55 }}>The current production work is focused on Alexa. Google Home needs its own integration, credentials and publication flow before Hassoun can offer a real connection button.</p>
              </div>
            )}

            <button type="button" onClick={() => setSelected(null)} style={{ width: "100%", marginTop: 22, minHeight: 46, border: 0, borderRadius: 13, background: "#0b5b47", color: "white", fontWeight: 900, cursor: "pointer" }}>Done</button>
          </section>
        </div>
      )}
    </main>
  );
}
