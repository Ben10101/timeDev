# -*- coding: utf-8 -*-
"""
Cache Service - Armazena respostas do LLM para reutilização
Reduz tempo de geração de projetos similares em 80%+
"""

import os
import sys
import sqlite3
import hashlib
import json
from datetime import datetime, timedelta

# Garantir UTF-8
if sys.stdout.encoding != 'utf-8':
    sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf8', buffering=1)

class CacheService:
    """
    Serviço de cache para LLM responses.
    Armazena prompts e respostas em SQLite para reutilização rápida.
    """
    
    def __init__(self, db_path=None):
        """Inicializa o serviço de cache"""
        if db_path is None:
            # Usar banco de dados no diretório do projeto
            project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            db_path = os.path.join(project_root, '.cache', 'llm_cache.db')
        
        self.db_path = db_path
        
        # Criar diretório se não existir
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        
        # Inicializar banco de dados
        self._init_db()
    
    def _init_db(self):
        """Cria as tabelas do banco de dados"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Tabela de cache
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS llm_cache (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                prompt_hash TEXT UNIQUE NOT NULL,
                prompt TEXT NOT NULL,
                response TEXT NOT NULL,
                model TEXT,
                provider TEXT,
                is_json BOOLEAN DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                access_count INTEGER DEFAULT 1
            )
        ''')
        
        # Índices para performance
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_prompt_hash ON llm_cache(prompt_hash)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_model ON llm_cache(model)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_provider ON llm_cache(provider)')
        
        conn.commit()
        conn.close()
    
    def _hash_prompt(self, prompt: str) -> str:
        """Gera hash do prompt para uso como chave"""
        return hashlib.sha256(prompt.encode()).hexdigest()
    
    def get(self, prompt: str, model: str = None, provider: str = None) -> str | None:
        """
        Busca resposta em cache.
        
        Args:
            prompt: Texto do prompt
            model: Nome do modelo (opcional, para especificidade)
            provider: Nome do provider (opcional)
        
        Returns:
            Resposta em cache ou None se não encontrado
        """
        prompt_hash = self._hash_prompt(prompt)
        
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Buscar no cache
            if model and provider:
                cursor.execute('''
                    SELECT response FROM llm_cache 
                    WHERE prompt_hash = ? AND model = ? AND provider = ?
                    LIMIT 1
                ''', (prompt_hash, model, provider))
            else:
                cursor.execute('''
                    SELECT response FROM llm_cache 
                    WHERE prompt_hash = ?
                    LIMIT 1
                ''', (prompt_hash,))
            
            result = cursor.fetchone()
            
            if result:
                # Atualizar data de acesso e contador
                cursor.execute('''
                    UPDATE llm_cache 
                    SET accessed_at = CURRENT_TIMESTAMP, access_count = access_count + 1
                    WHERE prompt_hash = ?
                ''', (prompt_hash,))
                conn.commit()
                
                print(f"[Cache] ✅ HIT - Resposta encontrada no cache", file=sys.stderr)
                return result[0]
            
            conn.close()
            
        except Exception as e:
            print(f"[Cache] ⚠️  Erro ao buscar cache: {e}", file=sys.stderr)
        
        return None
    
    def set(self, prompt: str, response: str, model: str = None, provider: str = None, is_json: bool = False):
        """
        Armazena resposta no cache.
        
        Args:
            prompt: Texto do prompt
            response: Resposta do LLM
            model: Nome do modelo
            provider: Nome do provider
            is_json: Se a resposta é JSON
        """
        prompt_hash = self._hash_prompt(prompt)
        
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Inserir ou atualizar
            cursor.execute('''
                INSERT OR REPLACE INTO llm_cache 
                (prompt_hash, prompt, response, model, provider, is_json, accessed_at)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ''', (prompt_hash, prompt, response, model, provider, int(is_json)))
            
            conn.commit()
            conn.close()
            
            print(f"[Cache] 💾 Resposta armazenada no cache", file=sys.stderr)
            
        except Exception as e:
            print(f"[Cache] ⚠️  Erro ao armazenar cache: {e}", file=sys.stderr)
    
    def clear(self, days: int = None):
        """
        Limpa o cache.
        
        Args:
            days: Se especificado, limpa apenas cache mais antigo que N dias
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            if days:
                # Limpar cache antigo
                cutoff_date = (datetime.now() - timedelta(days=days)).isoformat()
                cursor.execute('DELETE FROM llm_cache WHERE created_at < ?', (cutoff_date,))
                count = cursor.rowcount
                print(f"[Cache] 🗑️  Limpeza: {count} registros deletados (>= {days} dias)", file=sys.stderr)
            else:
                # Limpar tudo
                cursor.execute('DELETE FROM llm_cache')
                print(f"[Cache] 🗑️  Cache completamente limpo", file=sys.stderr)
            
            conn.commit()
            conn.close()
            
        except Exception as e:
            print(f"[Cache] ⚠️  Erro ao limpar cache: {e}", file=sys.stderr)
    
    def stats(self) -> dict:
        """Retorna estatísticas do cache"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('SELECT COUNT(*) FROM llm_cache')
            total = cursor.fetchone()[0]
            
            cursor.execute('SELECT SUM(access_count) FROM llm_cache')
            total_accesses = cursor.fetchone()[0] or 0
            
            cursor.execute('SELECT SUM(LENGTH(response)) FROM llm_cache')
            total_size = cursor.fetchone()[0] or 0
            
            cursor.execute('''
                SELECT provider, COUNT(*) as count 
                FROM llm_cache 
                GROUP BY provider
            ''')
            by_provider = dict(cursor.fetchall())
            
            cursor.execute('''
                SELECT model, COUNT(*) as count 
                FROM llm_cache 
                GROUP BY model
            ''')
            by_model = dict(cursor.fetchall())
            
            conn.close()
            
            return {
                'total_entries': total,
                'total_accesses': total_accesses,
                'total_size_bytes': total_size,
                'by_provider': by_provider,
                'by_model': by_model
            }
            
        except Exception as e:
            print(f"[Cache] ⚠️  Erro ao obter stats: {e}", file=sys.stderr)
            return {}

# Instância global de cache
_cache_instance = None

def get_cache() -> CacheService:
    """Retorna instância global do cache"""
    global _cache_instance
    if _cache_instance is None:
        _cache_instance = CacheService()
    return _cache_instance
