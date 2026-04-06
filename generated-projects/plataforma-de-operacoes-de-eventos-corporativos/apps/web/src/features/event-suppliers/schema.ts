import { z } from 'zod';
export const eventSupplierFormSchema = z.object({
 supplierName: z.string().trim().min(3, 'Use o nome comercial do parceiro para facilitar busca e reutilizacao em novos eventos.'),
 serviceCategory: z.enum(['buffet', 'audiovisual', 'brindes', 'recepcao', 'cenografia', 'transporte', 'outro'], { message: 'Classifique o tipo principal de servico que este fornecedor entrega.' }),
 primaryContacts: z.string().trim().min(10, 'Registre pelo menos um contato com nome, canal e referencia para acionamento rapido.'),
});
export type EventSupplierFormValues = z.infer<typeof eventSupplierFormSchema>;