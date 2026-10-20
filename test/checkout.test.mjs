import test from 'node:test';
import assert from 'node:assert/strict';
import {salePayload,validDocument,signTransaction,verifyTransaction} from '../checkout.mjs';
const customer={name:'Cliente Teste',email:'teste@example.com',emailConfirmation:'teste@example.com',document:'52998224725',phone:'11999999999'};
test('preço e produto não podem ser alterados pelo navegador',()=>{const p=salePayload({...customer,amount:1,items:[]});assert.equal(p.amount,49770);assert.equal(p.items[0].unitPrice,49770);assert.equal(p.items[0].quantity,1);assert.match(p.items[0].title,/Big Black Orto Vitalicia 2026/);assert.equal(p.paymentMethod,'pix');});
test('documentos inválidos e emails diferentes são rejeitados',()=>{assert.equal(validDocument('11111111111'),false);assert.equal(validDocument('52998224724'),false);assert.equal(validDocument('11222333000181'),true);assert.throws(()=>salePayload({...customer,emailConfirmation:'outro@example.com'}));assert.throws(()=>salePayload({...customer,document:'123'}));});
test('consulta requer assinatura íntegra',()=>{const secret='a'.repeat(32),token=signTransaction('TXN-1',secret);assert.equal(verifyTransaction(token,secret),'TXN-1');assert.equal(verifyTransaction(token+'x',secret),null);assert.equal(verifyTransaction(token,'b'.repeat(32)),null);});
