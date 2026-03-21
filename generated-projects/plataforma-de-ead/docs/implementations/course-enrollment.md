# Como Aluno, eu quero poder me cadastrar na plataforma, para que eu possa ter acesso aos cursos disponíveis.

Task UUID: 34403c8a-f387-4637-b8d3-722f867096d2

## Resumo
Feature integrada no baseline full stack pos-refinamento.

## Template de tela
- dashboard

## Rotas
- Frontend: /courses/enrollments
- Backend: /api/course-enrollments

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
