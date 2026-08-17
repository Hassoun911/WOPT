export const metadata = { title: "Support • Hassoun" };

export default function SupportPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#f7f4ec", color: "#173f35", padding: "32px 16px 64px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <p style={{ color: "#0b7057", fontWeight: 800, letterSpacing: 1.5 }}>HASSOUN SUPPORT</p>
        <h1 style={{ fontSize: 38, margin: "8px 0" }}>How can we help?</h1>
        <p style={{ color: "#74817c", fontSize: 17, lineHeight: 1.6 }}>For prayer-time questions, Qur’an reader issues, Adhan/notification help, privacy requests or feature feedback, open Hassoun and go to <strong>More → Settings &amp; Support → Contact Us</strong>.</p>
        <div style={{ marginTop: 24, background: "#fffdf8", border: "1px solid #e4ded3", borderRadius: 22, padding: 22 }}>
          <h2 style={{ marginTop: 0 }}>Before contacting support</h2>
          <p>Include the app version, device model, Android/iOS version, and a screenshot when possible. For notification or Adhan issues, tell us the prayer and the exact behavior you saw.</p>
        </div>
        <div style={{ marginTop: 14, background: "#eaf5f0", borderRadius: 22, padding: 22 }}>
          <h2 style={{ marginTop: 0 }}>Privacy requests</h2>
          <p>Use the in-app Contact Us form and choose a privacy-related subject. Prayer-email subscribers can also manage or unsubscribe through the secure email-management flow.</p>
        </div>
      </div>
    </main>
  );
}
