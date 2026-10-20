import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
export const AMOUNT = 49770;
export function validDocument(value) {
  if (!/^\d{11}$|^\d{14}$/.test(value) || /^(\d)\1+$/.test(value)) return false;
  const digit = (base, weights) => { const rest = [...base].reduce((sum,n,i) => sum + Number(n)*weights[i],0)%11; return rest < 2 ? 0 : 11-rest; };
  const weights = value.length === 11 ? [[10,9,8,7,6,5,4,3,2],[11,10,9,8,7,6,5,4,3,2]] : [[5,4,3,2,9,8,7,6,5,4,3,2],[6,5,4,3,2,9,8,7,6,5,4,3,2]];
  const base = value.slice(0,-2); const first = digit(base,weights[0]);
  return value === base + first + digit(base+first,weights[1]);
}
export function salePayload(input) {
  const name = String(input.name || '').trim();
  const email = String(input.email || '').trim().toLowerCase();
  const confirmation = String(input.emailConfirmation || '').trim().toLowerCase();
  const phone = String(input.phone || '').replace(/\D/g,'');
  const document = String(input.document || '').replace(/\D/g,'');
  if (name.length < 5 || name.length > 120 || !/\S+\s+\S+/.test(name)) throw new Error('Digite seu nome completo.');
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || confirmation !== email) throw new Error('Confira os dois campos de email.');
  if (!validDocument(document)) throw new Error('Digite um CPF ou CNPJ válido.');
  if (!/^[1-9]{2}\d{8,9}$/.test(phone)) throw new Error('Digite seu celular com DDD.');
  const payload = {amount:AMOUNT,currency:'BRL',paymentMethod:'pix',items:[{title:'Big Black Orto Vitalicia 2026 — Acesso vitalício',unitPrice:AMOUNT,quantity:1,tangible:false}],customer:{name,email,phone,document:{number:document,type:document.length===11?'cpf':'cnpj'}},pix:{expiresInDays:1},externalRef:`ORTO-${randomUUID()}`};
  for (const key of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term']) if (typeof input[key] === 'string') payload[key] = input[key].slice(0,200);
  return payload;
}
export function signTransaction(id,secret) {
  const body = Buffer.from(JSON.stringify({id,expires:Date.now()+48*60*60*1000})).toString('base64url');
  return body+'.'+createHmac('sha256',secret).update(body).digest('base64url');
}
export function verifyTransaction(token,secret) {
  try { const [body,signature] = token.split('.'); const expected = createHmac('sha256',secret).update(body).digest(); const actual = Buffer.from(signature,'base64url');
    if(actual.length !== expected.length || !timingSafeEqual(actual,expected)) return null;
    const data = JSON.parse(Buffer.from(body,'base64url')); return data.expires > Date.now() && typeof data.id === 'string' ? data.id : null;
  } catch { return null; }
}
