// Password hashing with Node's built-in scrypt (no extra packages).
const crypto=require('crypto'); const {promisify}=require('util'); const scrypt=promisify(crypto.scrypt);
async function hash(pw){const salt=crypto.randomBytes(16).toString('hex');const k=await scrypt(String(pw),salt,32);return salt+':'+k.toString('hex')}
async function verify(pw,stored){try{const [salt,h]=String(stored||'').split(':');if(!salt||!h)return false;const k=await scrypt(String(pw),salt,32);const a=Buffer.from(h,'hex');return a.length===k.length&&crypto.timingSafeEqual(a,k)}catch(e){return false}}
module.exports={hash,verify};
