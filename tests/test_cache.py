#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Test script to verify cache functionality
Testa se o sistema de cache está funcionando corretamente
"""

import sys
import os
import time
import json

# Add agents to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from agents.developer.llm_service import generate_text_from_llm, get_attributes_from_llm
from agents.developer.cache_service import get_cache

def test_cache_for_text_generation():
    """Test if cache works for text generation (generate_text_from_llm)"""
    print("\n" + "="*60)
    print("TEST 1: Cache for Text Generation")
    print("="*60)
    
    prompt = "Create a simple hello world program in Python."
    
    # First call - should hit LLM and then cache
    print("\n📍 First call (should hit LLM and cache result)...")
    start_time = time.time()
    result1 = generate_text_from_llm(prompt)
    elapsed1 = time.time() - start_time
    
    print(f"✅ First call completed in {elapsed1:.2f}s")
    print(f"Result preview: {result1[:100]}...")
    
    # Second call - should hit cache (much faster)
    print("\n📍 Second call (should hit CACHE)...")
    start_time = time.time()
    result2 = generate_text_from_llm(prompt)
    elapsed2 = time.time() - start_time
    
    print(f"✅ Second call completed in {elapsed2:.2f}s")
    print(f"Result preview: {result2[:100]}...")
    
    # Verify results are identical
    if result1 == result2:
        print("\n✅ PASS: Both results are identical (cache is working!)")
    else:
        print("\n❌ FAIL: Results differ (unexpected)")
    
    # Check speedup
    speedup = elapsed1 / elapsed2 if elapsed2 > 0 else float('inf')
    print(f"\n⚡ Speedup: {speedup:.1f}x faster on cache hit")
    
    if speedup > 5:
        print("✅ EXCELLENT: Cache provides significant speedup")
    else:
        print("⚠️  WARNING: Cache speedup is lower than expected")


def test_cache_for_attributes():
    """Test if cache works for attribute extraction (get_attributes_from_llm)"""
    print("\n" + "="*60)
    print("TEST 2: Cache for Attribute Extraction")
    print("="*60)
    
    idea = "A todo list application with tasks and priorities"
    
    # First call - should hit LLM and then cache
    print("\n📍 First call (should hit LLM and cache result)...")
    start_time = time.time()
    result1 = get_attributes_from_llm(idea)
    elapsed1 = time.time() - start_time
    
    print(f"✅ First call completed in {elapsed1:.2f}s")
    print(f"Result: {json.dumps(result1, indent=2, ensure_ascii=False)[:200]}...")
    
    # Second call - should hit cache (much faster)
    print("\n📍 Second call (should hit CACHE)...")
    start_time = time.time()
    result2 = get_attributes_from_llm(idea)
    elapsed2 = time.time() - start_time
    
    print(f"✅ Second call completed in {elapsed2:.2f}s")
    
    # Verify results are identical
    if result1 == result2:
        print("\n✅ PASS: Both results are identical (cache is working!)")
    else:
        print("\n❌ FAIL: Results differ (unexpected)")
    
    # Check speedup
    speedup = elapsed1 / elapsed2 if elapsed2 > 0 else float('inf')
    print(f"\n⚡ Speedup: {speedup:.1f}x faster on cache hit")


def show_cache_stats():
    """Display cache statistics"""
    print("\n" + "="*60)
    print("CACHE STATISTICS")
    print("="*60)
    
    try:
        cache = get_cache()
        stats = cache.stats()
        
        print(f"\n📊 Cache Stats:")
        print(f"  Total entries: {stats.get('total_entries', 0)}")
        print(f"  Total cache size: {stats.get('total_size_mb', 0):.2f} MB")
        print(f"  Total hits: {stats.get('total_hits', 0)}")
        print(f"  Average access count per entry: {stats.get('avg_access_count', 0):.1f}")
        
        print(f"\n📈 By Provider:")
        for provider, count in stats.get('by_provider', {}).items():
            print(f"  {provider}: {count} entries")
        
        print(f"\n🔧 By Model:")
        for model, count in stats.get('by_model', {}).items():
            print(f"  {model}: {count} entries")
    
    except Exception as e:
        print(f"⚠️  Error getting cache stats: {e}")


def clear_cache_for_testing():
    """Clear cache before testing"""
    print("\n🗑️  Clearing cache before test...")
    try:
        cache = get_cache()
        cache.clear(days=0)  # Clear all
        print("✅ Cache cleared")
    except Exception as e:
        print(f"⚠️  Error clearing cache: {e}")


if __name__ == "__main__":
    print("\n" + "="*60)
    print("CACHE FUNCTIONALITY TEST SUITE")
    print("="*60)
    
    # Show initial stats
    show_cache_stats()
    
    # Clear cache for clean test
    clear_cache_for_testing()
    
    # Run tests
    try:
        test_cache_for_text_generation()
        # test_cache_for_attributes()  # Optional - commented to save API calls
    except Exception as e:
        print(f"\n❌ Test error: {e}")
        import traceback
        traceback.print_exc()
    
    # Show final stats
    show_cache_stats()
    
    print("\n" + "="*60)
    print("TEST SUITE COMPLETED")
    print("="*60)
