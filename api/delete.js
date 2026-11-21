const {db}=require('../lib/db'); const A=require('../lib/auth');
// Owners can delete their own posts; reviewers can delete any post.
module.exports=A.guard(async(req,res)=>{
  if(req.method!=='POST') return res.status(405).json({error:'Use POST'});
  const d=await db(); if(!d) return res.status(503).json({error:'Database is not connected.',code:'no_db'});
  const id=parseInt((req.body||{}).id,10); if(!id) return res.status(400).json({error:'Missing id'});
  const o=(await d.query(`SELECT id,user_id FROM observations WHERE id=$1`,[id]))[0]; if(!o) return res.status(404).json({error:'Not found'});
  if(req.user.role!=='reviewer'&&Number(o.user_id)!==req.user.id) return res.status(403).json({error:'You can only delete your own posts.'});
  for(const t of ['comments','likes','findings']) await d.query(`DELETE FROM ${t} WHERE observation_id=$1`,[id]);
  await d.query(`DELETE FROM observations WHERE id=$1`,[id]); res.status(200).json({ok:true});
},{role:'user'});
