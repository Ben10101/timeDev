# -*- coding: utf-8 -*-
"""
Factory Orchestrator
Coordena o fluxo de execução dos agentes
"""

import json
import sys
import os
from datetime import datetime

# Configurar UTF-8 para output
if sys.stdout.encoding != 'utf-8':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Obter o diretório do script atual
script_dir = os.path.dirname(os.path.abspath(__file__))
# Ir um nível acima (raiz do projeto)
project_root = os.path.dirname(script_dir)

# Adicionar o diretório raiz ao path
sys.path.insert(0, project_root)

print(f"📍 Script dir: {script_dir}", file=sys.stderr)
print(f"📍 Project root: {project_root}", file=sys.stderr)

from agents.project_manager.agent import ProjectManager
from agents.requirements_analyst.agent import RequirementsAnalyst
from agents.architect.agent import Architect
from agents.developer.agent_new import Developer
from agents.qa_engineer.agent import QAEngineer
from projectBuilder import ProjectBuilder


class Factory:
    """Orquestra a fábrica de software"""

    def __init__(self, project_id, idea):
        self.project_id = project_id
        self.idea = idea
        self.results = {}

    def run(self):
        """Executa o pipeline completo de geração do projeto"""
        
        print(f"[FACTORY] Iniciando factory de software: {self.project_id}", file=sys.stderr)
        print(f"[FACTORY] Ideia: {self.idea}", file=sys.stderr)
        print("-" * 60, file=sys.stderr)

        try:
            # 1. Project Manager - Gera backlog
            print("\n[1/5] Project Manager - Gerando backlog...", file=sys.stderr)
            pm = ProjectManager(self.project_id)
            backlog = pm.process(self.idea)
            self.results['backlog'] = backlog
            print("[OK] Backlog gerado com sucesso!", file=sys.stderr)

            # 2. Requirements Analyst - Gera requisitos
            print("\n[2/5] Requirements Analyst - Analisando requisitos...", file=sys.stderr)
            ra = RequirementsAnalyst(self.project_id)
            requirements = ra.process(self.idea, backlog)
            self.results['requirements'] = requirements
            print("[OK] Requisitos analisados com sucesso!", file=sys.stderr)

            # 3. Architect - Define arquitetura
            print("\n[3/5] Architect - Definindo arquitetura...", file=sys.stderr)
            arc = Architect(self.project_id)
            architecture = arc.process(self.idea, requirements)
            self.results['architecture'] = architecture
            print("[OK] Arquitetura definida com sucesso!", file=sys.stderr)

            # 4. Developer - Gera código
            print("\n[4/5] Developer - Gerando código...", file=sys.stderr)
            dev = Developer(self.project_id)
            dev_result = dev.process(self.idea, architecture)
            code = dev_result['code']
            primary_entity = dev_result['primary_entity']
            self.results['code'] = code
            self.results['primary_entity'] = primary_entity
            print("[OK] Código gerado com sucesso!", file=sys.stderr)

            # 5. QA Engineer - Gera testes
            print("\n[5/5] QA Engineer - Gerando testes...", file=sys.stderr)
            qa = QAEngineer(self.project_id)
            tests = qa.process(self.idea, code)
            self.results['tests'] = tests
            print("[OK] Testes gerados com sucesso!", file=sys.stderr)

            # 6. ProjectBuilder - Cria arquivos reais
            print("\n[6/6] ProjectBuilder - Criando projeto real...", file=sys.stderr)
            builder = ProjectBuilder(self.project_id)
            project_path = builder.create_project(
                self.idea,
                backlog,
                requirements,
                architecture,
                primary_entity
            )
            self.results['project_path'] = project_path
            print("[OK] Projeto real criado com sucesso!", file=sys.stderr)

            print("\n" + "=" * 60, file=sys.stderr)
            print("[SUCCESS] Projeto completo gerado com sucesso!", file=sys.stderr)
            print("=" * 60, file=sys.stderr)

            return self.results

        except Exception as e:
            print(f"\n[ERROR] Erro ao executar factory: {str(e)}", file=sys.stderr)
            raise

    def save_artifacts(self):
        """Salva os artefatos em arquivos"""
        
        project_dir = os.path.join(project_root, f"outputs/projects/{self.project_id}")
        
        if not os.path.exists(project_dir):
            os.makedirs(project_dir, exist_ok=True)

        # Salvar cada artefato em um arquivo
        artifacts = {
            'backlog.md': self.results.get('backlog', ''),
            'requirements.md': self.results.get('requirements', ''),
            'architecture.md': self.results.get('architecture', ''),
            'code_structure.md': self.results.get('code', ''),
            'tests.md': self.results.get('tests', ''),
        }

        for filename, content in artifacts.items():
            filepath = os.path.join(project_dir, filename)
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"[SAVE] Salvo: {filepath}", file=sys.stderr)

        # Salvar metadados do projeto
        metadata = {
            'project_id': self.project_id,
            'idea': self.idea,
            'timestamp': datetime.now().isoformat(),
            'created_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }

        metadata_path = os.path.join(project_dir, 'metadata.json')
        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)
        print(f"[SAVE] Metadados salvos: {metadata_path}", file=sys.stderr)


def main():
    """Função principal para executar como script"""
    
    if len(sys.argv) < 3:
        print("Uso: python factory.py <project_id> <idea>", file=sys.stderr)
        sys.exit(1)

    project_id = sys.argv[1]
    idea = ' '.join(sys.argv[2:])

    # Criar e executar a factory
    factory = Factory(project_id, idea)
    results = factory.run()
    
    # Salvar artefatos
    factory.save_artifacts()

    # Retornar resultados como JSON (para stdout apenas)
    output = {
        'projectId': project_id,
        'timestamp': datetime.now().isoformat(),
        **results
    }

    print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
