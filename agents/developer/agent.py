# -*- coding: utf-8 -*-
import sys
import os

# Garantir UTF-8 para saída de caracteres acentuados
if sys.stdout.encoding != 'utf-8':
    sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf8', buffering=1)
if sys.stderr.encoding != 'utf-8':
    sys.stderr = open(sys.stderr.fileno(), mode='w', encoding='utf8', buffering=1)

"""
Developer Agent
Responsável por gerar a estrutura inicial do projeto
"""

from agents.developer.llm_service import generate_text_from_llm

class Developer:
    def __init__(self, project_id):
        self.project_id = project_id

    def process(self, idea, architecture):
        """Processa arquitetura e retorna structure de código documentada via IA"""
        
        prompt = f"""
        Atue como um Desenvolvedor Sênior.
        Crie uma documentação técnica detalhada da estrutura de código para o projeto:
        
        Ideia: "{idea}"
        Arquitetura: "{architecture}"
        
        Gere um Markdown contendo:
        # ESTRUTURA DE CÓDIGO
        ## Árvore de Arquivos Detalhada (Frontend e Backend)
        ## Modelos de Dados (Schemas)
        ## Definição dos Endpoints da API (Rotas, Métodos, Payloads)
        ## Exemplos de Código para os Controllers e Componentes principais
        """
        
        return generate_text_from_llm(prompt)
