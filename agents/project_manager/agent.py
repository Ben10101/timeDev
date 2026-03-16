# -*- coding: utf-8 -*-
import sys
import os

# Garantir UTF-8 para saída de caracteres acentuados
if sys.stdout.encoding != 'utf-8':
    sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf8', buffering=1)
if sys.stderr.encoding != 'utf-8':
    sys.stderr = open(sys.stderr.fileno(), mode='w', encoding='utf8', buffering=1)

"""
Project Manager Agent
Responsável por gerar o backlog e épicos do projeto
Análise inteligente da ideia para criar backlog contextualizado
"""

from agents.developer.llm_service import generate_text_from_llm

class ProjectManager:

    def __init__(self, project_id):
        self.project_id = project_id

    def process(self, idea):
        """Processa a ideia e retorna o backlog usando a IA"""
        
        prompt = f"""
        Atue como um Gerente de Projetos Agile Sênior (Project Manager).
        Crie um Product Backlog detalhado e profissional para o seguinte projeto:
        
        ID do Projeto: {self.project_id}
        Descrição da Ideia: "{idea}"
        
        Estrutura da Resposta (Markdown):
        # 📋 BACKLOG DO PROJETO: [Nome do Projeto]
        ## 🎯 Visão Geral
        ## 📦 Épicos (Pelo menos 9 épicos relevantes para o negócio)
        ## 👤 Histórias de Usuário (Pelo menos 15 User Stories detalhadas)
        ## ✅ Tarefas Técnicas Iniciais
        
        Seja criativo e especifique funcionalidades que façam sentido para este tipo de software.
        """

        return generate_text_from_llm(prompt)
