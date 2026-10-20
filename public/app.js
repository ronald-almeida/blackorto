const $=id=>document.getElementById(id);
const form=$('checkout-form');let payment=null;let pollTimer;let busy=false;let requestKey=sessionStorage.getItem('blackorto-request')||crypto.randomUUID();
sessionStorage.setItem('blackorto-request',requestKey);
const error=message=>{$('error').textContent=message;$('error').hidden=!message;};
$('emailConfirmation').addEventListener('input',()=> $('emailConfirmation').setCustomValidity(''));
$('email').addEventListener('input',()=> $('emailConfirmation').setCustomValidity(''));
$('phone').addEventListener('input',e=>{const n=e.target.value.replace(/\D/g,'').slice(0,11);e.target.value=n.length>2?'('+n.slice(0,2)+') '+n.slice(2,n.length>10?7:6)+(n.length>6?'-'+n.slice(n.length>10?7:6):''):n;});
$('document').addEventListener('input',e=>{let n=e.target.value.replace(/\D/g,'').slice(0,14);e.target.value=n.length<=11?n.replace(/^(\d{3})(\d)/,'$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/,'$1.$2.$3').replace(/(\d{3})(\d{1,2})$/,'$1-$2'):n.replace(/^(\d{2})(\d)/,'$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/,'$1.$2.$3').replace(/(\d{3})(\d{4})(\d{0,2})$/,'$1/$2-$3');});
function showPayment(data){
  payment=data;$('qr-area').hidden=false;$('copy').hidden=false;$('customer-fields').disabled=true;$('generate').disabled=true;$('generate').textContent='Pix gerado';$('copy').disabled=false;$('payment-result').hidden=false;$('pix-code').value=data.code;
  $('status').textContent='Aguardando pagamento de R$ 497,70';$('instructions').textContent='Abra o aplicativo do banco e escaneie o QR Code ou copie o código Pix.';
  if(data.image){const img=document.createElement('img');img.src=data.image;img.alt='QR Code para pagar R$ 497,70 via Pix';$('qr-area').replaceChildren(img);}else{$('qr-area').textContent='Use o código Pix copia e cola abaixo.';}
  const expiry=new Date(data.expiresAt);$('expiry').textContent=Number.isFinite(expiry.getTime())?'Válido até '+expiry.toLocaleString('pt-BR'):'';
  checkStatus();
}
function finish(status){clearTimeout(pollTimer);$('copy').disabled=true;$('qr-area').hidden=true;$('pix-code').hidden=true;document.querySelector('label[for="pix-code"]').hidden=true;$('expiry').hidden=true;
  const paid=status==='PAID';$('status').textContent=paid?'✓ Pagamento confirmado! Sua compra foi concluída.':status==='REFUNDED'?'Pagamento estornado.':'Este Pix expirou ou foi cancelado. Atualize a página para gerar outro.';
  $('instructions').textContent=paid?'Recebemos a confirmação do seu pagamento. Guarde o comprovante.':'O código anterior não deve mais ser utilizado.';
  $('generate').textContent=paid?'Pagamento confirmado':'Pix encerrado';sessionStorage.removeItem('blackorto-payment');sessionStorage.removeItem('blackorto-request');
}
async function checkStatus(){
  clearTimeout(pollTimer);if(!payment)return;
  try{const response=await fetch('/api/pix/status',{headers:{Authorization:'Bearer '+payment.token}});const data=await response.json();if(!response.ok)throw new Error(data.error);error('');if(['PAID','CANCELLED','REFUNDED'].includes(data.status))return finish(data.status);
    if(payment.expiresAt && Date.now()>new Date(payment.expiresAt).getTime())return finish('CANCELLED');
  }catch(e){error(e.message||'Não foi possível consultar o pagamento.');}
  pollTimer=setTimeout(checkStatus,10000);
}
form.addEventListener('submit',async e=>{
  e.preventDefault();if(busy||payment)return;
  if($('email').value.trim().toLowerCase()!==$('emailConfirmation').value.trim().toLowerCase()){$('emailConfirmation').setCustomValidity('Os emails precisam ser iguais.');$('emailConfirmation').reportValidity();return;}
  busy=true;error('');$('generate').disabled=true;$('generate').textContent='Gerando seu Pix…';
  const values=Object.fromEntries(new FormData(form));const query=new URLSearchParams(location.search);for(const key of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'])if(query.has(key))values[key]=query.get(key);
  try{const response=await fetch('/api/pix',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':requestKey},body:JSON.stringify(values)});const data=await response.json();if(!response.ok)throw new Error(data.error||'Não foi possível gerar o Pix.');sessionStorage.setItem('blackorto-payment',JSON.stringify(data));showPayment(data);}catch(e){error(e.message||'Verifique sua conexão e tente novamente.');$('generate').disabled=false;$('generate').textContent='Gerar Pix de R$ 497,70';}finally{busy=false;}
});
$('copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(payment.code);$('copy').textContent='Código Pix copiado!';setTimeout(()=>{$('copy').textContent='Copiar código Pix';},2500);}catch{$('pix-code').focus();$('pix-code').select();error('Selecione e copie o código Pix no campo abaixo.');}});
try{const saved=JSON.parse(sessionStorage.getItem('blackorto-payment'));if(saved?.token&&saved?.code)showPayment(saved);}catch{sessionStorage.removeItem('blackorto-payment');}
