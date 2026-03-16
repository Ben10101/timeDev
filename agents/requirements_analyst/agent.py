# -*- coding: utf-8 -*-
import sys
import os
from datetime import datetime

# Garantir UTF-8 para saída de caracteres acentuados
if sys.stdout.encoding != 'utf-8':
    sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf8', buffering=1)
if sys.stderr.encoding != 'utf-8':
    sys.stderr = open(sys.stderr.fileno(), mode='w', encoding='utf8', buffering=1)

"""
Requirements Analyst Agent
Análise detalhada de requisitos funcionais, não-funcionais e casos de uso
"""

from agents.developer.llm_service import generate_text_from_llm

class RequirementsAnalyst:
    def __init__(self, project_id):
        self.project_id = project_id
    
    def process(self, idea, backlog):
        """Processa idea e backlog para gerar requisitos detalhados via IA"""
        
        prompt = f"""
        Atue como um Analista de Requisitos Sênior.
        Baseado na ideia e no backlog abaixo, crie uma Especificação de Requisitos detalhada.
        
        Ideia: "{idea}"
        
        Backlog Existente:
        {backlog}
        
        Gere o documento em formato Markdown contendo:
        # 📋 ESPECIFICAÇÃO DE REQUISITOS
        ## ✅ Requisitos Funcionais (Liste os módulos e funcionalidades detalhadas)
        ## 🛡️ Requisitos Não-Funcionais (Performance, Segurança, Usabilidade)
        ## 📊 Casos de Uso Principais (Pelo menos 2 fluxos completos)
        
        Seja detalhista e técnico.
        """
        
        return generate_text_from_llm(prompt)
