# -*- coding: utf-8 -*-
"""
Project Manager Agent
Responsável por gerar o backlog e épicos do projeto
Análise inteligente da ideia para criar backlog contextualizado
"""

import re

class ProjectManager:
    def __init__(self, project_id):
        self.project_id = project_id
    
    def extract_keywords(self, idea):
        """Extrai palavras-chave da ideia para contextualizar"""
        keywords = {
            'auth': any(word in idea.lower() for word in ['auth', 'login', 'user', 'usuário', 'conta']),
            'real_time': any(word in idea.lower() for word in ['tempo real', 'real-time', 'notificação', 'live']),
            'collaboration': any(word in idea.lower() for word in ['colabor', 'team', 'equipe', 'compartilh']),
            'data': any(word in idea.lower() for word in ['dados', 'data', 'database', 'bd', 'armazen']),
            'reporting': any(word in idea.lower() for word in ['relat', 'report', 'análise', 'gráfico', 'chart']),
            'integration': any(word in idea.lower() for word in ['integr', 'api', 'plugin', 'terceiro', 'webhook']),
            'mobile': any(word in idea.lower() for word in ['mobile', 'app', 'smartphone', 'ios', 'android']),
            'performance': any(word in idea.lower() for word in ['performance', 'rápido', 'fast', 'escalável', 'scale']),
        }
        return keywords

    def generate_backlog(self, idea):
        """
        Gera um backlog detalhado e contextualizado baseado na ideia
        """
        keywords = self.extract_keywords(idea)
        
        backlog = f"""# 📋 BACKLOG DETALHADO DO PROJETO
**Projeto ID:** {self.project_id}

## 📝 Visão do Projeto
{idea}

---

## 🎯 ÉPICOS (Temas Principais)

### EPIC-001: Infraestrutura Base e Setup
**Descrição:** Estabelecer a base técnica e infraestrutura necessária
**Prioridade:** CRÍTICA
**Estimativa:** 21 pontos
**Histórias:**
- Configurar ambiente de desenvolvimento (local, staging, prod)
- Setup do repositório Git com CI/CD
- Configurar variáveis de ambiente e secrets
- Implementar logging e monitoramento
- Setup de banco de dados e migrations
- Configurar Docker e containers
- Implementar API health checks
- Setup de rate limiting e throttling

### EPIC-002: Autenticação e Autorização
**Descrição:** Sistema robusto de autenticação e controle de acesso
**Prioridade:** CRÍTICA
**Estimativa:** 34 pontos
**Histórias:**
- Autenticação com email/senha
- Refresh tokens e JWT
- Recuperação de senha por email
- Verificação de email
- Controle de acesso baseado em roles (RBAC)
- Logout e session management
- Auditoria de login
- Proteção contra brute force

### EPIC-003: Features Principais do Negócio
**Descrição:** Implementação das funcionalidades core do sistema
**Prioridade:** CRÍTICA
**Estimativa:** 55 pontos
**Histórias Genéricas:**
- Criar e persistir entidades principais
- Listar entidades com paginação e filtros
- Atualizar dados com validação
- Deletar com soft-delete audit trail
- Busca full-text
- Arquivo em massa
- Undo/Redo funcionalidade
- Histórico de alterações

"""
        if keywords['real_time']:
            backlog += """### EPIC-004: Notificações e Tempo Real
**Descrição:** Sistema de notificações e updates em tempo real
**Prioridade:** ALTA
**Estimativa:** 34 pontos
**Histórias:**
- Websockets para atualizações em tempo real
- Notificações push
- Sistema de fila de mensagens (Bull/RabbitMQ)
- Broadcast de eventos
- Notificações por email
- In-app notifications com badge counter
- Histórico de notificações
- Preferências de notificação por usuário

"""
        
        if keywords['collaboration']:
            backlog += """### EPIC-005: Colaboração em Equipe
**Descrição:** Funcionalidades de colaboração e compartilhamento
**Prioridade:** ALTA
**Estimativa:** 34 pontos
**Histórias:**
- Compartilhamento de projetos/documentos
- Controle de permissões granular (read, write, delete)
- Comentários e discussões
- Menção de usuários (@mention)
- Atividades de colaboradores em tempo real
- Histórico de quem fez o quê
- Invites para colaboradores
- Teams/Grupos

"""
        
        if keywords['reporting']:
            backlog += """### EPIC-006: Relatórios e Análises
**Descrição:** Geração de relatórios e dashboards analíticos
**Prioridade:** MÉDIA
**Estimativa:** 34 pontos
**Histórias:**
- Dashboard com KPIs principais
- Gráficos interativos
- Exportação em PDF/Excel
- Relatórios agendados
- Filtros dinâmicos
- Drill-down em dados
- Comparação períodos
- Custom reports builder

"""
        
        if keywords['data']:
            backlog += """### EPIC-007: Gerenciamento de Dados
**Descrição:** Integridade, backup e gerenciamento de dados
**Prioridade:** ALTA
**Estimativa:** 21 pontos
**Histórias:**
- Backup automático diário
- Restore point recovery
- Data encryption em repouso
- Cleanup de dados antigos
- Deduplicação de dados
- Data validation and sanitization
- Import/Export funcionalidade
- Data retention policies

"""
        
        backlog += """### EPIC-008: Frontend e UX
**Descrição:** Interface responsiva e experiência do usuário
**Prioridade:** ALTA
**Estimativa:** 34 pontos
**Histórias:**
- Layout responsivo (mobile, tablet, desktop)
- Temas claro/escuro
- Acessibilidade (WCAG 2.1)
- Animações suaves
- Loading states
- Error boundaries
- Offline mode com sync
- Atalhos de teclado

### EPIC-009: Segurança
**Descrição:** Proteção, compliance e segurança de dados
**Prioridade:** CRÍTICA
**Estimativa:** 21 pontos
**Histórias:**
- HTTPS/TLS obrigatório
- CSP headers
- CORS adequado
- SQL Injection prevention
- XSS protection
- CSRF tokens
- Sanitização de inputs
- Conformidade GDPR
- Auditoria de segurança
- Penetration testing ready

### EPIC-010: Performance e Otimização
**Descrição:** Otimizar velocidade e eficiência
**Prioridade:** MEDIA
**Estimativa:** 21 pontos
**Histórias:**
- Code splitting e lazy loading
- Caching strategy (HTTP, Redis)
- Database indexing e query optimization
- CDN para assets estáticos
- Image optimization
- Minificação de assets
- Service workers
- Performance monitoring

### EPIC-011: Testes e QA
**Descrição:** Garantir qualidade e confiabilidade
**Prioridade:** MÉDIA
**Estimativa:** 34 pontos
**Histórias:**
- Testes unitários (80%+ cobertura)
- Testes de integração
- Testes E2E
- Testes de performance
- Testes de segurança
- Testes de acessibilidade
- Automated visual regression
- Bug tracking system

### EPIC-012: DevOps e Deploy
**Descrição:** Automatização de deploy e operações
**Prioridade:** ALTA
**Estimativa:** 21 pontos
**Histórias:**
- CI/CD pipeline automatizado
- Staging environment
- Blue-green deployment
- Rollback automático
- Feature flags
- Monitoring e alertas
- Log aggregation
- Infrastructure as Code

### EPIC-013: Documentação
**Descrição:** Documentação técnica e de usuário
**Prioridade:** MÉDIA
**Estimativa:** 13 pontos
**Histórias:**
- README completo
- API documentation (Swagger/OpenAPI)
- Architecture documentation
- Setup guide
- User guide/Wiki
- Code examples
- Troubleshooting guide
- Video tutorials

### EPIC-014: Integrações e Extensões
**Descrição:** Suporte a integrações terceiras
**Prioridade:** BAIXA
**Estimativa:** 21 pontos
**Histórias:**
- OAuth 2.0 integração
- Webhooks para eventos
- Plugin system
- API público estável
- Marketplace de plugins
- Documentação de API
- SDK em múltiplas linguagens

---

## 📊 HISTÓRIAS DE USUÁRIO PRINCIPAIS

### US-001: Onboarding e Primeira Execução
```
Como novo usuário
Quero ser guiado pelo setup inicial
Para começar a usar o sistema rapidamente

Critérios de Aceição:
- [ ] Wizard passo-a-passo funciona
- [ ] Validação de inputs em tempo real
- [ ] Mensagens de erro claras
- [ ] Possibilidade de pular etapas
- [ ] Progresso visível
```

### US-002: Dashboard Principal
```
Como usuário autenticado
Quero ver um dashboard com minhas informações importantes
Para ter uma visão rápida do status

Critérios de Aceição:
- [ ] Carrega em < 2 segundos
- [ ] Mostra KPIs relevantes
- [ ] Gráficos interativos
- [ ] Atalhos para ações principais
- [ ] Personalizável por usuário
```

### US-003: Pesquisa e Filtros
```
Como usuário
Quero pesquisar e filtrar dados facilmente
Para encontrar o que preciso rapidamente

Critérios de Aceição:
- [ ] Busca por múltiplos campos
- [ ] Filtros avançados
- [ ] Save searches/filters
- [ ] Autocomplete nas buscas
- [ ] Performance < 500ms
```

### US-004: Mobile Responsivo
```
Como usuário mobile
Quero usar o sistema no smartphone
Para acessar de qualquer lugar

Critérios de Aceição:
- [ ] Funciona em iOS e Android
- [ ] Toque otimizado (não hover)
- [ ] Teclado virtual funciona bem
- [ ] Carregamento rápido
- [ ] Offline mode parcial
```

### US-005: Exportar Dados
```
Como usuário
Quero exportar dados em múltiplos formatos
Para usar em outras ferramentas

Critérios de Aceição:
- [ ] Export em PDF, Excel, CSV
- [ ] Customização de colunas
- [ ] Agendamento de exports
- [ ] Email automático
- [ ] Histórico de exports
```

---

## ✅ TAREFAS TÉCNICAS INICIAIS

### Fase 1: Setup (Sprint 1-2)
- [ ] Inicializar repositório com estrutura padrão
- [ ] Configurar linters (ESLint, Prettier)
- [ ] Setup de testes (Jest, Testing Library)
- [ ] Configurar banco de dados local
- [ ] Criar docker-compose para desenvolvimento
- [ ] Setup CI/CD básico (GitHub Actions)
- [ ] Documentar processo de setup
- [ ] Criar templates de issue/PR
- [ ] Configurar dependabot para updates automáticos
- [ ] Setup de mock server para desenvolvimento

### Fase 2: Autenticação (Sprint 2-3)
- [ ] Implementar JWT authentication
- [ ] Setup de refresh tokens
- [ ] Email verification flow
- [ ] Password reset flow
- [ ] Rate limiting em login
- [ ] Session management
- [ ] Auditoria de login

### Fase 3: Features Principais (Sprint 3-5)
- [ ] CRUD básico com validação
- [ ] Busca e filtros
- [ ] Paginação
- [ ] Soft deletes e audit trail
- [ ] Transações e rollback

### Fase 4: Frontend (Sprint 4-6)
- [ ] Componentes base (Button, Input, Modal, etc)
- [ ] Layout responsivo
- [ ] Integração com backend
- [ ] State management (Redux/Zustand)
- [ ] Erro handling e toasts
- [ ] Temas claro/escuro

### Fase 5: QA e Deploy (Sprint 6-7)
- [ ] Testes end-to-end
- [ ] Performance profiling
- [ ] Security scan
- [ ] Staging deployment
- [ ] Production deployment

---

## 📈 ROADMAP TEMPORAL

```
Sprint 1  (1-2 semanas):  Setup + Autenticação base
Sprint 2  (1-2 semanas):  Features principais - Create/Read
Sprint 3  (1-2 semanas):  Features principais - Update/Delete
Sprint 4  (1-2 semanas):  Frontend development
Sprint 5  (1-2 semanas):  Testes e otimizações
Sprint 6  (1-2 semanas):  Deploy e monitoring
Sprint 7+ (contínuo):     Melhorias e novos features
```

---

## 🎲 MÉTRICAS DE SUCESSO

- [ ] Cobertura de testes > 80%
- [ ] Performance: LCP < 2.5s, FID < 100ms
- [ ] Uptime > 99.9%
- [ ] Tempo de resposta API < 200ms (p95)
- [ ] Zero vulnerabilidades críticas
- [ ] User satisfaction > 4.5/5
- [ ] Adoption rate target + deploy frequência

---

*Backlog gerado automaticamente pela IA Software Factory*
"""
        return backlog

    def process(self, idea):
        """Processa a ideia e retorna o backlog contextualizado"""
        return self.generate_backlog(idea)
