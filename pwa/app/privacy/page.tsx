export const metadata = { title: "Privacy Policy • Hassoun" };

const card = { background: "#fffdf8", border: "1px solid #e4ded3", borderRadius: 20, padding: 20, marginBottom: 14 } as const;

export default function PrivacyPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#f7f4ec", color: "#173f35", padding: "32px 16px 64px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <p style={{ color: "#0b7057", fontWeight: 800, letterSpacing: 1.5 }}>HASSOUN</p>
        <h1 style={{ fontSize: 38, margin: "8px 0" }}>Privacy Policy</h1>
        <p style={{ color: "#74817c", marginBottom: 24 }}>Effective August 17, 2026</p>
        <section style={card}><h2>Information Hassoun uses</h2><p>Depending on the features you choose, Hassoun may process location, push-notification tokens, prayer-email address and preferences, support-form contact details, Qur’an reading settings, bookmarks and memorization progress. Microphone access is requested only for recitation practice.</p></section>
        <section style={card}><h2>How information is used</h2><p>Information is used to provide prayer times and alerts, optional prayer-email reminders, Qur’an and memorization features, support, security and service reliability. Hassoun does not sell personal information and does not use personal information for third-party advertising.</p></section>
        <section style={card}><h2>Permissions</h2><p>Location is used to select local prayer times and time zone. Notifications and exact alarms support reminders and native Adhan. Microphone access is used only when you start recitation practice. Hassoun uses the device’s speech-recognition service for that feature and does not intentionally upload or store raw microphone recordings on its own server.</p></section>
        <section style={card}><h2>Service providers</h2><p>Hassoun may rely on infrastructure and platform providers including Cloudflare, Expo push services, Resend email delivery, Android speech recognition, and Qur’an/prayer-data providers. Only information needed for the selected feature is sent to those services.</p></section>
        <section style={card}><h2>Retention, deletion and choices</h2><p>Local settings remain until you change them, clear app data or uninstall. Prayer-email subscriptions remain until you unsubscribe. Support messages may be retained as needed to answer and document the request. You can revoke operating-system permissions at any time and can contact Hassoun for privacy or deletion requests.</p></section>
        <section style={card}><h2>No account required</h2><p>The core Hassoun app does not require account creation or sign-in. If account-based features are added later, this policy and the app’s deletion controls will be updated before release.</p></section>
        <p style={{ color: "#6f7b76" }}>Privacy choices and support are available inside Hassoun under Settings &amp; Support.</p>
      </div>
    </main>
  );
}
