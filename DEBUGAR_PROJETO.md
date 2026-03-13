# 🔍 Debug: Encontrando Projetos Gerados

## ❌ Problema
Você gerou um projeto, mas não consegue encontrar a pasta

## ✅ Solução Rápida - 3 Passos

### Passo 1: Abra Explorador de Arquivos
```
Windows + E
```

### Passo 2: Copie e Cole Este Caminho
```
C:\Users\bleao\ai-software-factory\outputs\projects
```

### Passo 3: Pressione Enter
```
Você deve ver as pastas dos seus projetos
```

---

## 🔧 Se Ainda Não Funcionar

### Opção A: Teste no Terminal
```bash
cd C:\Users\bleao\ai-software-factory
dir outputs
dir outputs\projects
```

### Opção B: Execute o Verificador
```bash
python check_projects.py
```

Isso vai mostrar:
- ✅ Se a pasta existe
- ✅ Quantos projetos foram criados
- ✅ A estrutura de cada projeto

### Opção C: Procure por ID Específico
Se você tem o ID do projeto (ex: `e518a70e-8961-450e-97a8-2e146b7410c9`):

```bash
cd C:\Users\bleao\ai-software-factory\outputs\projects
dir e518a70e-8961-450e-97a8-2e146b7410c9
```

---

## 📊 O Que Esperar

Cada projeto deve ter esta estrutura:
```
seu-projeto-id/
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.js
├── backend/
│   ├── src/
│   ├── package.json
│   └── ...
├── docs/
│   ├── backlog.md
│   ├── requirements.md
│   └── architecture.md
├── README.md
└── metadata.json
```

---

## 💡 Dicas

1. **Seu ID do projeto aparece na página de resultados** (copie e procure por ele)

2. **A rota dos projetos SEMPRE é:**
   ```
   C:\Users\bleao\ai-software-factory\outputs\projects\
   ```

3. **Se criou projeto, o arquivo deve estar lá**
   - Se não está = erro no backend
   - Verifique os logs do backend

---

## 🆘 Última Opção: Procure Tudo

```bash
cd C:\
cd /d C:\Users\bleao
for /r %i in (*e518a70e-8961-450e-97a8*) do @echo %i
```

Isso procura pelo ID do projeto em todo o computador.

---

**Precisa de mais ajuda? Execute `python check_projects.py`** ✨
