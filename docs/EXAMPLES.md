# Exemplos de Uso - AI Software Factory

## 📝 Exemplo 1: Sistema de Gerenciamento de Tarefas

### Input (Frontend)
```
Descrição: Um sistema web de gerenciamento de tarefas (TODO list)
que permite aos usuários criar, editar, deletar e organizar
suas tarefas diárias. Deve ter categorias, prioridades,
datas de vencimento e notificações.
```

### Output Esperado

#### Backlog
- Epic 1: Gerenciamento de Tarefas
  - US001: Criar nova tarefa
  - US002: Editar tarefa existente
  - US003: Deletar tarefa
  - US004: Marcar como concluída

- Epic 2: Organização
  - US005: Criar categorias
  - US006: Definir prioridades
  - US007: Agendar data de vencimento

- Epic 3: Notificações
  - US008: Notificar sobre tarefas vencidas
  - US009: Notificar sobre tarefas próximas

#### Requisitos
- RF001: CRUD de Tarefas
- RF002: Sistema de Categorias
- RF003: Prioridades (Baixa, Média, Alta)
- RF004: Notificações por Email
- RNF001: Performance < 2s
- RNF002: Suportar 10.000 tarefas por usuário

#### Arquitetura
- Frontend: React + Vite + TailwindCSS
- Backend: Node.js + Express + PostgreSQL
- Autenticação: JWT

#### Código
```javascript
// Models
const TaskSchema = {
  id: UUID,
  title: String,
  description: Text,
  category: String,
  priority: Enum('low', 'medium', 'high'),
  dueDate: Date,
  completed: Boolean,
  userId: UUID
}

// APIs
GET /api/tasks
POST /api/tasks
PUT /api/tasks/:id
DELETE /api/tasks/:id
```

#### Testes
- Unit Tests: Modelo de Tarefa
- Integration Tests: API de CRUD
- E2E Tests: Fluxo completo do usuário

---

## 📝 Exemplo 2: Plataforma de E-commerce

### Input (Frontend)
```
Descrição: Uma plataforma de e-commerce para loja de eletrônicos.
Deve incluir catálogo de produtos, carrinho de compras,
checkouts, pedidos, histórico de compras e dashboard de
vendas para administradores.
```

### Output Esperado

#### Backlog
- Epic 1: Catálogo de Produtos
- Epic 2: Carrinho e Checkout
- Epic 3: Sistema de Pedidos
- Epic 4: Painel Administrative
- Epic 5: Pagamentos

#### Requisitos
- RF001: Listar Produtos com Filtros
- RF002: Carrinho de Compras
- RF003: Checkout com Múltiplos Pagamentos
- RF004: Rastreamento de Pedidos
- RF005: Integração com Gateway de Pagamento
- RNF001: Suportar 10.000 usuários simultâneos
- RNF002: Segurança PCI DSS

#### Arquitetura
- Frontend: React + Next.js
- Backend: Node.js + Express + PostgreSQL
- Banco de Dados: PostgreSQL + Redis Cache
- Pagamentos: Stripe/PayPal
- Arquivos: AWS S3 para imagens

---

## 📝 Exemplo 3: Sistema de Gestão Hospitalar

### Input (Frontend)
```
Descrição: Sistema completo de gestão hospitalar que inclui
gerenciamento de pacientes, agendamento de consultas,
prontuários eletrônicos, prescrições médicas e relatórios.
```

### Output Esperado

#### Backlog
- Epic 1: Cadastro de Pacientes
- Epic 2: Agendamento
- Epic 3: Prontuário Eletrônico
- Epic 4: Prescrições
- Epic 5: Relatórios e Analytics

#### Requisitos
- RF001: CRUD de Pacientes
- RF002: Agendamento de Consultas
- RF003: Armazenamento de Prontuários
- RF004: Geração de Prescrições
- RNF001: HIPAA Compliance
- RNF002: Auditoria completa
- RNF003: Alta disponibilidade (99.9%)

#### Arquitetura
- Frontend: React + TypeScript
- Backend: Node.js ou Java
- Banco de Dados: PostgreSQL + Elasticsearch
- Segurança: Criptografia End-to-End
- Compliance: HIPAA, LGPD

