# -*- coding: utf-8 -*-
"""
Requirements Analyst Agent
Análise detalhada de requisitos funcionais, não-funcionais e casos de uso
"""

from datetime import datetime

class RequirementsAnalyst:
    def __init__(self, project_id):
        self.project_id = project_id
    
    def extract_context(self, idea):
        """Extrai contexto da ideia"""
        lower_idea = idea.lower()
        return {
            'is_saas': any(w in lower_idea for w in ['saas', 'plataforma', 'web app', 'sistema']),
            'is_collab': any(w in lower_idea for w in ['equipe', 'colabor', 'team', 'múltiplos usuários']),
            'has_real_time': any(w in lower_idea for w in ['tempo real', 'real-time', 'notificação', 'live']),
            'has_data': any(w in lower_idea for w in ['dados', 'analytics', 'relatório', 'dashboard']),
            'is_mobile': any(w in lower_idea for w in ['mobile', 'app', 'smartphone']),
        }

    def generate_requirements(self, idea, backlog):
        """
        Gera requisitos detalhados e contextualizados
        """
        context = self.extract_context(idea)
        
        requirements = f"""# 📋 ESPECIFICAÇÃO DE REQUISITOS
**Projeto ID:** {self.project_id}

---

## 🎯 CONTEXTO E OBJETIVO

**Descrição da Ideia:**
{idea}

**Objetivo Geral:**
Criar um sistema que atenda adequadamente às necessidades descritas acima, com foco em:
- Funcionalidade robusta e confiável
- Segurança de dados e privacidade
- Performance e escalabilidade
- Experiência do usuário intuitiva
- Manutenibilidade do código

---

## ✅ REQUISITOS FUNCIONAIS (RF)

### Módulo 1: Autenticação e Autorização

#### RF-1.1 Registro de Usuário
```
Descrição: Novo usuário pode criar conta
Ator: Visitante não autenticado
Fluxo Principal:
  1. Usuário acessa página de registro
  2. Preenche: email, senha, confirmação senha, nome
  3. Sistema valida:
     - Email válido e único
     - Senha com 8+ chars, 1 maiúscula, 1 número, 1 especial
     - Senhas coincidem
  4. Sistema envia email de verificação
  5. Usuário clica no link
  6. Conta é ativada
7. Redirecionado para login

Fluxo Alternativo (Email existente):
  - Sistema exibe erro: "Email já registrado"

Critério de Aceição:
  [x] Validação em tempo real dos campos
  [x] Email de verificação recebido
  [x] Link de verificação funciona
  [x] Senha armazenada com hash seguro
  [x] Limite de 5 tentativas por IP/hr
```

#### RF-1.2 Autenticação com Email/Senha
```
Descrição: Usuário faz login na aplicação
Fluxo:
  1. Insere email e senha
  2. Sistema valida contra banco de dados
  3. Se válido, gera JWT token com expiração 24h
  4. Armazena refresh token em cookie httpOnly
  5. Redireciona para dashboard

Critério de Aceição:
  [x] Login bem-sucedido em < 500ms
  [x] Senha comparada com hash (bcrypt)
  [x] JWT token inclui user_id, role, permissions
  [x] Refresh token válido por 30 dias
  [x] Rate limit: 10 tentativas/IP/15min
```

#### RF-1.3 Logout
```
Descrição: Usuário encerra sessão
Fluxo:
  1. Clica em logout
  2. Token é invalidado no backend
  3. Refresh token é deletado
  4. Redirecionado para login

Critério de Aceição:
  [x] Sessão ativa é finalizada
  [x] Token não funciona após logout
  [x] Histórico de logout é registrado
```

#### RF-1.4 Recuperação de Senha
```
Descrição: Usuário esqueceu a senha
Fluxo:
  1. Clica em "Esqueci a senha"
  2. Insere email
  3. Sistema valida email existente
  4. Envia email com link de reset (válido por 1 hora)
  5. Usuário acessa link
  6. Define nova senha
  7. Login com nova senha funciona

Critério de Aceição:
  [x] Email recebido em < 1 minuto
  [x] Link de reset funciona
  [x] Link expira corretamente
  [x] Nova senha é requerida

### Módulo 2: Gerenciamento de Dados

#### RF-2.1 Criar Entidade Principal
```
Descrição: Usuário cria novo registro
Fluxo:
  1. Acessa seção de criação
  2. Preenche formulário obrigatório
  3. Sistema valida dados:
     - Campos obrigatórios preenchidos
     - Tipos corretos (string, number, date, etc)
     - Constraints (máx 255 chars, número > 0, etc)
     - Regras de negócio
  4. Clica salvar
  5. Backend processa e salva
  6. ID é retornado
  7. Usuário redirecionado ou modal fecha

Critério de Aceição:
  [x] Validação de todos os campos
  [x] Mensagens de erro claras
  [x] Salvo em < 2 segundos
  [x] Aparece na lista imediatamente
  [x] Auditoria registra criador
```

#### RF-2.2 Listar com Paginação
```
Descrição: Visualizar com limite de registros
Fluxo:
  1. Página padrão: 20 registros
  2. Classifiável por colunas
  3. Paginação: anterior/próxima ou saltar
  4. Total de registros exibido
  5. Carregamento progressivo (virtualization)

Critério de Aceição:
  [x] Primeira página < 1s
  [x] Ordenação funciona (asc/desc)
  [x] Links de página funcionam
  [x] Mantém filtros entre páginas
```

#### RF-2.3 Atualizar Entidade
```
Descrição: Editar registro existente
Fluxo:
  1. Clica em editar
  2. Formulário pre-populate com dados
  3. Altera campos necessários
  4. Sistema valida como em RF-2.1
  5. Salva mudanças
  6. Notificação de sucesso
  7. Se houver conflito (outro usuário editou), exibe alerta

Critério de Aceição:
  [x] Detecção de mudanças (dirty check)
  [x] Validação em tempo real
  [x] Histórico de mudanças registrado
  [x] Quem fez a mudança é registrado
  [x] Timestamp de atualização correto
```

#### RF-2.4 Deletar Entidade
```
Descrição: Remover registro
Fluxo:
  1. Clica em deletar
  2. Exibe modal de confirmação com alerta
  3. Usuário confirma
  4. Registro é marcado como deletado (soft-delete)
  5. Não aparece mais na lista
  6. Auditoria registra deleção

Critério de Aceição:
  [x] Soft-delete (não deleta do BD)
  [x] Pode recuperar se necessário
  [x] Recusa se há dependências
  [x] Auditoria completa
```

### Módulo 3: Busca e Filtros

#### RF-3.1 Busca Full-Text
```
Descrição: Pesquisar por texto
Fluxo:
  1. Digita texto no campo de busca
  2. Sistema busca em campos principais
  3. Resultados aparecem em < 200ms
  4. Highlight do termo encontrado
  5. Suporta wildcard (%)

Critério de Aceição:
  [x] Busca em múltiplos campos
  [x] Case-insensitive
  [x] Autocomplete com sugestões
  [x] Performance mantida
```

#### RF-3.2 Filtros Avançados
```
Descrição: Filtrar dados por critérios
Fluxo:
  1. Clica em filtros
  2. Seleciona campos e operadores (=, >, <, contains, etc)
  3. Insere valores
  4. Sistema aplica filtros (AND logic)
  5. Resultados atualizados
  6. Pode salvar filtro com nome

Critério de Aceição:
  [x] Múltiplos filtros simultâneos
  [x] Operadores diversos
  [x] Salvar/carregar filtros
  [x] Reset filters facilmente
```

### Módulo 4: Notificações e Comunicação

#### RF-4.1 Notificações In-App
```
Descrição: Alertas dentro da aplicação
Fluxo:
  1. Evento ocorre
  2. Notificação é criada
  3. Badge Counter atualizado
  4. Toast/Popup breve
  5. Registrada no centro de notificações
  6. Usuário pode marcar como lida

Critério de Aceição:
  [x] Exibidas em tempo real
  [x] Persistem em centro de notificações
  [x] Sem duplicatas
  [x] Paginação se muitas
```

#### RF-4.2 Email Notifications
```
Descrição: Alertas por email
Fluxo:
  1. Sistema configura eventos
  2. Usuário escolhe quais receber
  3. Email enviado quando evento ocorre
  4. Link no email leva ao contexto
  5. Footer com opção de unsubscribe

Critério de Aceição:
  [x] Template profissional
  [x] Entregue em < 5 minutos
  [x] Responde a Unsubscribe
  [x] SPF/DKIM configurados
```

### Módulo 5: Dashboard e Relatórios

#### RF-5.1 Dashboard Principal
```
Descrição: Página de visão geral (leitura: RF-2.2)
Componentes:
  - 4-6 KPIs principais (cards com números)
  - 2-3 gráficos (linha, pizza, barra)
  - Tabela com últimas atividades
  - Aviso/alerta se problemas
  - Atalhos para ações principais

Critério de Aceição:
  [x] Carrega em < 2 segundos
  [x] Gráficos são responsivos
  [x] Atualiza a cada 30s
  [x] Click em KPI filtra dados
```

#### RF-5.2 Exportar Relatório
```
Descrição: Gerar arquivo de dados
Formatos:
  - PDF (com cabeçalho, footer, paginação)
  - Excel (.xlsx com múltiplas abas)
  - CSV (UTF-8, delimitador vírgula)
  - JSON (estruturado)

Fluxo:
  1. Seleciona registros ou aplica filtros
  2. Clica "Exportar"
  3. Escolhe formato
  4. Sistema gera arquivo
  5. Download iniciado
  6. Arquivo contém: data de geração, usuário, filtros

Critério de Aceição:
  [x] Arquivo gerado em < 5s
  [x] Todos os dados inclusos
  [x] Formatação correta
  [x] Pode cancelar durante geração
```

### Módulo 6: Configurações de Usuário

#### RF-6.1 Perfil de Usuário
```
Descrição: Gerenciar informações pessoais
Campos:
  - Nome completo
  - Email (com verificação se mudar)
  - Telefone (opcional)
  - Foto de perfil
  - Bio/descrição
  - Timezone
  - Idioma preferido

Critério de Aceição:
  [x] Validações apropriadas
  [x] Foto comprimida/otimizada
  [x] Email de confirmação se muda email
  [x] Histórico de mudanças
```

#### RF-6.2 Preferências de Notificação
```
Descrição: Controlar quais notificações receber
Opções:
  - Email: nunca, imediato, resumo diário, semanal
  - In-app: sim/não
  - SMS: sim/não (se aplicável)
  - Discord/Slack: conectar conta e ativar

Critério de Aceição:
  [x] Salva preferências
  [x] Respecta durante envio
  [x] Pode mudar a qualquer hora
  [x] Confirma mudanças
```

### Módulo 7: Dados Sensíveis

#### RF-7.1 Campos de Senha
```
Descrição: Input seguro para senhas
Comportamento:
  - Texto mascarado com asteriscos
  - Mostrar/ocultar toggle
  - Validação em tempo real
  - Força da senha (weak/medium/strong)
  - Requisitos: 8+ chars, maiúscula, número, especial

Critério de Aceição:
  [x] Máscara funciona corretamente
  [x] Não copia texto claro
  [x] Toggle visibilidade funciona
  [x] Indicador de força preciso
```

---

## 🛡️ REQUISITOS NÃO-FUNCIONAIS (RNF)

### RNF-1: Performance

#### Tempos de Resposta
```
- Requisição API simples (GET): < 100ms (p95)
- Requisição API com processamento: < 500ms (p95)
- Operação banco de dados: < 50ms
- Página carrega: < 2s (First Contentful Paint)
- Interativo (Largest Contentful Paint): < 2.5s
```

#### Otimizações
```
- Code splitting: arquivo > 200KB
- Lazy loading: imagens fora da viewport
- Caching: HTTP cache headers corretos
- Database: índices em colunas usadas em WHERE
- Queue: operações pesadas em background job
- CDN: assets estáticos servidos globalmente
```

#### Métricas Web Vitals
```
- LCP (Largest Contentful Paint): < 2.5s
- FID (First Input Delay): < 100ms
- CLS (Cumulative Layout Shift): < 0.1
```

### RNF-2: Segurança

#### Criptografia
```
- Transmissão: HTTPS 1.3 obrigatório, TLS 1.2+ mínimo
- Armazenamento: bcrypt para senhas (cost 12), AES-256 para dados sensíveis
- Keys seguras: todas em environment variables, não em código
- Rotação: chaves rotacionadas a cada 90 dias
```

#### Validação
```
- Input: whitelist de caracteres permitidos, máx 10KB
- SQL Injection: prepared statements obrigatórios
- XSS: sanitização de HTML, CSP headers
- CSRF: tokens únicos por sessão
- Command Injection: shell execution proibido
```

#### Autenticação
```
- JWT expiração: 24 horas
- Refresh token expiração: 30 dias
- Rate limiting: 10 tentativas login em 15 min por IP
- Session timeout: 30 minutes de inatividade
- Auditoria: log de todas as tentativas de login
```

#### Dados Sensíveis
```
- PII (Personally Identifiable Information):
  - Email, telefone, CPF mascarados em log
  - Nunca enviado em URL
  - Criptografado no BD
  - Acesso auditado

- Senhas:
  - Nunca em plaintext
  - Nunca em log
  - Nunca em email
  - Reset link válido 1 hora
```

#### Autorização
```
- RBAC (Role Based Access Control): Admin, User, Viewer
- Verificação em cada endpoint
- Dados filtrados por tenant (se multi-tenant)
- Auditoria de quem acessou o quê
```

### RNF-3: Disponibilidade e Confiabilidade

#### Uptime
```
- SLA: 99.9% (máximo 43 minutos downtime/mês)
- Monitoramento: sintético a cada 5 minutos
- Alertas: SMS + Slack se < 99%
```

#### Backup
```
- Frequência: diário às 23:00 UTC
- Retenção: 30 dias
- Local: múltiplas regiões geográficas
- Restore time: < 1 hora
- Teste de restore: mensalmente
```

#### Disaster Recovery
```
- RTO (Recovery Time Objective): < 1 hora
- RPO (Recovery Point Objective): < 5 minutos
- Fallback: servidor standby pronto
- Comunicação: status page atualizado
```

### RNF-4: Escalabilidade

#### Horizontal Scaling
```
- Stateless: nenhum estado local em servidor
- Load balancer: distribuir tráfego
- Database: replicação master-slave
- Cache: Redis distribuído
- Fila: Bull/RabbitMQ escalável
```

#### Limite de Usuários
```
- Fase 1: suportar 100 usuários simultâneos
- Fase 2: 1,000 usuários
- Fase 3: 10,000 usuários
- Projeto pronto para microsserviços futuro
```

#### Storage
```
- Dados: PostgreSQL (16GB inicial, escalável)
- Arquivos: S3/CloudStorage (ilimitado)
- Cache: Redis (1GB memória)
- Logs: Elasticsearch (7 dias retention)
```

### RNF-5: Usabilidade

#### Acessibilidade (WCAG 2.1 Level AA)
```
- Cores: contrast ratio mínimo 4.5:1
- Textos: alt-text em imagens, labels em inputs
- Teclado: tab order correto, sem armadilhas
- Leitores: ARIA labels apropriados
- Mobile: touch targets mínimo 48x48px
- Tema: suporta dark mode via prefers-color-scheme
```

#### Responsividade
```
- Desktop: 1920x1080+
- Tablet: 768x1024
- Mobile: 375x667 (iPhone SE)
- Orientações: portrait e landscape
```

#### Internacionalização
```
- Idiomas: português (PT-BR) + English (EN)
- Datas: formatadas por locale
- Números: separador decimal por locale
- Timezone: ajusta automaticamente por IP
```

### RNF-6: Manutenibilidade

#### Código
```
- Linguagem: JavaScript/TypeScript
- Linter: ESLint com Prettier
- Cobertura de testes: mínimo 80%
- Documentação: JSDoc em funções públicas
- Commits: conventional commits (feat, fix, etc)
```

#### Arquitetura
```
- Padrão: MVC backend + Component frontend
- Separação: logicBusiness vs UI vs Data
- Reutilização: componentes + hooks
- Documentação: README + Architecture Decision Records
```

#### DevOps
```
- Version control: Git com main + develop branches
- CI/CD: GitHub Actions para testes + deploy
- Docker: container pré-configurado
- IaC: Terraform/CloudFormation opcional
```

---

## 📊 CASOS DE USO PRINCIPAIS

### UC-1: Fluxo de Onboarding
```
Ator Primário: Novo Usuário

Pré-condição:
  - URL de signup acessível
  - Email válido disponível

Fluxo Principal:
  1. Acessa página de registro
  2. Insere dados: email, nome, senha
  3. Valida em tempo real
  4. Clica "Criar Conta"
  5. Recebe email de confirmação
  6. Clica link (válido por 2 horas)
  7. Email verificado
  8. Redireciona para login
  9. Faz login
 10. Vê tutorial guiado
 11. Completa primeira ação
 12. Dashboard aparece

Pós-condição:
  - Conta ativa
  - Usuário autenticado
  - Pode usar sistema

Alternativas:
  - Email inválido → exibe erro
  - Email existente → oferecimento login
  - Timeout no link → pode resend
```

### UC-2: Fluxo de Criação de Registro
```
Ator: Usuário autenticado

Pré-condição:
  - Usuário logado
  - Tem permissão de criar
  - Página de criação acessível

Fluxo:
  1. Clica "Novo" ou "+"
  2. Modal/página abre com form
  3. Preenche campos obrigatórios com validação
  4. Campos opcionais podem ser deixados em branco
  5. Carrega dados relacionados se necessário (dropdowns)
  6. Clica "Criar"
  7. Validação final no backend
  8. Se OK → salva, novo ID retornado
  9. Se erro → exibe mensagem clara
 10. Redireciona para list ou detail view

Pós-condição:
  - Novo registro em banco de dados
  - Usuário criador registrado
  - Timestamp de criação correto
  - Aparece em listagem imediatamente
```

### UC-3: Collab Real-Time (se aplicável)
```
Ator: Múltiplos usuários

Fluxo:
  1. Usuário A abre editor
  2. Usuário B abre mesmo documento
  3. A digita texto
  4. B vê mudança em tempo real < 100ms
  5. A vê cursor de B
  6. Ambos editam simultâneamente
  7. Sem conflitos (OT/CRDT)
  8. Mudanças salvam automático
  9. Histórico rastreado

Tecnologia:
  - WebSockets para real-time
  - Operational Transform ou CRDT
  - Yjs para sincronização
```

---

## 🎯 RESTRIÇÕES

- **Framework:** React 18+ no frontend, Node.js 18+ no backend
- **Banco de dados:** PostgreSQL 14+
- **Browser:** Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Compatibilidade móvel:** iOS 13+, Android 8+
- **Licença:** MIT (código próprio)
- **GDPR Compliant:** sim, com DPA assinado
- **Máx usuários atuais:** 100 simultâneos (será escalado)

---

## 🔄 DEPENDÊNCIAS

RF-1 → RF-2 (precisa autenticação antes de CRUD)
RF-2 → RF-3 (busca/filtros exigem dados)
RF-2 → RF-5 (dashboard precisa de dados)
RF-5 → RF-4 (notificações podem ser baseadas em relatório)

---

## 📝 CRITÁRIOS DE QUALIDADE

Requisito deve ser:
- ✅ Mensurável (teste automatizado que passa/falha)
- ✅ Testável (possível validar o comportamento)
- ✅ Rastreável (link para issue no repositório)
- ✅ Realista (pode ser implementado em sprint)
- ✅ Priorizável (clareza sobre importância)

---

*Documento gerado automaticamente pela IA Software Factory*
*Última atualização: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}*
"""
        return requirements

    def process(self, idea, backlog):
        """Processa idea e backlog para gerar requisitos detalhados"""
        return self.generate_requirements(idea, backlog)

