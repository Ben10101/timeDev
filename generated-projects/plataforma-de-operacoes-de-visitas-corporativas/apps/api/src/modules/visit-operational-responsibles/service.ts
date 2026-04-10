import { PrismaClient } from '@prisma/client';
import type { VisitOperationalResponsibleRequest, VisitOperationalResponsibleResponse } from '../../../../../packages/shared/src/contracts/visit-operational-responsibles';
const prisma = new PrismaClient();
function validateInput(input: VisitOperationalResponsibleRequest, existingRecords: VisitOperationalResponsibleResponse[]): void {
  if (!String(input.responsibleName || '').trim()) throw new Error('Nome do responsavel operacional obrigatorio.');
  if (String(input.responsibleName || '').trim().length < 3) throw new Error('Nome do responsavel operacional deve ter ao menos 3 caracteres.');
  if (!String(input.contact || '').trim()) throw new Error('Contato obrigatorio.');
  if (!String(input.supportType || '').trim()) throw new Error('Tipo de suporte obrigatorio.');
  if (!["tecnico","logistica","seguranca","apoio"].includes(String(input.supportType))) throw new Error('Tipo de suporte invalido.');
  const duplicatedResponsible = existingRecords.find((record) => String(record.responsibleName || '').toLowerCase() === String(input.responsibleName || '').trim().toLowerCase() && String(record.supportType || '') === String(input.supportType || ''));
  if (duplicatedResponsible) throw new Error('Ja existe um responsavel operacional com este nome e tipo de suporte.');
  const contactValue = String(input.contact || '').trim();
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactValue);
  const isPhone = /^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/.test(contactValue);
  if (!isEmail && !isPhone) throw new Error('Informe um contato valido por e-mail ou telefone com DDD.');
}
/**
 * - O responsavel operacional precisa ter nome valido para identificacao clara durante a operacao.
 * - O contato deve aceitar e-mail valido ou telefone com DDD para acionamento rapido.
 * - O tipo de suporte precisa vir de uma lista predefinida para padronizar a classificacao.
 * - Nao e permitido duplicar responsavel operacional com mesmo nome e tipo de suporte.
 */
export class VisitOperationalResponsiblesService {
  async list() {
    const items = await prisma['visitOperationalResponsible'].findMany({ orderBy: { createdAt: 'desc' } });
    return { items };
  }
  async create(input: VisitOperationalResponsibleRequest): Promise<VisitOperationalResponsibleResponse> {
    const existingRecords = await prisma['visitOperationalResponsible'].findMany({ orderBy: { createdAt: 'desc' } });
    validateInput(input, existingRecords as unknown as VisitOperationalResponsibleResponse[]);
    const item = await prisma['visitOperationalResponsible'].create({
      data: {
      responsibleName: input.responsibleName,
      contact: input.contact,
      supportType: input.supportType,
        status: 'active',
      }
    });
    return item as unknown as VisitOperationalResponsibleResponse;
  }
}
export const VisitOperationalResponsibleServiceInstance = new VisitOperationalResponsiblesService();