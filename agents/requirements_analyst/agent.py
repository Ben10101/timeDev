# -*- coding: utf-8 -*-
import sys
import os
from datetime import datetime

# Garantir UTF-8 para saída
try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

"""
Requirements Analyst Agent
Refinamento detalhado de User Story (nível pronto para desenvolvimento)
"""

from agents.developer.llm_service import generate_text_from_llm

class RequirementsAnalyst:
    def __init__(self, project_id):
        self.project_id = project_id
    
    def process(self, idea, backlog):
        """Refina UMA única user story em requisitos claros e implementáveis"""
        
        prompt = f"""
Você é um Analista de Requisitos Sênior especializado em transformar User Stories em requisitos funcionais claros, completos e sem ambiguidades.

Sua única missão é refinar requisitos para implementação.

⚠️ REGRAS CRÍTICAS:
- Você está refinando apenas UMA única User Story
- NÃO expanda escopo
- NÃO crie novas funcionalidades fora da história
- NÃO invente módulos, dashboards, relatórios ou integrações
- Seja direto, técnico e implementável
- Elimine qualquer ambiguidade

---

📥 ENTRADA

User Story:
"{idea}"

Backlog (apenas contexto, NÃO expandir escopo):
{backlog}

---

🧠 TAREFA

Refinar a User Story em requisitos completos seguindo EXATAMENTE a estrutura abaixo:

---

# 📌 REFINAMENTO DE REQUISITO

## 🧾 User Story Refinada
(Reescreva a história de forma clara, específica e objetiva)

---

## ⚙️ Requisitos Funcionais

### RF-01
- Descrição:
- Atores:
- Entradas:
- Processamento:
- Saídas:

(Adicionar quantos RFs forem necessários, sem extrapolar escopo)

---

## 🔄 Fluxo Principal
(Passo a passo numerado do fluxo principal)

---

## 🔀 Fluxos Alternativos
(Variações válidas do fluxo principal)

---

## ❌ Fluxos de Exceção
(Erros e comportamentos do sistema)

---

## 📏 Regras de Negócio
(Lista numerada, clara e sem ambiguidade)

---

## ✅ Critérios de Aceite (BDD)

DADO que ...
QUANDO ...
ENTÃO ...

(Incluir cenários positivos, negativos e edge cases)

---

⚠️ DIRETRIZES FINAIS:
- Seja extremamente claro e técnico
- Nada pode ficar implícito
- Escreva como se um desenvolvedor fosse implementar diretamente
- Se faltar informação, assuma o cenário mais comum e sinalize
"""

        return generate_text_from_llm(prompt)