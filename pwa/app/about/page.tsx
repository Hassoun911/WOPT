export const metadata = { title: "About • Hassoun" };

export default function AboutPage() {
  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(180deg,#f7f2e8,#f3eee2)", color: "#173f35", padding: "28px 16px 64px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <section style={{ background: "linear-gradient(135deg,#0b654f,#123e35)", color: "white", borderRadius: 30, padding: "40px 28px", textAlign: "center", boxShadow: "0 20px 60px rgba(27,70,58,.18)" }}>
          <img src="/hassoun-official-logo.jpg?v=20260825-official-2" alt="Hassoun" style={{ width: 118, height: 118, objectFit: "cover", borderRadius: 24, margin: "0 auto 12px", display: "block" }} />
          <p style={{ margin: 0, color: "#f2d57d", fontSize: 10, fontWeight: 900, letterSpacing: ".14em" }}>HASSOUN ISLAMIC COMPANION</p>
          <h1 style={{ fontSize: "clamp(38px,7vw,62px)", margin: "7px 0 8px" }}>Hassoun</h1>
          <p style={{ color: "#d1e6df", fontWeight: 700, margin: 0 }}>Prayer • Qur’an • School • Knowledge</p>
        </section>
        <section style={{ marginTop: 18, background: "#fffdf8", border: "1px solid #e1dacd", borderRadius: 24, padding: "clamp(20px,4vw,32px)", boxShadow: "0 10px 34px rgba(35,64,55,.06)" }}>
          <h2 style={{ marginTop: 0 }}>Our purpose</h2>
          <p style={{ lineHeight: 1.75, color: "#52655f" }}>Hassoun brings prayer times, Adhan, Qur’an reading and listening, memorization, Qur’an School tools and Islamic learning into one calm, easy-to-use experience.</p>
          <h2>Qur’an School</h2>
          <p style={{ lineHeight: 1.75, color: "#52655f" }}>The web Qur’an School supports students, teachers and parents with assignments, practice, progress and teacher feedback.</p>
          <a href="/school" style={{ display: "inline-block", marginTop: 6, padding: "11px 15px", borderRadius: 12, background: "#17604e", color: "white", textDecoration: "none", fontWeight: 900 }}>Open Qur’an School</a>
        </section>
      </div>
    </main>
  );
}
