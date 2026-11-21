const {config}=require('../lib/riverlens'); const {configured}=require('../lib/db'); const A=require('../lib/auth');
module.exports=A.guard((req,res)=>{ const c=config();
  res.status(200).json({ai_configured:!!c.provider,provider:c.provider,model:c.model||null,db_configured:configured(),version:'community-1',reviewers_configured:!!process.env.REVIEWERS,user:req.user||null}) });
