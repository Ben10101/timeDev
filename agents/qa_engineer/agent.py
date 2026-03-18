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
        Crie um Plano de Testes completo, profissional, crítico e detalhista para o seguinte projeto:

        Ideia: "{idea}"
        Estrutura de Código: "{code_structure}"

        Gere um documento Markdown em português contendo obrigatoriamente:

        1. **Estratégia de Testes**
        Inclua abordagem para testes unitários, integração, API, UI e E2E.

        2. **Dados de Teste Sugeridos**
        Liste dados válidos, inválidos, limites, massa para erro e cenários de conectividade.

        3. **Métricas de Qualidade**
        Inclua cobertura, criticidade, rastreabilidade, severidade e riscos.

        4. **Cenários de Testes (Test Scenarios)**
        Descreva situações de uso ponta a ponta. Inclua obrigatoriamente:
        - 5 Cenários de "Caminho Feliz" (Fluxo ideal).
        - 5 Cenários de "Caminho de Exceção" (Mensagens de erro, falta de conectividade ou inputs inválidos).

        5. **Casos de Teste Funcionais**
        Seja técnico. Para cada item, estruture em:
        - Ação: O que o usuário faz.
        - Resultado Esperado: O comportamento exato do sistema, como mudança de cor, carregamento de API, redirecionamento, mensagem de erro, persistência ou bloqueio da ação.

        6. **Análise de Usabilidade e Acessibilidade (Heurísticas)**
        Divida obrigatoriamente em três pilares:
        - Heurísticas de Nielsen: visibilidade do status, prevenção de erros e eficiência de uso.
        - Leis de UX: Lei de Fitts, Lei de Miller e Lei de Jakob.
        - Acessibilidade (WCAG): contraste de cores com relação mínima 4.5:1, tamanho das fontes para legibilidade e áreas de toque com mínimo de 44x44px.

        Formatação da resposta:
        - Use listas numeradas com títulos em negrito para os itens.
        - Mantenha um tom profissional, crítico e detalhista.
        - Não omita nenhum dos itens 4, 5 e 6.
        """
        
        return generate_text_from_llm(prompt)
