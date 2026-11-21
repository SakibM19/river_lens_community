// Database access. Production: Neon Postgres via DATABASE_URL. Local tests: DATABASE_URL=sqlite:<file> (Node's built-in SQLite).
const PW=require('./pw');
let impl=null, ready=null;
const PG_DDL=[
 `CREATE TABLE IF NOT EXISTS observations(id SERIAL PRIMARY KEY, created_at TEXT NOT NULL, site TEXT, note TEXT, image_b64 TEXT NOT NULL, thumb_b64 TEXT, stats TEXT, status TEXT NOT NULL DEFAULT 'analysing', user_id INTEGER)`,
 `CREATE TABLE IF NOT EXISTS findings(id SERIAL PRIMARY KEY, observation_id INTEGER NOT NULL REFERENCES observations(id) ON DELETE CASCADE, created_at TEXT NOT NULL, model TEXT, mode TEXT, report_json TEXT, primary_category TEXT, uncertainty TEXT, needs_review INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'ai_draft', run_ms INTEGER, error TEXT, reviewer TEXT, review_comment TEXT, reviewed_at TEXT, final_category TEXT)`,
 `CREATE INDEX IF NOT EXISTS findings_obs ON findings(observation_id)`,
 `CREATE TABLE IF NOT EXISTS users(id SERIAL PRIMARY KEY, username TEXT NOT NULL, username_lc TEXT NOT NULL UNIQUE, pass_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user', created_at TEXT NOT NULL)`,
 `CREATE TABLE IF NOT EXISTS comments(id SERIAL PRIMARY KEY, observation_id INTEGER NOT NULL REFERENCES observations(id) ON DELETE CASCADE, user_id INTEGER, parent_id INTEGER, body TEXT NOT NULL, created_at TEXT NOT NULL)`,
 `CREATE INDEX IF NOT EXISTS comments_obs ON comments(observation_id)`,
 `CREATE TABLE IF NOT EXISTS likes(observation_id INTEGER NOT NULL REFERENCES observations(id) ON DELETE CASCADE, user_id INTEGER NOT NULL, PRIMARY KEY(observation_id,user_id))`];
// existing deployments already have the observations table without user_id
const PG_MIGRATE=[`ALTER TABLE observations ADD COLUMN IF NOT EXISTS user_id INTEGER`];
// Reviewer accounts come from the REVIEWERS env var: "name:password,name2:password2"
async function seedReviewers(q){
  for(const part of String(process.env.REVIEWERS||'').split(',')){
    const i=part.indexOf(':'); if(i<1) continue; const name=part.slice(0,i).trim(), pw=part.slice(i+1).trim(); if(!name||pw.length<6) continue;
    const lc=name.toLowerCase(); const u=(await q(`SELECT id,pass_hash,role FROM users WHERE username_lc=$1`,[lc]))[0];
    if(!u) await q(`INSERT INTO users(username,username_lc,pass_hash,role,created_at) VALUES($1,$2,$3,'reviewer',$4)`,[name,lc,await PW.hash(pw),new Date().toISOString()]);
    else if(u.role!=='reviewer'||!(await PW.verify(pw,u.pass_hash))) await q(`UPDATE users SET role='reviewer',pass_hash=$1 WHERE id=$2`,[await PW.hash(pw),u.id]);
  }
}
function connect(){
  const url=process.env.DATABASE_URL||process.env.POSTGRES_URL;
  if(!url) return null;
  if(url.startsWith('sqlite:')){
    const {DatabaseSync}=require('node:sqlite'); const d=new DatabaseSync(url.slice(7)||':memory:');
    const ddl=PG_DDL.map(s=>s.replace('SERIAL PRIMARY KEY','INTEGER PRIMARY KEY AUTOINCREMENT'));
    return {kind:'sqlite',ddl,query:async(text,params=[])=>{
      const t=text.replace(/\$(\d+)/g,'?$1').replace(/ILIKE/g,'LIKE'); const st=d.prepare(t);
      return /^\s*(select|with)/i.test(t)||/returning/i.test(t)?st.all(...params):(st.run(...params),[])}};
  }
  const {neon}=require('@neondatabase/serverless'); const sql=neon(url);
  return {kind:'pg',ddl:PG_DDL.concat(PG_MIGRATE),query:async(text,params=[])=>sql.query?sql.query(text,params):sql(text,params)};
}
async function db(){
  if(!impl){impl=connect(); if(!impl) return null; ready=(async()=>{for(const s of impl.ddl) await impl.query(s); try{await seedReviewers(impl.query)}catch(e){console.error('reviewer seed failed',e)}})()}
  await ready; return impl;
}
module.exports={db,configured:()=>!!(process.env.DATABASE_URL||process.env.POSTGRES_URL)};
