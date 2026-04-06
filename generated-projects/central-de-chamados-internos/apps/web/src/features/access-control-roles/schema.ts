import { z } from 'zod';

export const accessControlRoleFormSchema = z.object({
  roleName: z.enum(['solicitante', 'analista', 'gestor'], {
    message: 'Selecione um perfil valido.',
  }),
  permissionMatrix: z
    .string()
    .trim()
    .min(10, 'Descreva as permissoes com pelo menos 10 caracteres.'),
  accessScope: z.enum(['self_service', 'team', 'global'], {
    message: 'Escolha um escopo valido.',
  }),
});

export type AccessControlRoleFormValues = z.infer<typeof accessControlRoleFormSchema>;
