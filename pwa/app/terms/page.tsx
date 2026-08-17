export const metadata = { title: "Terms of Use • Hassoun" };

const card = { background: "#fffdf8", border: "1px solid #e4ded3", borderRadius: 20, padding: 20, marginBottom: 14 } as const;

export default function TermsPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#f7f4ec", color: "#173f35", padding: "32px 16px 64px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <p style={{ color: "#0b7057", fontWeight: 800, letterSpacing: 1.5 }}>HASSOUN</p>
        <h1 style={{ fontSize: 38, margin: "8px 0" }}>Terms of Use</h1>
        <p style={{ color: "#74817c", marginBottom: 24 }}>Effective August 17, 2026</p>
        <section style={card}><h2>Using Hassoun</h2><p>Hassoun is provided for personal religious, educational and informational use. Use the app lawfully and do not attempt to disrupt, misuse or interfere with its services.</p></section>
        <section style={card}><h2>Prayer times and Hijri dates</h2><p>Prayer times and Hijri dates can vary by mosque, calculation convention, local observation or authority. Hassoun identifies its source where practical. When a difference matters, follow your trusted local mosque or religious authority.</p></section>
        <section style={card}><h2>Qur’an content and audio</h2><p>Hassoun is designed to preserve verified Qur’anic text and to separate Qur’an from translations, transliterations and learning tools. Network audio and external data sources can occasionally be unavailable or change.</p></section>
        <section style={card}><h2>Availability and changes</h2><p>Features, services and data sources may be improved, replaced or discontinued. Hassoun may update these terms when needed. Material legal or privacy changes will be reflected in the published pages.</p></section>
        <section style={card}><h2>Support</h2><p>Questions, bug reports, privacy requests and feature suggestions can be submitted from the Contact Us form inside Hassoun.</p></section>
      </div>
    </main>
  );
}
