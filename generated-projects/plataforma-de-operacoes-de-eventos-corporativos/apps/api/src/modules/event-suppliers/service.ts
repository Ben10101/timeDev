import { randomUUID } from 'crypto';
import type { EventSupplierRequest, EventSupplierResponse } from '../../../../../packages/shared/src/contracts/event-suppliers.ts';
type InternalRecord = EventSupplierResponse & {
  updatedAt?: string;
  reviewDecision?: 'approved' | 'rejected';
  reviewNote?: string;
  attachmentCount?: number;
  latestAttachment?: string;
  priority?: string;
  title?: string;
  name?: string;
  subject?: string;
};
const records: InternalRecord[] = [];
function validateInput(input: EventSupplierRequest, existingRecords: EventSupplierResponse[]): void {
  if (!String(input.supplierName || '').trim()) throw new Error('Nome do fornecedor obrigatorio.');
  if (String(input.supplierName || '').trim().length < 3) throw new Error('Nome do fornecedor deve ter ao menos 3 caracteres.');
  if (!String(input.serviceCategory || '').trim()) throw new Error('Categoria de servico obrigatorio.');
  if (!["buffet","audiovisual","brindes","recepcao","cenografia","transporte","outro"].includes(String(input.serviceCategory))) throw new Error('Categoria de servico invalido.');
  if (!String(input.primaryContacts || '').trim()) throw new Error('Contatos principais obrigatorio.');
  if (String(input.primaryContacts || '').trim().length < 10) throw new Error('Contatos principais deve ter ao menos 10 caracteres.');
  const duplicatedSupplier = records.find((record) => String(record.supplierName || '').toLowerCase() === String(input.supplierName || '').toLowerCase());
  if (duplicatedSupplier) throw new Error('Ja existe um fornecedor cadastrado com este nome.');
  if (String(input.primaryContacts || '').trim().length < 10) throw new Error('Informe contatos principais com contexto suficiente para acionamento.');
}
/**
 * - O fornecedor precisa ter nome unico para evitar duplicidade na base operacional.
 * - Cada fornecedor deve estar associado a pelo menos uma categoria de servico valida para facilitar triagem e acionamento.
 * - O cadastro precisa registrar ao menos um contato principal com contexto suficiente para acao rapida durante a operacao.
 */
export class EventSuppliersService {
  list() {
    return { items: records };
  }
  create(input: EventSupplierRequest): EventSupplierResponse {
    validateInput(input, records);
    const item: InternalRecord = {
      id: randomUUID(),
      supplierName: input.supplierName,
      serviceCategory: input.serviceCategory,
      primaryContacts: input.primaryContacts,
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    records.push(item);
    return item;
  }
  buildSeedRecordsFromTask(): EventSupplierRequest[] {
    return [
  {
    supplierName: 'Buffet Sabor & Arte',
    serviceCategory: 'financeiro',
    primaryContacts: 'Marina Costa | Comercial | (11) 99999-1111 | marina@fornecedor.com'
  },
  {
    supplierName: 'Buffet Sabor & Arte',
    serviceCategory: 'acesso',
    primaryContacts: 'Marina Costa | Comercial | (11) 99999-1111 | marina@fornecedor.com'
  },
  {
    supplierName: 'Buffet Sabor & Arte',
    serviceCategory: 'suporte',
    primaryContacts: 'Marina Costa | Comercial | (11) 99999-1111 | marina@fornecedor.com'
  }
];
  }
}
export const EventSupplierServiceInstance = new EventSuppliersService();
for (const seedInput of EventSupplierServiceInstance.buildSeedRecordsFromTask()) {
  records.push(EventSupplierServiceInstance.create(seedInput));
}