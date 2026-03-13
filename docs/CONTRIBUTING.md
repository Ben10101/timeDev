# Contributing to AI Software Factory

Obrigado por considerar contribuir para o projeto AI Software Factory! 🎉

## 📋 Diretrizes de Contribuição

### Tipos de Contribuição

Aceitamos:
- 🐛 **Bug Reports**: Relatar problemas encontrados
- ✨ **Feature Requests**: Sugerir novas funcionalidades
- 🔧 **Pull Requests**: Enviar código melhorado
- 📚 **Documentação**: Melhorar documentação
- 🧪 **Testes**: Adicionar testes à cobertura

### Código de Conduta

Por favor, seja respeitoso e profissional em todas as interações.

---

## 🚀 Como Começar

### 1. Fork o Repositório

```bash
# Clique no botão "Fork" no GitHub
```

### 2. Clonar Seu Fork

```bash
git clone https://github.com/SEU_USUARIO/ai-software-factory.git
cd ai-software-factory
```

### 3. Criar Uma Branch

```bash
git checkout -b feature/sua-feature
# ou
git checkout -b fix/seu-bug
```

### 4. Fazer Suas Mudanças

```bash
# Edite os arquivos necessários
# Teste suas mudanças localmente
```

### 5. Commit Das Mudanças

```bash
git commit -m "Descrição clara da mudança"

# Exemplos:
# "Add: nova função de validação"
# "Fix: corrigir erro no formulário"
# "Docs: atualizar README"
```

### 6. Push Para Seu Fork

```bash
git push origin feature/sua-feature
```

### 7. Abrir Um Pull Request

- Vá para o repositório original
- Clique em "New Pull Request"
- Selecione sua branch
- Descreva as mudanças

---

## ✅ Checklist Antes de Contribuir

- [ ] Você fez fork do repositório?
- [ ] A branch está baseada em `main`?
- [ ] A mudança é mínima e focada?
- [ ] Você testou localmente?
- [ ] O código segue os padrões do projeto?
- [ ] Você adicionou testes?
- [ ] A documentação foi atualizada?
- [ ] Não há conflitos com a branch principal?

---

## 🎯 Padrões de Código

### JavaScript/React

```javascript
// ✅ BOM
export function ComponentName({ props }) {
  const handleClick = () => {
    // Ação
  }

  return (
    <div className="container">
      <button onClick={handleClick}>Click</button>
    </div>
  )
}

// ❌ RUIM
export const ComponentName = props => {
  function handleClick(){
    // Ação
  }
  return <div><button onClick={handleClick}>Click</button></div>
}
```

### Python

```python
# ✅ BOM
def process_agent(project_id, idea):
    """Processa a ideia com o agente especificado."""
    try:
        result = agent.process(idea)
        return result
    except Exception as e:
        logger.error(f"Erro: {e}")
        raise

# ❌ RUIM
def process_agent(id,idea):
    result = agent.process(idea)
    return result
```

### Padrões Gerais

- Use nomes descritivos para variáveis e funções
- Adicione comentários para lógica complexa
- Mantenha linhas com menos de 100 caracteres
- Use 2 espaços para indentação (JavaScript)
- Use 4 espaços para indentação (Python)

---

## 🧪 Testes

### Frontend

```bash
cd frontend
npm test
```

### Backend

```bash
cd backend
npm test
```

### Python

```python
python -m pytest tests/
```

### Coverage

```bash
npm run test:coverage  # Frontend
npm run test:coverage  # Backend
```

---

## 📝 Commits

### Formato de Mensagem

```
<tipo>: <descrição breve>

<descrição detalhada se necessário>
```

### Tipos Aceitos

- `feat`: Nova feature
- `fix`: Correção de bug
- `docs`: Mudanças na documentação
- `style`: Mudanças de formatação
- `refactor`: Refatoração de código
- `test`: Adição de testes
- `chore`: Tarefas de manutenção

### Exemplos

```
feat: adicionar validação de email

fix: corrigir bug na renderização de componente

docs: atualizar README com instruções de instalação

refactor: simplificar lógica do orchestrator

test: adicionar testes para ProjectManager
```

---

## 📚 Documentação

Ao adicionar uma nova feature:

1. **README.md**: Atualize com instruções se aplicável
2. **API.md**: Documente novos endpoints
3. **ARCHITECTURE.md**: Atualizar se mudou arquitetura
4. **Comentários no código**: Explique lógica complexa
5. **JSDoc/Docstrings**: Documente funções públicas

### Exemplo JSDoc

```javascript
/**
 * Gera um novo projeto baseado na ideia
 * @param {string} projectId - ID único do projeto
 * @param {string} idea - Descrição da ideia
 * @returns {Promise<Object>} Artefatos gerados
 * @throws {Error} Se erro na geração
 */
async function orchestrateProject(projectId, idea) {
  // Implementação
}
```

---

## 🔍 Revisão de Código

Seu PR será revisado por:
1. Verificação automática (linter, testes)
2. Revisão manual de código
3. Testes de funcionalidade

### Feedbacks Comuns

- **Mudanças Solicitadas**: Você será pedido para fazer ajustes
- **Aprovado**: Seu PR será mergeado
- **Bloqueado**: Há conflitos que precisam ser resolvidos

---

## 🐛 Reportar Bugs

### Informações Necessárias

1. **Título claro**: "Erro ao gerar projeto com ideia vazia"
2. **Descrição**: O que você tentou fazer?
3. **Passos para reproduzir**: 
   - 1. ...
   - 2. ...
   - 3. ...
4. **Comportamento esperado**: O que deveria acontecer?
5. **Comportamento atual**: O que acontece?
6. **Screenshots**: Se aplicável
7. **Ambiente**:
   - OS: Windows/Mac/Linux
   - Browser: Chrome/Firefox/Safari
   - Node: 18.x
   - Python: 3.x

### Template de Bug Report

```markdown
## Descrição
Descrição clara do bug

## Passos para Reproduzir
1. ...
2. ...
3. ...

## Comportamento Esperado
Descreva o que deveria acontecer

## Comportamento Atual
Descreva o que está acontecendo

## Ambiente
- OS: 
- Browser:
- Node.js:
- Python:

## Screenshots
[Anexe imagens se relevante]

## Logs
```
[Copie os logs relevantes aqui]
```
```

---

## 💡 Feature Requests

### Template

```markdown
## Descrição da Feature
Descrição clara e concisa

## Motivação
Por que essa feature seria útil?

## Implementação Proposta
Como você implementaria?

## Alternativas
Existem outras formas?

## Documentação Adicional
Links, referências
```

---

## 🧑‍💻 Development Setup

### Primeiro Contribuidor?

1. Leia [INSTALL.md](INSTALL.md)
2. Configure o ambiente local
3. Faça uma mudança simples (typo, documentação)
4. Envie seu primeiro PR

---

## 📞 Suporte

- 📧 Email: seu-email@example.com
- 💬 Discussions: Use GitHub Discussions
- ❓ Issues: Para bugs e features

---

## 📜 Licença

Ao contribuir, você concorda que suas contribuições serão licenciadas sob a MIT License.

---

**Obrigado por contribuir! 🙏**

---

**Última atualização**: Janeiro 2024
