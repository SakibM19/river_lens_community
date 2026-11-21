// POST /api/auth  {action:'register'|'login'|'logout', username, password}
const {db}=require('../lib/db'); const A=require('../lib/auth'); const PW=require('../lib/pw');
module.exports=A.guard(async(req,res)=>{
  if(req.method!=='POST') return res.status(405).json({error:'Use POST'});
  const b=req.body||{}, act=b.action;
  if(act==='logout'){A.clearSession(req,res);return res.status(200).json({ok:true})}
  const d=await db(); if(!d) return res.status(503).json({error:'Database is not connected.',code:'no_db'});
  const name=String(b.username||'').trim(), pw=String(b.password||'');
  if(act==='register'){
    if(!A.limit(req,'reg',6)) return res.status(429).json({error:'Too many sign-ups. Wait a minute.'});
    if(!/^[A-Za-z0-9_.-]{3,24}$/.test(name)) return res.status(400).json({error:'Username must be 3-24 letters, numbers, dot, dash or underscore.'});
    if(pw.length<8||pw.length>100) return res.status(400).json({error:'Password must be at least 8 characters.'});
    const lc=name.toLowerCase(); if((await d.query(`SELECT id FROM users WHERE username_lc=$1`,[lc]))[0]) return res.status(409).json({error:'That username is taken.'});
    let id; try{ id=Number((await d.query(`INSERT INTO users(username,username_lc,pass_hash,role,created_at) VALUES($1,$2,$3,'user',$4) RETURNING id`,[name,lc,await PW.hash(pw),new Date().toISOString()]))[0].id) }
    catch(e){ return res.status(409).json({error:'That username is taken.'}) }
    A.setSession(req,res,id); return res.status(201).json({user:{id,username:name,role:'user'}});
  }
  if(act==='login'){
    if(!A.limit(req,'login',10)) return res.status(429).json({error:'Too many attempts. Wait a minute.'});
    const u=(await d.query(`SELECT id,username,role,pass_hash FROM users WHERE username_lc=$1`,[name.toLowerCase()]))[0];
    if(!u||!(await PW.verify(pw,u.pass_hash))) return res.status(401).json({error:'Wrong username or password.'});
    if(b.as==='reviewer'&&u.role!=='reviewer') return res.status(403).json({error:'This is not a reviewer account. Reviewer accounts are created by the project owner.'});
    if(b.as==='member'&&u.role==='reviewer') return res.status(403).json({error:'This is a reviewer account. Please use the Reviewer tab to sign in.'});
    A.setSession(req,res,Number(u.id)); return res.status(200).json({user:{id:Number(u.id),username:u.username,role:u.role}});
  }
  res.status(400).json({error:'Unknown action.'});
});
