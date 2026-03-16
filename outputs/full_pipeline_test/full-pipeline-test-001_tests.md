 # PLANO DE TESTES E QA

## Estratégia de Testes (Unitários, Integração, E2E)

- Unitários: Testes realizados em nível de módulo ou função para garantir que cada parte do sistema funciona corretamente em isolamento. Utilizaremos Jest para esse tipo de teste.
- Integração: Testes realizados para garantir que várias partes do sistema funcionem corretamente juntas. Utilizaremos Jest para esse tipo de teste.
- E2E (End-to-End): Testes realizados para garantir que o sistema funciona corretamente em todo seu ciclo de vida, desde o usuário interagir com a interface até que o pedido seja concluído com sucesso. Utilizaremos Cypress para esse tipo de teste.

## Cenários de Teste (Test Cases) detalhados

### Frontend

- Teste de Componentes: Verificar se cada componente do frontend funciona corretamente, como o carrinho de compras, a tela de checkout, a tela de pagamento, e as notificações.
- Teste de Hooks: Verificar se os hooks personalizados, como `useCart`, `useCheckout`, e `usePayment`, estão funcionando corretamente.
- Teste de Rotas: Verificar se as rotas estão mapeadas corretamente e se cada rota está redirecionando para a página correta.

### Backend

- Teste de Rotas: Verificar se as rotas da API RESTful estão mapeadas corretamente e se cada rota está retornando o status HTTP e a resposta esperada.
- Teste de Controllers: Verificar se os controllers estão gerenciando corretamente as operações de usuário, produto, e pedido.
- Teste de Serviços: Verificar se o serviço de pagamento está funcionando corretamente.

## Exemplos de Código de Teste (usando Jest/Vitest/Cypress)

### Frontend (usando Jest)

- Teste de Componente:

```javascript
import React from 'react';
import { render, screen } from '@testing-library/react';
import Cart from './Cart';
import { mockData } from './mockData';

test('Renders Cart component correctly', () => {
  render(<Cart cartItems={mockData.cartItems} />);

  mockData.cartItems.forEach((item) => {
    const cartItem = screen.getByTestId(`cart-item-${item.id}`);
    expect(cartItem).toBeInTheDocument();
  });

  const total = screen.getByTestId('total');
  expect(total).toHaveTextContent(mockData.total);
});
```

### Backend (usando Jest)

- Teste de Rota:

```javascript
import request from 'supertest';
import app from '../app';
import { mockData } from './mockData';

test('GET /api/users: list all users', async () => {
  const response = await request(app).get('/api/users');

  expect(response.statusCode).toBe(200);
  expect(response.body.length).toBe(mockData.users.length);
});
```

### E2E (usando Cypress)

- Teste de Flow de Pedido:

```javascript
describe('Flow de Pedido', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('Adicionar produto ao carrinho', () => {
    cy.get('[data-testid="product-1"]').click();
    cy.get('[data-testid="cart-summary"]').should('have.text', '1');
  });

  it('Acessar tela de checkout', () => {
    cy.get('[data-testid="checkout-button"]').click();
    cy.url().should('include', '/checkout');
  });

  it('Realizar pagamento e receber notificação', () => {
    cy.get('[data-testid="payment-button"]').click();
    cy.get('[data-testid="payment-success"]').should('be.visible');
  });
});
```

## Dados de Teste Sugeridos

- Usuário: nome, email, senha, endereço, telefone, histórico de pedidos.
- Produto: nome, descrição, preço, imagem, categoria, estoque.
- Pedido: id, usuário, itens (produto, quantidade), data, status, total.

## Métricas de Qualidade

- Coverage: Porcentagem de código testado.
- Erros: Número de erros detectados durante os testes.
- Tempo de Execução: Tempo total necessário para executar todos os testes.
- Performance: Tempo médio de resposta dos endpoints da API.
- Cobertura de Testes: Porcentagem de linhas de código cobertas pelos testes.