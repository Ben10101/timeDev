# Testes do AI Software Factory

## Como testar

### Opcao 1: teste direto dos agentes
```bash
python test_agents_direct.py
```

### Opcao 2: atalho no Windows
```bash
run_test.bat
```

### Opcao 3: teste completo da aplicacao
```bash
# Terminal 1
cd backend
npm install
npm run dev

# Terminal 2
cd frontend
npm install
npm run dev
```

Abra `http://localhost:5173`.

## Arquivos mantidos

- `test_agents_direct.py`
- `run_test.bat`
- `test_cache.py`
- `test_pipeline_cache.py`
- `test_ollama.py`
- `test_ollama_full.py`
- `test_qa_engineer.py`
- `test_architect.py`

## Observacao

Scripts de teste avulsos e wrappers legados foram removidos para reduzir ruido no repositorio.
