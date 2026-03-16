# -*- coding: utf-8 -*-
import sys
import os

# Garantir UTF-8 para saída (evitar reabrir handles no Windows, o que pode causar crash em processos com pipes)
try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

"""
QA Engineer Agent
Responsável por gerar cenários de teste
"""

from agents.developer.llm_service import generate_text_from_llm

class QAEngineer:
    def __init__(self, project_id):
        self.project_id = project_id

    def process(self, idea, code_structure):
        """Processa estrutura de código e retorna testes via IA"""
        
        prompt = f"""
        Atue como um Engenheiro de QA (Quality Assurance) Sênior.
        Crie um Plano de Testes completo para o seguinte projeto:
        
        Ideia: "{idea}"
        Estrutura de Código: "{code_structure}"
        
        Gere um documento Markdown contendo:
        # PLANO DE TESTES E QA
        ## Estratégia de Testes (Unitários, Integração, E2E)
        ## Cenários de Teste (Test Cases) detalhados
        ## Dados de Teste Sugeridos
        ## Métricas de Qualidade
        """
        
        return generate_text_from_llm(prompt)
