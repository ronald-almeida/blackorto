const $ = id => document.getElementById(id);
const form = $('checkout-form');
const modal = $('pix-modal');
const closeButton = $('close-modal');
const generate = $('generate');
const copyButton = $('copy');
const result = $('payment-result');
const modalError = $('modal-error');
const loading = $('pix-loading');
let payment = null;
let pollTimer;
let busy = false;
let settled = false;
let creationUncertain = false;
let previousFocus = null;
let requestKey = sessionStorage.getItem('blackorto-request') || crypto.randomUUID();
sessionStorage.setItem('blackorto-request', requestKey);

function showError(message, inline = false) {
  const target = inline ? $('error') : modalError;
  target.textContent = message || '';
  target.hidden = !message;
}
function openModal() {
  if (modal.hidden) {
    previousFocus = document.activeElement;
    modal.hidden = false;
    document.body.classList.add('pix-modal-open');
    closeButton.focus({ preventScroll: true });
  }
}
function closeModal() {
  modal.hidden = true;
  document.body.classList.remove('pix-modal-open');
  if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus({ preventScroll: true });
}
closeButton.addEventListener('click', closeModal);
$('modal-backdrop').addEventListener('click', closeModal);
document.addEventListener('keydown', event => {
  if (modal.hidden) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    closeModal();
  } else if (event.key === 'Tab') {
    const controls = [...modal.querySelectorAll('button:not([disabled]),textarea:not([disabled])')]
      .filter(el => !el.hidden && !el.closest('[hidden]'));
    if (!controls.length) return;
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});

$('emailConfirmation').addEventListener('input', () => $('emailConfirmation').setCustomValidity(''));
$('email').addEventListener('input', () => $('emailConfirmation').setCustomValidity(''));
$('phone').addEventListener('input', event => {
  const n = event.target.value.replace(/\D/g, '').slice(0, 11);
  event.target.value = n.length > 2
    ? '(' + n.slice(0, 2) + ') ' + n.slice(2, n.length > 10 ? 7 : 6)
      + (n.length > 6 ? '-' + n.slice(n.length > 10 ? 7 : 6) : '')
    : n;
});
$('document').addEventListener('input', event => {
  const n = event.target.value.replace(/\D/g, '').slice(0, 14);
  event.target.value = n.length <= 11
    ? n.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/(\d{3})(\d{1,2})$/, '$1-$2')
    : n.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/(\d{3})(\d{4})(\d{0,2})$/, '$1/$2-$3');
});

