#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Full pipeline cache test - Tests the entire project generation pipeline twice
with the same idea to measure cache impact
"""

import sys
import os
import time
import json
from datetime import datetime

# Add workspace to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Ensure UTF-8 encoding
if sys.stdout.encoding != 'utf-8':
    sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf8', buffering=1)

from agents.project_manager.agent import ProjectManager
from agents.requirements_analyst.agent import RequirementsAnalyst
from agents.architect.agent import Architect
from agents.developer.agent import Developer
from agents.qa_engineer.agent import QAEngineer
from agents.developer.cache_service import get_cache

def clear_cache():
    """Clear all cache before testing"""
    print("\n🗑️  Clearing cache...")
    try:
        cache = get_cache()
        cache.clear(days=0)
        print("✅ Cache cleared successfully")
    except Exception as e:
        print(f"⚠️  Could not clear cache: {e}")


def show_cache_stats(title="Cache Statistics"):
    """Display current cache statistics"""
    print(f"\n📊 {title}")
    print("-" * 50)
    try:
        cache = get_cache()
        stats = cache.stats()
        
        print(f"Total entries: {stats.get('total_entries', 0)}")
        print(f"Total cache size: {stats.get('total_size_mb', 0):.2f} MB")
        print(f"Total hits: {stats.get('total_hits', 0)}")
        
        if stats.get('by_provider'):
            print("\nBy Provider:")
            for provider, count in stats.get('by_provider', {}).items():
                print(f"  • {provider}: {count} entries")
    
    except Exception as e:
        print(f"⚠️  Error: {e}")


def test_full_pipeline(project_idea, run_number):
    """Run the full project generation pipeline"""
    print(f"\n{'='*70}")
    print(f"PIPELINE RUN #{run_number}: {project_idea}")
    print(f"{'='*70}")
    print(f"⏱️  Started at: {datetime.now().strftime('%H:%M:%S')}")
    
    start_total = time.time()
    
    try:
        # 1. Project Manager
        print("\n📋 [1/5] Project Manager - Generating Backlog & Épicos...")
        pm = ProjectManager("PROJECT_001")
        start = time.time()
        backlog = pm.process(project_idea)
        elapsed = time.time() - start
        print(f"✅ Completed in {elapsed:.2f}s (~{len(backlog)} chars)")
        
        # 2. Requirements Analyst
        print("\n📋 [2/5] Requirements Analyst - Generating Requirements...")
        ra = RequirementsAnalyst("PROJECT_001")
        start = time.time()
        requirements = ra.process(project_idea, backlog)
        elapsed = time.time() - start
        print(f"✅ Completed in {elapsed:.2f}s (~{len(requirements)} chars)")
        
        # 3. Architect
        print("\n📋 [3/5] Architect - Generating Architecture...")
        arch = Architect("PROJECT_001")
        start = time.time()
        architecture = arch.process(project_idea, requirements)
        elapsed = time.time() - start
        print(f"✅ Completed in {elapsed:.2f}s (~{len(architecture)} chars)")
        
        # 4. Developer
        print("\n📋 [4/5] Developer - Generating Code & Attributes...")
        dev = Developer("PROJECT_001")
        start = time.time()
        code, attributes, backend = dev.process(project_idea)
        elapsed = time.time() - start
        print(f"✅ Completed in {elapsed:.2f}s (Generated {len(attributes)} attributes & backend)")
        
        # 5. QA Engineer
        print("\n📋 [5/5] QA Engineer - Generating Test Plan...")
        qa = QAEngineer("PROJECT_001")
        start = time.time()
        tests = qa.process(project_idea, code)
        elapsed = time.time() - start
        print(f"✅ Completed in {elapsed:.2f}s (~{len(tests)} chars)")
        
        total_elapsed = time.time() - start_total
        
        print(f"\n{'='*70}")
        print(f"✅ PIPELINE COMPLETED SUCCESSFULLY")
        print(f"⏱️  Finished at: {datetime.now().strftime('%H:%M:%S')}")
        print(f"⏱️  Total time: {total_elapsed:.2f}s ({total_elapsed/60:.1f} min)")
        print(f"{'='*70}")
        
        return total_elapsed
        
    except Exception as e:
        print(f"\n❌ ERROR during pipeline: {e}")
        import traceback
        traceback.print_exc()
        return None


def main():
    print("\n" + "="*70)
    print("FULL PIPELINE CACHE EFFECTIVENESS TEST")
    print("="*70)
    print("""
This test runs the complete project generation pipeline twice with the same
idea and measures the total time. The second run should be significantly
faster as LLM responses are retrieved from cache.

Pipeline: ProjectManager -> RequirementsAnalyst -> Architect -> Developer -> QAEngineer
""")
    
    project_idea = "Sistema de gerenciamento de tarefas com prioridades e categorias"
    
    # First run - Cache is empty
    print("\n🔄 RUN 1: Building cache from scratch...")
    show_cache_stats("Initial Cache State")
    time1 = test_full_pipeline(project_idea, 1)
    show_cache_stats("After Run 1")
    
    # Second run - Cache should be hit
    print("\n🔄 RUN 2: Using cached responses...")
    print("(Same project idea - should hit cache on all agents)")
    time2 = test_full_pipeline(project_idea, 2)
    show_cache_stats("After Run 2")
    
    # Summary
    if time1 and time2:
        print("\n" + "="*70)
        print("📊 PERFORMANCE SUMMARY")
        print("="*70)
        print(f"Run 1 (no cache):  {time1:.2f}s")
        print(f"Run 2 (w/ cache):  {time2:.2f}s")
        speedup = time1 / time2
        time_saved = time1 - time2
        print(f"\n⚡ Speedup: {speedup:.1f}x faster")
        print(f"⏱️  Time saved: {time_saved:.2f}s")
        print(f"📈 Improvement: {((time1-time2)/time1*100):.0f}%")
        
        if speedup > 3:
            print("\n✅ EXCELLENT: Cache is working very effectively!")
        elif speedup > 1.5:
            print("\n✅ GOOD: Cache is providing meaningful speedup")
        else:
            print("\n⚠️  Cache speedup is lower than expected")
        
        print("="*70)


if __name__ == "__main__":
    clear_cache()
    main()
