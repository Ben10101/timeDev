ça p# Testes do Aligna

## Como testar

### Opcao 1: teste direto dos agentes
```bash
python tests/test_agents_direct.py
```

### Opcao 2: atalho no Windows
```bash
scripts/windows/run_test.bat
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

- `tests/test_agents_direct.py`
- `scripts/windows/run_test.bat`
- `tests/test_cache.py`
- `tests/test_pipeline_cache.py`
- `tests/test_ollama.py`
- `tests/test_ollama_full.py`
- `tests/test_qa_engineer.py`
- `tests/test_architect.py`

## Observacao

Scripts de teste avulsos e wrappers legados foram removidos para reduzir ruido no repositorio.
