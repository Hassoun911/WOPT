export const metadata = { title: "Privacy Choices • Hassoun" };

const card = { background: "#fffdf8", border: "1px solid #e4ded3", borderRadius: 20, padding: 20, marginBottom: 14 } as const;

export default function PrivacyChoicesPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#f7f4ec", color: "#173f35", padding: "32px 16px 64px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: 740, margin: "0 auto" }}>
        <p style={{ color: "#0b7057", fontWeight: 800, letterSpacing: 1.5 }}>HASSOUN</p>
        <h1 style={{ fontSize: 38, margin: "8px 0 22px" }}>Privacy Choices</h1>
        <section style={card}><h2>Device permissions</h2><p>You can change Location, Notifications and Microphone permissions at any time in your phone’s system settings. Core Qur’an reading remains usable without microphone access.</p></section>
        <section style={card}><h2>Prayer email alerts</h2><p>If you subscribed to prayer emails, use the secure management link sent by Hassoun to change alert choices or unsubscribe.</p></section>
        <section style={card}><h2>Local app data</h2><p>Qur’an preferences, bookmarks and memorization progress are primarily stored on your device. Clearing Hassoun app data or uninstalling removes local app data from that device.</p></section>
        <section style={card}><h2>Privacy or deletion request</h2><p>Open Hassoun and use Settings &amp; Support → Contact Us. Include the email address associated with the request so support can locate relevant email-subscription or support records.</p></section>
      </div>
    </main>
  );
}
