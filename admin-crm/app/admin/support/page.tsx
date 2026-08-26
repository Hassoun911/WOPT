export default function Page() {
  return <main style={{minHeight:"100vh",background:"#f6f3e9",padding:28,color:"#163f35",fontFamily:"system-ui,sans-serif"}}>
    <div style={{maxWidth:900,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        <div><div style={{fontSize:12,fontWeight:800,letterSpacing:2,color:"#08765d"}}>HASSOUN ADMIN</div><h1 style={{margin:"6px 0"}}>Support</h1></div>
        <a href="/admin/" style={{color:"#163f35",fontWeight:800}}>← Dashboard</a>
      </div>
      <section style={{background:"white",border:"1px solid #d7dfd9",borderRadius:16,padding:20,marginTop:18}}>
        <h2 style={{marginTop:0}}>Support inbox</h2>
        <p style={{lineHeight:1.6}}>Support requests from the app are currently delivered to the configured Hassoun support email. This page is now available from the CRM so Support no longer leads to a missing page.</p>
        <p style={{lineHeight:1.6,opacity:.75}}>A stored in-CRM ticket inbox can be added later if you want messages saved and managed here instead of email-only delivery.</p>
      </section>
    </div>
  </main>;
}
