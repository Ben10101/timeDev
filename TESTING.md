# 🧪 Testes do AI Software Factory

## Correções Aplicadas

### 1. ✅ Logs Separados (factory.py)
**Problema**: Logs de debug estavam misturados com o JSON no stdout
**Solução**: Redirected todos os `print()` de log para `file=sys.stderr`
**Impacto**: JSON agora é enviado puro para stdout, fácil de parser no Node.js

### 2. ✅ Bug de Interpolação (Developer e QAEngineer)
**Problema**: `{{self.project_id}}` estava escaping a interpolação f-string
**Solução**: Corrigido para `{self.project_id}`
**Impacto**: project_id agora aparece corretamente no output

### 3. ✅ Melhor Logging (orchestratorService.js)
**Problema**: Se JSON parsing falhava, error era silencioso
**Solução**: Adicionado `console.log()` detalhados para debug
**Impacto**: Agora conseguimos ver exatamente o que está sendo retornado

---

## Como Testar

### Opção 1: Teste Direto (Python puro, sem Node.js)
```bash
python test_agents_direct.py
```
Isto testa cada agente diretamente sem passar pela factory.py

### Opção 2: Teste via Windows Batch
```bash
run_test.bat
```
Double-click no arquivo para rodar teste em janela CMD

### Opção 3: Teste Backend (Node.js)
```bash
node test_backend_direct.js
```
Isto testa a integração completa com o orchestrator do Node.js

### Opção 4: Teste Full (Frontend + Backend)
```bash
# Terminal 1 - Backend
cd backend
npm install  # if needed
npm start

# Terminal 2 - Frontend
cd frontend
npm install  # if needed  
npm run dev
```

Open `http://localhost:5173` and test the form

---

## O Que Esperar

Cada opção deve mostrar aproximadamente:

```
[1/5] Backlog:       ~2000+ caracteres
[2/5] Requirements:  ~1500+ caracteres
[3/5] Architecture:  ~2000+ caracteres
[4/5] Code:          ~1500+ caracteres
[5/5] Tests:         ~1500+ caracteres
```

Se qualquer seção aparecer vazia ou com menos de 500 caracteres, há um problema!

---

## Files Criados para Teste

- `test_agents_direct.py` - Testa agentes Python diretamente
- `test_backend_direct.js` - Testa orchestrator via Node.js
- `run_test.bat` - Batch script para rodar testes no Windows
- `test_factory_node.js` - Testa factory.py via Node spawn

---

## Status Atual

| Componente | Status | Nota |
|-----------|--------|------|
| ProjectManager | ✅ Works | Backlog gerado com sucesso |
| RequirementsAnalyst | ✅ Fixed | Corrigido stderr, agora deveria gerar conteúdo |
| Architect | ✅ Fixed | Logs separados, conteúdo deveria aparecer |
| Developer | ✅ Fixed | Corrigido bug de escape em f-string |
| QAEngineer | ✅ Fixed | Corrigido bug de escape em f-string |
| Backend API | ✅ Works | Express servidor respondendo |
| Frontend | ✅ Works | React app carregando |

---

## Próximos Passos se Ainda Não Funcionar

1. Execute `test_agents_direct.py` para ver output exato de cada agente
2. Verifique se há erros em stderr
3. Procure por exceções nos arquivos dos agentes
4. Verifique tamanho de cada variável retornada

