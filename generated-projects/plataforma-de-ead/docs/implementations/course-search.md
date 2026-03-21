# Como Aluno, eu quero poder pesquisar cursos por categoria, nome ou palavra-chave, para que eu possa encontrar os cursos que me interessam.

Task UUID: c816f694-3796-486c-bb24-1df02632ecd8

## Resumo
Feature integrada no baseline full stack pos-refinamento.

## Template de tela
- dashboard

## Rotas
- Frontend: /courses/search
- Backend: /api/course-search

## Stack e arquitetura
- ## Stack Tecnologico
- - Frontend: React.js (SPA, responsivo, autenticação JWT)
- - Backend: Node.js + Express (API RESTful)
- Frontend -->|REST API| Backend
- Backend --> DB[(PostgreSQL)]

## Modulos e limites
- ## Modulos e Responsabilidades
- - **Course Management**: CRUD de cursos, módulos, aulas, definição de preços.
- - **Module** (id, courseId, titulo, ordem)
- 2. Gestão de cursos, módulos e aulas (Histórias 2, 3, 4).
