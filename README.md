# Big Black Orto Vitalicia 2026 — Checkout Pix

Checkout responsivo adaptado de ronald-almeida/dermacode com PIX no valor fixo de **R$ 497,70** e integração com Black Cat. Sem banco de dados e sem dependências externas.

## Rodar localmente

Node.js 22 ou superior.

1. Copie `.env.example` para `.env`.
2. Defina `BLACKCAT_API_KEY` com a chave secreta do painel Black Cat.
3. Defina `CHECKOUT_SECRET` com 32 ou mais caracteres aleatórios.
4. Execute `npm start` e acesse `http://localhost:3000`.
5. Execute `npm test` para os testes unitários que não criam cobranças.

## Funcionamento

A interface coleta nome, e-mail, confirmação de e-mail, celular e CPF/CNPJ. O valor é fixado **no servidor** em 49770 centavos. A função `POST /api/pix` cria uma cobrança por `https://api.blackcatoficial.com/api/sales/create-sale` com `X-API-Key`, `paymentMethod: "pix"` e item digital. O retorno da Black Cat fornece o QR Code e o código copia e cola. A função `GET /api/pix/status` usa token temporário assinado para consultar o status a cada 10 segundos. A chave nunca é entregue ao browser.

**Sem banco de dados:** há um cache de tentativas em memória, que não é persistente nem global entre múltiplas instâncias. O navegador usa `sessionStorage` apenas para recuperar o PIX da sessão. Em falhas ambíguas, consulte o painel Black Cat antes de solicitar uma nova transação, evitando pagamentos duplicados.

`BLACKCAT_POSTBACK_URL` é opcional e pode apontar para um sistema de entrega/acesso de curso. Esse serviço deve consultar o status diretamente na Black Cat antes de liberar o produto. O checkout **não implementa o disparo de e-mail nem a entrega automática do curso**.

A interface usa fontes do sistema, resumo lateral no desktop e layout compacto no celular. A imagem do produto está em `public/assets/blackorto-product.png`. O QR Code e o botão de copiar são exibidos somente após a geração do Pix.

## Publicar na Vercel

Importe `ronald-almeida/blackorto` com preset **Other**, diretório raiz e as configurações do `vercel.json`. Configure as variáveis `BLACKCAT_API_KEY`, `CHECKOUT_SECRET` e, opcionalmente, `BLACKCAT_POSTBACK_URL` em Environment Variables. Faça um novo deploy após configurá-las.

Antes de receber clientes: valide vendedor, suporte, oferta, logística de acesso e um pagamento autorizado. A indisponibilidade sem chave Black Cat é intencional: a interface nunca apresenta PIX fictício. O checkout não é um checkout oficial da Hotmart; o pagamento é processado via Black Cat.
