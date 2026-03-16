# -*- coding: utf-8 -*-
import sys
import os

# Garantir UTF-8 para saída de caracteres acentuados
if sys.stdout.encoding != 'utf-8':
    sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf8', buffering=1)
if sys.stderr.encoding != 'utf-8':
    sys.stderr = open(sys.stderr.fileno(), mode='w', encoding='utf8', buffering=1)

"""
Architect Agent
Responsável por definir a arquitetura técnica e stack do projeto
"""

from agents.developer.llm_service import generate_text_from_llm

class Architect:
    def __init__(self, project_id):
        self.project_id = project_id

    def process(self, idea, requirements):
        """Processa requisitos e retorna arquitetura via IA"""
        
        prompt = f"""
        Atue como um Arquiteto de Software Chefe.
        Defina a arquitetura técnica completa para o seguinte projeto:
        
        Ideia: "{idea}"
        
        Requisitos:
        {requirements}
        
        Gere um documento Markdown cobrindo:
        # ARQUITETURA DO PROJETO
        ## Visão Geral e Stack Tecnológico (Frontend, Backend, Database)
        ## Diagrama de Arquitetura (em texto/ASCII ou Mermaid)
        ## Estrutura de Diretórios Sugerida
        ## Padrões de Design (MVC, Repository, etc)
        ## Estratégia de Deploy e Segurança
        
        Recomende tecnologias modernas (React, Node.js, etc) mas adapte se a ideia pedir algo específico.
        """
        
        return generate_text_from_llm(prompt)
