import { requireAdmin } from "./adminAuth";
import type { Env } from "./types";

const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json"}});
const text=(v:unknown,n=500)=>typeof v==="string"?v.trim().slice(0,n):"";
const makeCode=(p:string)=>p+crypto.randomUUID().replace(/-/g,"").slice(0,7).toUpperCase();
async function read(request:Request){return await request.json().catch(()=>({})) as Record<string,unknown>}

async function allowed(request:Request,env:Env){
 const a=await requireAdmin(request,env);
 if(!a.admin)return {admin:null,response:a.response!};
 if(!["owner","admin"].includes(a.admin.role))return {admin:null,response:reply({error:"Owner or admin access required"},403)};
 return {admin:a.admin,response:null};
}

async function overview(env:Env){
 const q=async(sql:string)=>(await env.DB.prepare(sql).first<{n:number}>())?.n||0;
 const [teachers,classes,students,parents,assignments,review]=await Promise.all([
  q("SELECT COUNT(*) n FROM school_teachers WHERE status='active'"),q("SELECT COUNT(*) n FROM school_classes WHERE status='active'"),q("SELECT COUNT(*) n FROM school_students WHERE status='active'"),q("SELECT COUNT(*) n FROM school_parents WHERE status='active'"),q("SELECT COUNT(*) n FROM school_assignments WHERE status='published'"),q("SELECT COUNT(*) n FROM school_assignment_progress WHERE status='submitted'")]);
 return reply({ok:true,teachers,classes,students,parents,assignments,awaitingReview:review});
}

async function teachers(request:Request,env:Env,id?:string){
 if(request.method==="GET"){const {results}=await env.DB.prepare("SELECT public_id,name,email,phone,status,notes,created_at,updated_at FROM school_teachers ORDER BY name").all();return reply({ok:true,teachers:results})}
 const b=await read(request),name=text(b.name,120);if(!name)return reply({error:"Teacher name is required"},400);
 if(id){await env.DB.prepare("UPDATE school_teachers SET name=?,email=?,phone=?,status=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE public_id=?").bind(name,text(b.email,254)||null,text(b.phone,60)||null,["active","inactive","archived"].includes(String(b.status))?String(b.status):"active",text(b.notes,2000)||null,id).run();return reply({ok:true})}
 const publicId=crypto.randomUUID();await env.DB.prepare("INSERT INTO school_teachers(public_id,name,email,phone,notes) VALUES(?,?,?,?,?)").bind(publicId,name,text(b.email,254)||null,text(b.phone,60)||null,text(b.notes,2000)||null).run();return reply({ok:true,publicId},201);
}

async function classes(request:Request,env:Env,id?:string){
 if(request.method==="GET"){const {results}=await env.DB.prepare("SELECT c.public_id,c.name,c.invite_code,c.capacity,c.schedule_text,c.delivery_mode,c.status,t.public_id teacher_public_id,t.name teacher_name,(SELECT COUNT(*) FROM school_students s WHERE s.class_id=c.id AND s.status='active') student_count FROM school_classes c LEFT JOIN school_teachers t ON t.id=c.teacher_id ORDER BY c.name").all();return reply({ok:true,classes:results})}
 const b=await read(request),name=text(b.name,140);if(!name)return reply({error:"Class name is required"},400);const tp=text(b.teacherPublicId,80);const t=tp?await env.DB.prepare("SELECT id FROM school_teachers WHERE public_id=?").bind(tp).first<{id:number}>():null;
 if(id){await env.DB.prepare("UPDATE school_classes SET name=?,teacher_id=?,capacity=?,schedule_text=?,delivery_mode=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE public_id=?").bind(name,t?.id??null,Number(b.capacity)||null,text(b.scheduleText,500)||null,["online","in_person","hybrid"].includes(String(b.deliveryMode))?String(b.deliveryMode):"online",["active","inactive","archived"].includes(String(b.status))?String(b.status):"active",id).run();return reply({ok:true})}
 const publicId=crypto.randomUUID();await env.DB.prepare("INSERT INTO school_classes(public_id,name,teacher_id,invite_code,capacity,schedule_text,delivery_mode) VALUES(?,?,?,?,?,?,?)").bind(publicId,name,t?.id??null,makeCode("C"),Number(b.capacity)||null,text(b.scheduleText,500)||null,["online","in_person","hybrid"].includes(String(b.deliveryMode))?String(b.deliveryMode):"online").run();return reply({ok:true,publicId},201);
}

async function students(request:Request,env:Env,id?:string){
 if(request.method==="GET"){const {results}=await env.DB.prepare("SELECT s.public_id,s.name,s.email,s.phone,s.status,s.current_surah,s.current_ayah,s.streak,s.stars,s.admin_notes,s.last_active_at,c.public_id class_public_id,c.name class_name FROM school_students s LEFT JOIN school_classes c ON c.id=s.class_id ORDER BY s.name").all();return reply({ok:true,students:results})}
 const b=await read(request),name=text(b.name,140);if(!name)return reply({error:"Student name is required"},400);const cp=text(b.classPublicId,80);const c=cp?await env.DB.prepare("SELECT id FROM school_classes WHERE public_id=?").bind(cp).first<{id:number}>():null;
 if(id){await env.DB.prepare("UPDATE school_students SET name=?,email=?,phone=?,class_id=?,status=?,current_surah=?,current_ayah=?,admin_notes=?,updated_at=CURRENT_TIMESTAMP WHERE public_id=?").bind(name,text(b.email,254)||null,text(b.phone,60)||null,c?.id??null,["active","inactive","archived","suspended"].includes(String(b.status))?String(b.status):"active",Number(b.currentSurah)||null,Number(b.currentAyah)||null,text(b.adminNotes,3000)||null,id).run();return reply({ok:true})}
 const publicId=crypto.randomUUID();await env.DB.prepare("INSERT INTO school_students(public_id,name,email,phone,class_id,parent_code,admin_notes) VALUES(?,?,?,?,?,?,?)").bind(publicId,name,text(b.email,254)||null,text(b.phone,60)||null,c?.id??null,makeCode("P"),text(b.adminNotes,3000)||null).run();return reply({ok:true,publicId},201);
}

export async function handleAdminSchool(request:Request,env:Env,url:URL){
 const a=await allowed(request,env);if(!a.admin)return a.response!;const p=url.pathname.replace(/^\/admin\/school\/?/,"").split("/");const r=p[0]||"overview",id=p[1];
 if(request.method==="GET"&&r==="overview")return overview(env);if(r==="teachers")return teachers(request,env,id);if(r==="classes")return classes(request,env,id);if(r==="students")return students(request,env,id);return reply({error:"School route not found"},404);
}
