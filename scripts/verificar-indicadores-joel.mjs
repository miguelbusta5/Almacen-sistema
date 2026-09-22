import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { encode } from '@auth/core/jwt';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
const secret = randomBytes(32).toString('hex');
const server = spawn(process.execPath, [resolve('nuxt-app/.output/server/index.mjs')], { env: { ...process.env, AUTH_SECRET: secret, NEXTAUTH_SECRET: secret, PORT: '3005', HOST: '127.0.0.1' }, stdio: 'ignore', windowsHide: true });
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }) });
try {
  let listo=false;
  for(let i=0;i<60;i++){try{await fetch('http://127.0.0.1:3005/dashboard/api/version');listo=true;break}catch{await new Promise(r=>setTimeout(r,500))}}
  if(!listo)throw new Error('No inició el servidor local de comprobación');
  const actor=await db.user.findFirstOrThrow({where:{name:'FELIPE OSSA',active:true},select:{id:true,name:true,email:true,role:true}});
  const token=await encode({secret,salt:'authjs.session-token',token:actor,maxAge:300});
  for(const turno of ['dia','noche']){
    const r=await fetch(`http://127.0.0.1:3005/dashboard/api/indicadores?desde=2026-09-01&hasta=2026-09-21&usuarioId=cmtssg6zz000304l701q46vts&turno=${turno}`,{headers:{cookie:`authjs.session-token=${token}`}});
    if(!r.ok)throw new Error(`Indicadores respondió ${r.status}`);
    const data=await r.json();
    console.log(JSON.stringify({turno,equipo:data.equipo.filter(u=>u.id==='cmtssg6zz000304l701q46vts'),personas:data.data.personas.map(p=>({nombre:p.nombre,segundos:p.segundos,plus:p.plus,unidades:p.unidades,porTipo:p.porTipo}))}));
  }
} finally {await db.$disconnect();server.kill()}
