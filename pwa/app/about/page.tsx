export const metadata = { title: "About • Hassoun" };

export default function AboutPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#f7f4ec", color: "#173f35", padding: "32px 16px 64px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ background: "#0b654f", color: "white", borderRadius: 28, padding: 30, textAlign: "center" }}>
          <div style={{ fontSize: 48, color: "#f2cc72" }}>☪</div>
          <h1 style={{ fontSize: 42, margin: "6px 0" }}>Hassoun</h1>
          <p style={{ color: "#c8e1d8", fontWeight: 700 }}>Prayer • Qur’an • Knowledge</p>
        </div>
        <div style={{ marginTop: 18, background: "#fffdf8", border: "1px solid #e4ded3", borderRadius: 22, padding: 22 }}>
          <h2>Our purpose</h2>
          <p style={{ lineHeight: 1.7 }}>Hassoun brings prayer times, Adhan, Qur’an reading and listening, memorization tools and Islamic learning into one calm, easy-to-use experience.</p>
          <h2>Prayer-time source</h2>
          <p style={{ lineHeight: 1.7 }}>For Windsor, Ontario, Hassoun uses the official Windsor Islamic Association schedule.</p>
        </div>
      </div>
    </main>
  );
}