---

## 📝 Exemplo 4: Plataforma de Aprendizado Online

### Input (Frontend)
```
Descrição: Plataforma de educação online para cursos de
programação, design e marketing. Deve incluir vídeos,
quizzes, certificados, comunidade e sistema de mensagens.
```

### Output Esperado

#### Backlog
- Epic 1: Gerenciamento de Cursos
- Epic 2: Sistema de Vídeos
- Epic 3: Quizzes e Avaliações
- Epic 4: Comunidade (Fórum)
- Epic 5: Certificadoss
- Epic 6: Mensagens Diretas

#### Requisitos
- RF001: Upload e Streaming de Vídeos
- RF002: Quizzes com Multiple Choice
- RF003: Geração de Certificados
- RF004: Fórum com Moderação
- RF005: Sistema de Mensagens
- RNF001: Suportar 100.000 usuários
- RNF002: Streaming adaptativo
- RNF003: CDN Global

#### Arquitetura
- Frontend: React + Redux
- Backend: Node.js + Stripe (pagamentos)
- Vídeos: HLS Streaming
- Cache: Redis
- CDN: CloudFlare ou AWS CloudFront

---

## 🚀 Como Usar o AI Software Factory

### Passo 1: Acessar a Aplicação
```
URL: http://localhost:5173
```

### Passo 2: Descrever a Ideia
```
Digite sua ideia de projeto no campo de texto.
Seja específico sobre funcionalidades.
```

### Passo 3: Clicar em "Gerar Projeto"
```
A fábrica começará a processar sua ideia.
Aguarde de 10-30 segundos.
```

### Passo 4: Revisar os Artefatos
```
Navegue pelas abas:
- Backlog: Estrutura do projeto
- Requisitos: Especificação detalhada
- Arquitetura: Design técnico
- Código: Estrutura inicial
- Testes: Plano de QA
```

### Passo 5: Baixar os Artefatos
```
Clique em "Baixar [Nome]" para salvar cada documento.
```

---

## 💡 Dicas Úteis

### Descrição Eficaz
✅ BOM:
```
Sistema de e-commerce para loja de eletrônicos com:
- Catálogo de produtos com filtros e busca
- Carrinho de compras persistente
- Checkout com múltiplas formas de pagamento
- Histórico de compras para usuários
- Dashboard administrativo de vendas
- Integração com gateway de pagamento
```

❌ RUIM:
```
Uma loja online
```

### Detalhar Requisitos
✅ BOM:
```
Aplicação web que suporte:
- Até 10.000 usuários simultâneos
- Suporte para dispositivos móveis
- Processamento de pagamento seguro
- Notificações por email
```

❌ RUIM:
```
Um app rápido e seguro
```

---

## 📊 Casos de Uso Reais

### Startup Querer MVP Rápido
1. Usar AI Software Factory para gerar artefatos
2. Criar protótipo baseado na arquitetura
3. Validar ideia com usuários
4. Refinir com feedback

### Empresa Documentar Projeto Existente
1. Usar como referência para documentação
2. Extrair padrões já estabelecidos
3. Padronizar em múltiplos projetos

### Educação e Aprendizado
1. Estudantes analisam artefatos gerados
2. Entendem estrutura de projetos reais
3. Aprendem boas práticas

---

## 🔮 Próximos Passos Após Geração

1. **Refinar Artefatos**
   - Ajustar requisitos baseado em feedback
   - Adicionar detalhes específicos
   - Priorizar features

2. **Criar Repositório Git**
   ```bash
   git init
   git add .
   git commit -m "Initial project structure"
   ```

3. **Configurar Ambiente**
   - Setup de desenvolvimento
   - Configurar CI/CD
   - Setup de testes

4. **Iniciar Desenvolvimento**
   - Criar primeiras user stories
   - Alinhar equipe
   - Começar implementação

---

**Nota:** A AI Software Factory gera estrutura e documentação.
Ainda é necessário desenvolvimento, testes e refinamento antes da produção.
