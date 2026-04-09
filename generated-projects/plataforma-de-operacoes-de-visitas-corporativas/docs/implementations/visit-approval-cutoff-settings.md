# Como gestor administrativo, eu quero configurar horários limite para aprovação (ex: até 17h do dia útil anterior), para evitar visitas de última hora sem tempo de análise.
Task UUID: 4bb81ed6-ab2d-44c8-a018-4e6b06ca253c
## Resumo
Implementacao incremental desta story no fluxo operacional de visitas corporativas.
## Template de tela
- screenTemplate: settings
- uiFamily: settings-console
- productMode: governance-console
## Rotas
- Frontend: /settings/visit-approval-cutoff
- Backend: /api/settings/visit-approval-cutoff
## Contratos da feature
- Request: VisitApprovalCutoffSettingRequest
- Response: VisitApprovalCutoffSettingResponse
- Shared contract: packages/shared/src/contracts/visit-approval-cutoff-settings.ts
## Campos principais
- Horario limite: Use o formato HH:MM para definir o horario limite diario.
## Regras operacionais
- Sem regras adicionais registradas.
## Stack e arquitetura
- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Node.js 20 + Express 4
- **ORM**: Prisma 5
## Modulos e limites
- Modulos e Responsabilidades
- Módulo | Responsabilidade | Entidades Principais |