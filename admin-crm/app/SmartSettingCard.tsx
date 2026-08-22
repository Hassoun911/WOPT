"use client";

import { useEffect, useState } from "react";

type Setting = { key: string; value: unknown; description?: string };

export default function SmartSettingCard({ setting, onSave, disabled }: { setting: Setting; onSave: (value: unknown) => void; disabled: boolean }) {
  const isBool = typeof setting.value === "boolean";
  const isObject = setting.value !== null && typeof setting.value === "object";
  const [text, setText] = useState(String(setting.value ?? ""));
  const [draft, setDraft] = useState<Record<string, unknown>>(isObject ? setting.value as Record<string, unknown> : {});
  const [advanced, setAdvanced] = useState(false);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    setText(String(setting.value ?? ""));
    setDraft(setting.value !== null && typeof setting.value === "object" ? setting.value as Record<string, unknown> : {});
  }, [setting.value]);

  const pretty = setting.key.replaceAll("_", " ");
  const fields = Object.entries(draft).filter(([, value]) => ["string", "number", "boolean"].includes(typeof value));
  const setField = (key: string, value: unknown) => setDraft((current) => ({ ...current, [key]: value }));

  if (isBool) {
    return <div style={s.panel}><div style={s.header}><div><strong>{pretty}</strong><p style={s.subtle}>{setting.description}</p></div><button disabled={disabled} style={setting.value ? s.on : s.off} onClick={() => onSave(!setting.value)}>{setting.value ? "ON" : "OFF"}</button></div><div style={s.state}><span>{setting.value ? "✅" : "⏸️"}</span><div><strong>{setting.value ? "Enabled for users" : "Currently disabled"}</strong><div style={s.subtle}>This is the final state Hassoun users receive.</div></div></div></div>;
  }

  return <div style={s.panel}>
    <div style={s.header}><div><strong>{pretty}</strong><p style={s.subtle}>{setting.description}</p></div><button style={s.previewButton} onClick={() => setPreview((value) => !value)}>👁️ {preview ? "Hide preview" : "Preview"}</button></div>
    {isObject && fields.length ? <div style={s.fields}>{fields.map(([key, value]) => <label key={key} style={s.field}><span>{key.replaceAll("_", " ").replace(/([A-Z])/g, " $1")}</span>{typeof value === "boolean" ? <input type="checkbox" checked={Boolean(value)} onChange={(event) => setField(key, event.target.checked)} /> : <input style={s.input} value={String(value ?? "")} onChange={(event) => setField(key, typeof value === "number" ? Number(event.target.value) : event.target.value)} />}</label>)}</div> : !isObject ? <input style={s.input} value={text} onChange={(event) => setText(event.target.value)} /> : null}
    {preview ? <Preview name={setting.key} value={isObject ? draft : text} /> : null}
    <div style={s.actions}><button disabled={disabled} style={s.save} onClick={() => onSave(isObject ? draft : text)}>💾 Save</button>{isObject ? <button style={s.textButton} onClick={() => setAdvanced((value) => !value)}>{advanced ? "Hide advanced" : "Advanced JSON"}</button> : null}</div>
    {isObject && advanced ? <textarea style={s.textarea} value={JSON.stringify(draft, null, 2)} onChange={(event) => { try { setDraft(JSON.parse(event.target.value)); } catch {} }} /> : null}
  </div>;
}

function Preview({ name, value }: { name: string; value: unknown }) {
  const object = value && typeof value === "object" ? value as Record<string, unknown> : {};
  if (name.includes("sadaqah")) return <div style={s.preview}><div style={s.icon}>🌿</div><div><strong>{String(object.sadaqahTitleEn || object.titleEn || "A Continuing Sadaqah Jariyah")}</strong><p>{String(object.descriptionEn || object.bodyEn || "A memorial dedication and continuing source of benefit through Hassoun.")}</p><small>🤲 User-facing dedication preview</small></div></div>;
  if (name.includes("feature_guide")) return <div style={s.preview}><div style={s.icon}>🧭</div><div><strong>{String(object.titleEn || "Learn the App")}</strong><p>{String(object.subtitleEn || object.descriptionEn || "Easy steps, examples and help for every Hassoun feature.")}</p></div></div>;
  if (name.includes("ticker")) return <div style={s.ticker}>🌙 {String(object.textEn || object.messageEn || "Hassoun Islamic reminder • Prayer • Qur’an • Knowledge")} ✨</div>;
  return <div style={s.preview}><div style={s.icon}>📱</div><div><strong>{name.replaceAll("_", " ")}</strong><p>Preview of the saved configuration users will receive.</p></div></div>;
}

const s: Record<string, React.CSSProperties> = {
  panel:{background:"white",border:"1px solid #e0e8e5",borderRadius:18,padding:20,boxShadow:"0 4px 18px #163d3108"},header:{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12},subtle:{color:"#7b8c87",fontSize:12,marginTop:4,lineHeight:1.45},on:{border:0,borderRadius:999,padding:"7px 11px",background:"#dff4e8",color:"#17633d",fontWeight:850,cursor:"pointer"},off:{border:0,borderRadius:999,padding:"7px 11px",background:"#eef2f3",color:"#596964",fontWeight:850,cursor:"pointer"},state:{marginTop:14,display:"flex",gap:10,alignItems:"center",padding:11,borderRadius:12,background:"#f5faf7"},previewButton:{border:"1px solid #dac88f",background:"#fffaf0",color:"#765c1c",borderRadius:9,padding:"7px 9px",fontWeight:800,cursor:"pointer",whiteSpace:"nowrap"},fields:{display:"grid",gap:8,marginTop:12},field:{display:"grid",gap:5,fontSize:11,fontWeight:800,textTransform:"capitalize"},input:{width:"100%",boxSizing:"border-box",border:"1px solid #cad8d3",borderRadius:10,padding:"10px 11px",fontSize:14},actions:{display:"flex",gap:9,alignItems:"center",marginTop:10},save:{border:"1px solid #bfd2cb",borderRadius:8,padding:"8px 10px",background:"white",color:"#245347",fontWeight:800,cursor:"pointer"},textButton:{border:0,background:"transparent",color:"#0b6c55",fontWeight:800,cursor:"pointer"},textarea:{width:"100%",boxSizing:"border-box",border:"1px solid #cad8d3",borderRadius:10,padding:10,minHeight:110,resize:"vertical",marginTop:10},preview:{marginTop:12,padding:14,borderRadius:15,background:"linear-gradient(145deg,#f9f5e8,#fff)",border:"1px solid #e8ddbd",display:"flex",gap:12,alignItems:"center"},icon:{width:42,height:42,borderRadius:12,background:"#e8f5ef",display:"grid",placeItems:"center",fontSize:22,flex:"0 0 auto"},ticker:{marginTop:12,borderRadius:12,padding:"11px 14px",background:"#0d4639",color:"#f6df9b",fontWeight:800,whiteSpace:"nowrap",overflow:"hidden"}
};