function showPayment(data) {
  payment = data;
  loading.hidden = true;
  result.hidden = false;
  modalError.hidden = true;
  showError('', true);
  $('customer-fields').disabled = true;
  generate.disabled = false;
  generate.textContent = 'Ver meu Pix';
  $('pix-code').value = data.code;
  copyButton.disabled = false;
  copyButton.hidden = false;
  $('status').textContent = 'Aguardando pagamento de R$ 497,70';
  $('instructions').textContent = 'Seu Pix foi gerado. Clique em "Ver meu Pix" para acessar o QR Code.';
  $('qr-area').hidden = false;
  $('pix-code').hidden = false;
  const label = document.querySelector('label[for="pix-code"]');
  label.hidden = false;
  if (data.image) {
    const qr = document.createElement('img');
    qr.src = data.image;
    qr.alt = 'QR Code do Pix de R$ 497,70';
    $('qr-area').replaceChildren(qr);
  } else {
    $('qr-area').textContent = 'Use o código Pix copia e cola abaixo para pagar.';
  }
  const expiry = new Date(data.expiresAt);
  $('expiry').textContent = Number.isFinite(expiry.getTime())
    ? 'Válido até ' + expiry.toLocaleString('pt-BR')
    : '';
  openModal();
  checkStatus();
}
function finish(status) {
  clearTimeout(pollTimer);
  settled = true;
  const paid = status === 'PAID';
  $('status').textContent = paid
    ? '✓ Pagamento confirmado!'
    : status === 'REFUNDED' ? 'Pagamento estornado.'
      : 'Este Pix expirou ou foi cancelado.';
  loading.hidden = true;
  result.hidden = true;
  $('instructions').textContent = paid
    ? 'Pagamento confirmado. Guarde o comprovante de sua compra.'
    : 'O Pix anterior foi encerrado. Consulte o atendimento caso precise de ajuda.';
  generate.textContent = paid ? 'Pagamento confirmado' : 'Pix encerrado';
  generate.disabled = true;
  sessionStorage.removeItem('blackorto-payment');
  sessionStorage.removeItem('blackorto-request');
  showError('', false);
  if (modal.hidden) openModal();
}
async function checkStatus() {
  clearTimeout(pollTimer);
  if (!payment || settled) return;
  try {
    const response = await fetch('/api/pix/status', {
      headers: { Authorization: 'Bearer ' + payment.token },
      cache: 'no-store'
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Falha ao consultar status.');
    showError('');
    if (['PAID', 'CANCELLED', 'REFUNDED'].includes(data.status)) {
      finish(data.status);
      return;
    }
    if (payment.expiresAt && Date.now() > new Date(payment.expiresAt).getTime()) {
      finish('CANCELLED');
      return;
    }
  } catch (err) {
    showError(err.message || 'Não foi possível consultar o pagamento. Tentaremos novamente.');
  }
  pollTimer = setTimeout(checkStatus, 10000);
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (payment) { openModal(); return; }
  if (busy || creationUncertain || settled) { openModal(); return; }
  const email = $('email').value.trim().toLowerCase();
  const confirmation = $('emailConfirmation').value.trim().toLowerCase();
  if (email !== confirmation) {
    $('emailConfirmation').setCustomValidity('Os emails precisam ser iguais.');
    $('emailConfirmation').reportValidity();
    return;
  }
  busy = true;
  showError('', true);
  showError('');
  loading.hidden = false;
  result.hidden = true;
  $('status').textContent = 'Preparando seu Pix…';
  generate.disabled = false;
  generate.textContent = 'Ver janela do Pix';
  openModal();
  const values = Object.fromEntries(new FormData(form));
  const query = new URLSearchParams(location.search);
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
    if (query.has(key)) values[key] = query.get(key);
  }
  try {
    const response = await fetch('/api/pix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': requestKey },
      body: JSON.stringify(values)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(data.error || 'Não foi possível gerar seu Pix.');
      err.status = response.status;
      throw err;
    }
    if (!data.token || !data.code) throw new Error('O gateway não retornou um Pix válido.');
    sessionStorage.setItem('blackorto-payment', JSON.stringify(data));
    showPayment(data);
  } catch (err) {
    loading.hidden = true;
    $('status').textContent = 'Não foi possível gerar o Pix';
    const message = err.message || 'Verifique sua conexão e tente novamente.';
    showError(message);
    showError(message, true);
    // Em falhas incertas, não iniciar automaticamente nova cobrança.
    // Corrigir dados inválidos (4xx) é seguro, pois a cobrança não foi criada.
    if (err.status >= 400 && err.status < 500) {
      generate.disabled = false;
      generate.textContent = 'Gerar Pix de R$ 497,70';
    } else {
      creationUncertain = true;
      generate.disabled = false;
      generate.textContent = 'Ver detalhes da tentativa';
    }
  } finally {
    busy = false;
  }
});
copyButton.addEventListener('click', async () => {
  if (!payment || settled) return;
  try {
    await navigator.clipboard.writeText(payment.code);
    copyButton.textContent = '✓ Código Pix copiado!';
    setTimeout(() => { copyButton.textContent = 'Copiar código Pix'; }, 2500);
  } catch {
    $('pix-code').focus();
    $('pix-code').select();
    showError('Não foi possível copiar automaticamente. Selecione e copie o código acima.');
  }
});
try {
  const saved = JSON.parse(sessionStorage.getItem('blackorto-payment'));
  if (saved && typeof saved.token === 'string' && typeof saved.code === 'string') {
    showPayment(saved);
  }
} catch {
  sessionStorage.removeItem('blackorto-payment');
}
