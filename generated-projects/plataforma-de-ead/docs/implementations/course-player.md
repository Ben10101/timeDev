# Como Aluno, eu quero poder assistir aos vídeos e áudios dos cursos, para que eu possa aprender com o conteúdo.

Task UUID: 943841e1-cbfe-4a49-ab5e-193c6fd07760

## Resumo
Feature integrada no baseline full stack pos-refinamento.

## Template de tela
- dashboard

## Rotas
- Frontend: /courses/player
- Backend: /api/course-player

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
