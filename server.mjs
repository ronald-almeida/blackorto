import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { AMOUNT, salePayload, signTransaction, verifyTransaction } from './checkout.mjs';
const publicDir = new URL('./public/',import.meta.url);
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp'};
const attempts = new Map(); const requests = new Map();
const cleanup = setInterval(() => { for(const [k,v] of attempts) if(v.expires<Date.now()) attempts.delete(k); for(const [k,v] of requests) if(v.expires<Date.now()) requests.delete(k); },60000); cleanup.unref();
function json(res,status,body){ res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body)); }
async function blackcat(path,options={}) {
  const response=await fetch('https://api.blackcatoficial.com/api'+path,{...options,headers:{'Content-Type':'application/json','X-API-Key':process.env.BLACKCAT_API_KEY},signal:AbortSignal.timeout(20000)});
  const result=await response.json(); if(!response.ok || !result.success || !result.data) throw new Error('provider'); return result.data;
}
export const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  try {
    const url=new URL(req.url,'http://localhost');
    if(url.pathname.startsWith('/api/')) {
      if(!process.env.BLACKCAT_API_KEY || (process.env.CHECKOUT_SECRET || '').length<32) return json(res,503,{error:'O pagamento está temporariamente indisponível. Tente novamente mais tarde.'});
      if(req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return json(res,403,{error:'Origem não permitida.'});
      if(url.pathname==='/api/pix' && req.method==='POST') {
        if(!req.headers['content-type']?.startsWith('application/json')) return json(res,415,{error:'Formato inválido.'});
        let raw='';if(req.body!==undefined){raw=typeof req.body==='string'?req.body:JSON.stringify(req.body);}else{for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>8192)return json(res,413,{error:'Dados muito extensos.'});}}if(Buffer.byteLength(raw)>8192)return json(res,413,{error:'Dados muito extensos.'});
        let input,payload;try{input=JSON.parse(raw);payload=salePayload(input);}catch(e){return json(res,400,{error:e instanceof SyntaxError?'Dados inválidos.':e.message});}
        const key=req.headers['idempotency-key'];if(typeof key!=='string'||!/^[a-f0-9-]{36}$/.test(key))return json(res,400,{error:'Identificador inválido. Atualize a página.'});
        if(requests.has(key)){const cached=await requests.get(key).promise;return json(res,cached.status,cached.body);}
        const ip=req.socket.remoteAddress;let rate=attempts.get(ip);if(!rate||rate.expires<Date.now()){rate={count:0,expires:Date.now()+600000};attempts.set(ip,rate);}if(++rate.count>10)return json(res,429,{error:'Muitas tentativas. Aguarde alguns minutos.'});
        if(process.env.BLACKCAT_POSTBACK_URL)payload.postbackUrl=process.env.BLACKCAT_POSTBACK_URL;
        const promise=(async()=>{try{
          const data=await blackcat('/sales/create-sale',{method:'POST',body:JSON.stringify(payload)});
          const payment=data.paymentData;const code=payment?.copyPaste||payment?.qrCode;
          if(!data.transactionId||data.amount!==AMOUNT||!code)throw new Error('invalid response');
          const qr=payment.qrCodeBase64;const image=typeof qr==='string' ? (qr.startsWith('data:image/png;base64,')?qr:/^[A-Za-z0-9+/=\r\n]+$/.test(qr)?'data:image/png;base64,'+qr:null):null;
          return {status:201,body:{token:signTransaction(data.transactionId,process.env.CHECKOUT_SECRET),code,image,expiresAt:payment.expiresAt,amount:AMOUNT}};
        }catch{return {status:502,body:{error:'Não foi possível confirmar a geração do Pix. Aguarde e contate o atendimento antes de tentar outra cobrança.'}};}})();
        requests.set(key,{promise,expires:Date.now()+86400000});const result=await promise;return json(res,result.status,result.body);
      }
      if(url.pathname==='/api/pix/status'&&req.method==='GET'){
        const token=req.headers.authorization?.replace(/^Bearer /,'')||'';const id=verifyTransaction(token,process.env.CHECKOUT_SECRET);if(!id)return json(res,403,{error:'Consulta expirada. Entre em contato com o atendimento.'});
        try{const data=await blackcat('/sales/'+encodeURIComponent(id)+'/status');if(data.transactionId!==id||data.amount!==AMOUNT)throw new Error('invalid transaction');return json(res,200,{status:data.status});}catch{return json(res,502,{error:'Não foi possível atualizar o pagamento. Vamos tentar novamente.'});}
      }
      return json(res,404,{error:'Não encontrado.'});
    }
    if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:'Método não permitido.'});
    const files={'/':'index.html','/styles.css':'styles.css','/reference.css':'reference.css','/app.js':'app.js','/assets/blackorto-logo.webp':'assets/blackorto-logo.webp','/assets/qrcode.svg':'assets/qrcode.svg'};
    const file=files[url.pathname];if(!file)return json(res,404,{error:'Página não encontrada.'});
    const content=await readFile(new URL(file,publicDir));const extension=file.slice(file.lastIndexOf('.'));res.writeHead(200,{'Content-Type':mime[extension],'Cache-Control':file.startsWith('assets/')?'public, max-age=86400':'no-cache'});res.end(req.method==='HEAD'?undefined:content);
  }catch{json(res,500,{error:'Não foi possível concluir. Tente novamente mais tarde.'});}
});
if(process.argv[1]===fileURLToPath(import.meta.url))server.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('Checkout disponível na porta '+(process.env.PORT||3000)));
