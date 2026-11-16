
  
const express=require('express');
const session=require('express-session');
const bcrypt=require('bcryptjs');
const crypto=require('crypto');
const fs=require('fs');
const path=require('path');
const app=express(); const PORT=process.env.PORT||3001; const DB=path.join(__dirname,'data','forum.json');
fs.mkdirSync(path.dirname(DB), { recursive: true });

if (!fs.existsSync(DB)) {
  fs.writeFileSync(DB, JSON.stringify({ users: [], threads: [] }, null, 2));
}
const read=()=>{try{const d=JSON.parse(fs.readFileSync(DB,'utf8'));d.users||=[];d.threads||=[];return d}catch{return {users:[],threads:[]}}};
const write=d=>fs.writeFileSync(DB,JSON.stringify(d,null,2)); const clean=(v,n)=>String(v||'').trim().slice(0,n);
app.use(express.json({limit:'256kb'})); app.use(session({secret:process.env.SESSION_SECRET||'change-this-before-public-deployment',resave:false,saveUninitialized:false,cookie:{httpOnly:true,sameSite:'lax',maxAge:604800000}})); app.use(express.static(path.join(__dirname,'public')));
function publicUser(u){return {id:u.id,username:u.username,role:u.role||'member'}}
function current(q,d){return q.session.user&&d.users.find(x=>x.id===q.session.user.id)}
function auth(q,r,n){const u=current(q,read());if(!u)return r.status(401).json({error:'Login required.'});q.user=u;n()}
function staff(q,r,n){if(!['admin','moderator'].includes(q.user.role||'member'))return r.status(403).json({error:'Moderator permission required.'});n()}
function admin(q,r,n){if((q.user.role||'member')!=='admin')return r.status(403).json({error:'Admin permission required.'});n()}
app.get('/api/me',(q,r)=>{const d=read(),u=current(q,d);r.json(u?publicUser(u):null)});
app.post('/api/register',async(q,r)=>{const d=read(),username=clean(q.body.username,30),password=String(q.body.password||'');if(username.length<3||password.length<8)return r.status(400).json({error:'Username must be at least 3 characters and password at least 8.'});if(d.users.some(u=>u.username.toLowerCase()===username.toLowerCase()))return r.status(409).json({error:'Username already exists.'});const role=d.users.length===0?'admin':'member';const u={id:crypto.randomUUID(),username,passwordHash:await bcrypt.hash(password,12),role,createdAt:new Date().toISOString()};d.users.push(u);write(d);q.session.user={id:u.id};r.status(201).json(publicUser(u))});
app.post('/api/login',async(q,r)=>{const d=read(),name=clean(q.body.username,30),u=d.users.find(x=>x.username.toLowerCase()===name.toLowerCase());if(!u||!await bcrypt.compare(String(q.body.password||''),u.passwordHash))return r.status(401).json({error:'Invalid username or password.'});q.session.user={id:u.id};r.json(publicUser(u))}); app.post('/api/logout',(q,r)=>q.session.destroy(()=>r.json({ok:true})));
app.get('/api/admin/stats',auth,admin,(q,r)=>{const d=read();const active=d.threads.filter(t=>!t.deleted);const replies=active.reduce((n,t)=>n+(t.replies||[]).filter(x=>!x.deleted).length,0);r.json({users:d.users.length,admins:d.users.filter(u=>(u.role||'member')==='admin').length,moderators:d.users.filter(u=>u.role==='moderator').length,members:d.users.filter(u=>(u.role||'member')==='member').length,threads:active.length,replies,locked:active.filter(t=>t.locked).length,pinned:active.filter(t=>t.pinned).length});});
app.get('/api/users',auth,admin,(q,r)=>r.json(read().users.map(publicUser)));
app.patch('/api/users/:id/role',auth,admin,(q,r)=>{const role=clean(q.body.role,20);if(!['member','moderator','admin'].includes(role))return r.status(400).json({error:'Invalid role.'});const d=read(),u=d.users.find(x=>x.id===q.params.id);if(!u)return r.status(404).json({error:'User not found.'});if(q.user.id===u.id&&role!=='admin')return r.status(400).json({error:'You cannot remove your own admin role.'});u.role=role;write(d);r.json(publicUser(u))});
app.get('/api/threads',(q,r)=>r.json(read().threads.filter(t=>!t.deleted)));
app.post('/api/threads',auth,(q,r)=>{const d=read(),title=clean(q.body.title,120),body=clean(q.body.body,6000),board=clean(q.body.board,60);if(!title||!body)return r.status(400).json({error:'Title and message required.'});const t={id:crypto.randomUUID(),title,body,board,author:q.user.username,userId:q.user.id,createdAt:new Date().toISOString(),locked:false,pinned:false,replies:[]};d.threads.unshift(t);write(d);r.status(201).json(t)});
app.post('/api/threads/:id/replies',auth,(q,r)=>{const d=read(),t=d.threads.find(x=>x.id===q.params.id&&!x.deleted),body=clean(q.body.body,6000);if(!t)return r.status(404).json({error:'Thread not found.'});if(t.locked&&!['admin','moderator'].includes(q.user.role||'member'))return r.status(403).json({error:'Thread is locked.'});if(!body)return r.status(400).json({error:'Reply required.'});t.replies.push({id:crypto.randomUUID(),body,author:q.user.username,userId:q.user.id,createdAt:new Date().toISOString(),deleted:false});write(d);r.status(201).json({ok:true})});
app.patch('/api/threads/:id',auth,staff,(q,r)=>{const d=read(),t=d.threads.find(x=>x.id===q.params.id&&!x.deleted);if(!t)return r.status(404).json({error:'Thread not found.'});if(typeof q.body.locked==='boolean')t.locked=q.body.locked;if(typeof q.body.pinned==='boolean')t.pinned=q.body.pinned;write(d);r.json(t)});
app.delete('/api/threads/:id',auth,staff,(q,r)=>{const d=read(),t=d.threads.find(x=>x.id===q.params.id&&!x.deleted);if(!t)return r.status(404).json({error:'Thread not found.'});t.deleted=true;write(d);r.json({ok:true})});
app.delete('/api/threads/:tid/replies/:rid',auth,staff,(q,r)=>{const d=read(),t=d.threads.find(x=>x.id===q.params.tid&&!x.deleted);if(!t)return r.status(404).json({error:'Thread not found.'});const x=(t.replies||[]).find(y=>y.id===q.params.rid&&!y.deleted);if(!x)return r.status(404).json({error:'Reply not found.'});x.deleted=true;write(d);r.json({ok:true})});
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Dathkaine Forum running on port ${PORT}`);
});
