#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Factory Otimizado - Executa agentes em paralelo para melhor performance
"""

import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

# Garantir UTF-8
if sys.stdout.encoding != 'utf-8':
    sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf8', buffering=1)

# Setup paths
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
sys.path.insert(0, os.path.join(project_root, 'orchestrator'))
sys.path.insert(0, os.path.join(project_root, 'agents'))

from dotenv import load_dotenv
load_dotenv()

from agents.project_manager.agent import ProjectManager
from agents.requirements_analyst.agent import RequirementsAnalyst
from agents.architect.agent import Architect
from agents.developer.agent import Developer
from agents.qa_engineer.agent import QAEngineer
from orchestrator.projectBuilder import ProjectBuilder

class OptimizedSoftwareFactory:
    """
    Factory otimizado que executa agentes em paralelo quando possível
    """
    
    def __init__(self, project_id, idea):
        self.project_id = project_id
        self.idea = idea
        self.results = {}
        self.timing = {}
    
    def run_parallel(self):
        """
        Executa agentes em paralelo para melhor performance.
        
        Pipeline:
        1. ProjectManager (sequencial - base)
        2. Depois em paralelo:
           - RequirementsAnalyst (usa backlog)
           - Architect (usa backlog)
        3. Depois em paralelo:
           - Developer (usa requirements)
           - QAEngineer (usa architecture)
        4. ProjectBuilder (constrói projeto real)
        """
        
        print(f"\n🚀 AI Software Factory Otimizado")
        print(f"   Project ID: {self.project_id}")
        print(f"   Ideia: {self.idea}")
        print(f"   Modo: PARALELO (mais rápido)\n")
        print("="*80 + "\n")
        
        start_total = time.time()
        
        # FASE 1: ProjectManager (necessário primeiro)
        print("⏱️  [FASE 1/3] ProjectManager...", end=" ", flush=True)
        start = time.time()
        try:
            pm = ProjectManager(self.project_id)
            self.results['backlog'] = pm.process(self.idea)
            elapsed = time.time() - start
            self.timing['backlog'] = elapsed
            print(f"✅ {elapsed:.2f}s")
        except Exception as e:
            print(f"❌ Erro: {e}")
            self.results['backlog'] = ""
        
        # FASE 2: RequirementsAnalyst e Architect em paralelo
        print("⏱️  [FASE 2/3] RequirementsAnalyst + Architect (paralelo)...", end=" ", flush=True)
        start = time.time()
        
        with ThreadPoolExecutor(max_workers=2) as executor:
            futures = {}
            
            # Submeter tarefas
            ra = RequirementsAnalyst(self.project_id)
            futures['requirements'] = executor.submit(
                ra.process, 
                self.idea, 
                self.results.get('backlog', '')
            )
            
            arc = Architect(self.project_id)
            futures['architecture'] = executor.submit(
                arc.process,
                self.idea,
                self.results.get('backlog', '')
            )
            
            # Coletar resultados
            for key, future in futures.items():
                try:
                    self.results[key] = future.result()
                except Exception as e:
                    print(f"\n   ❌ Erro em {key}: {e}")
                    self.results[key] = ""
        
        elapsed = time.time() - start
        self.timing['requirements_architecture'] = elapsed
        print(f"✅ {elapsed:.2f}s")
        
        # FASE 3: Developer e QAEngineer em paralelo
        print("⏱️  [FASE 3/3] Developer + QAEngineer (paralelo)...", end=" ", flush=True)
        start = time.time()
        
        with ThreadPoolExecutor(max_workers=2) as executor:
            futures = {}
            
            dev = Developer(self.project_id)
            futures['code'] = executor.submit(
                dev.process,
                self.idea,
                self.results.get('architecture', '')
            )
            
            qa = QAEngineer(self.project_id)
            futures['tests'] = executor.submit(
                qa.process,
                self.idea,
                self.results.get('code', '')
            )
            
            # Coletar resultados
            for key, future in futures.items():
                try:
                    self.results[key] = future.result()
                except Exception as e:
                    print(f"\n   ❌ Erro em {key}: {e}")
                    self.results[key] = ""
        
        elapsed = time.time() - start
        self.timing['code_tests'] = elapsed
        print(f"✅ {elapsed:.2f}s")
        
        # FASE 4: ProjectBuilder (cria arquivos reais)
        print("⏱️  [FASE 4/4] ProjectBuilder (criando projeto)...", end=" ", flush=True)
        start = time.time()
        try:
            builder = ProjectBuilder(self.project_id)
            builder.create_project(
                self.idea,
                self.results.get('backlog', ''),
                self.results.get('requirements', ''),
                self.results.get('architecture', '')
            )
            elapsed = time.time() - start
            self.timing['project_builder'] = elapsed
            print(f"✅ {elapsed:.2f}s")
        except Exception as e:
            print(f"❌ Erro: {e}")
        
        # RESUMO
        total_elapsed = time.time() - start_total
        
        print("\n" + "="*80)
        print(f"\n✅ PROJETO GERADO COM SUCESSO!\n")
        
        print("⏱️  TIMING:\n")
        for phase, elapsed in self.timing.items():
            print(f"   {phase:30} {elapsed:7.2f}s")
        
        print(f"\n   {'TOTAL':30} {total_elapsed:7.2f}s\n")
        
        # Estimativa de tempo sequencial
        sequential_time = sum(self.timing.values())
        speedup = sequential_time / total_elapsed if total_elapsed > 0 else 1
        
        print(f"📊 Performance:")
        print(f"   Tempo sequencial estimado: {sequential_time:.2f}s")
        print(f"   Tempo paralelo real:       {total_elapsed:.2f}s")
        print(f"   Speedup:                   {speedup:.2f}x\n")
        
        print("="*80 + "\n")
        
        return self.results

def main():
    """Teste do factory otimizado"""
    project_id = f"optimized-test-{int(time.time())}"
    idea = "Plataforma de e-learning com cursos, vídeos, exercícios e certificados"
    
    factory = OptimizedSoftwareFactory(project_id, idea)
    results = factory.run_parallel()
    
    print(f"✅ Projeto '{project_id}' gerado com sucesso!")

if __name__ == "__main__":
    main()
