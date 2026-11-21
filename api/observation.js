const {db}=require('../lib/db'); const A=require('../lib/auth');
module.exports=A.guard(async(req,res)=>{
  const d=await db(); if(!d) return res.status(503).json({error:'Database is not connected.',code:'no_db'});
  const id=parseInt(req.query.id,10); if(!id) return res.status(400).json({error:'Missing id'});
  const o=(await d.query(`SELECT o.id,o.created_at,o.site,o.note,o.status,o.user_id,u.username AS author,u.role AS author_role FROM observations o LEFT JOIN users u ON u.id=o.user_id WHERE o.id=$1`,[id]))[0];
  if(!o) return res.status(404).json({error:'Not found'});
  o.user_id=o.user_id==null?null:Number(o.user_id);
  const fs=await d.query(`SELECT * FROM findings WHERE observation_id=$1 ORDER BY id DESC`,[id]);
  o.findings=fs.map(f=>{const {report_json,...r}=f; r.report=report_json?JSON.parse(report_json):null; return r});
  const cs=await d.query(`SELECT c.id,c.parent_id,c.body,c.created_at,c.user_id,u.username,u.role FROM comments c LEFT JOIN users u ON u.id=c.user_id WHERE c.observation_id=$1 ORDER BY c.id`,[id]);
  o.comments=cs.map(c=>({...c,id:Number(c.id),parent_id:c.parent_id==null?null:Number(c.parent_id),user_id:c.user_id==null?null:Number(c.user_id)}));
  o.likes=Number((await d.query(`SELECT COUNT(*) AS n FROM likes WHERE observation_id=$1`,[id]))[0].n);
  o.mine=req.user?Number((await d.query(`SELECT COUNT(*) AS n FROM likes WHERE observation_id=$1 AND user_id=$2`,[id,req.user.id]))[0].n)>0:false;
  res.status(200).json(o);
});
