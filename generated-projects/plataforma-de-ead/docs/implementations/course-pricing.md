# Como Infoprodutor, eu quero poder definir um preço para cada curso, para que eu possa controlar minha receita.

Task UUID: e04bb718-917a-4f8d-a94c-00b78705ca1f

## Resumo
Feature integrada no baseline full stack pos-refinamento.

## Template de tela
- dashboard

## Rotas
- Frontend: /courses/pricing
- Backend: /api/course-pricing

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
