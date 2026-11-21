// Likes and comments. POST {action:'like'|'comment'|'delcomment', ...}. Must be logged in.
const {db}=require('../lib/db'); const A=require('../lib/auth');
module.exports=A.guard(async(req,res)=>{
  if(req.method!=='POST') return res.status(405).json({error:'Use POST'});
  const d=await db(); if(!d) return res.status(503).json({error:'Database is not connected.',code:'no_db'});
  const b=req.body||{}, me=req.user;
  if(b.action==='like'){
    const oid=parseInt(b.observation_id,10); if(!(await d.query(`SELECT id FROM observations WHERE id=$1`,[oid]))[0]) return res.status(404).json({error:'Not found'});
    const has=(await d.query(`SELECT 1 AS x FROM likes WHERE observation_id=$1 AND user_id=$2`,[oid,me.id]))[0];
    if(has) await d.query(`DELETE FROM likes WHERE observation_id=$1 AND user_id=$2`,[oid,me.id]); else await d.query(`INSERT INTO likes(observation_id,user_id) VALUES($1,$2)`,[oid,me.id]);
    const n=Number((await d.query(`SELECT COUNT(*) AS n FROM likes WHERE observation_id=$1`,[oid]))[0].n);
    return res.status(200).json({liked:!has,likes:n});
  }
  if(b.action==='comment'){
    if(!A.limit(req,'comment',30)) return res.status(429).json({error:'Slow down a little.'});
    const oid=parseInt(b.observation_id,10), body=String(b.body||'').trim().slice(0,500); if(!body) return res.status(400).json({error:'Write something first.'});
    if(!(await d.query(`SELECT id FROM observations WHERE id=$1`,[oid]))[0]) return res.status(404).json({error:'Not found'});
    let parent=null; if(b.parent_id){const p=(await d.query(`SELECT id,parent_id,observation_id FROM comments WHERE id=$1`,[parseInt(b.parent_id,10)]))[0];
      if(!p||Number(p.observation_id)!==oid) return res.status(400).json({error:'That comment is gone.'}); parent=Number(p.parent_id||p.id)}
    await d.query(`INSERT INTO comments(observation_id,user_id,parent_id,body,created_at) VALUES($1,$2,$3,$4,$5)`,[oid,me.id,parent,body,new Date().toISOString()]);
    return res.status(201).json({ok:true});
  }
  if(b.action==='delcomment'){
    const c=(await d.query(`SELECT id,user_id FROM comments WHERE id=$1`,[parseInt(b.id,10)]))[0]; if(!c) return res.status(404).json({error:'Not found'});
    if(me.role!=='reviewer'&&Number(c.user_id)!==me.id) return res.status(403).json({error:'You can only delete your own comments.'});
    await d.query(`DELETE FROM comments WHERE parent_id=$1`,[c.id]); await d.query(`DELETE FROM comments WHERE id=$1`,[c.id]);
    return res.status(200).json({ok:true});
  }
  res.status(400).json({error:'Unknown action.'});
},{role:'user'});
