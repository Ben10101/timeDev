import { z } from 'zod';

export const accessControlRoleSchema = z.object({
  roleName: z.enum(['solicitante', 'analista', 'gestor'], {
    message: 'Perfil de acesso invalido.',
  }),
  permissionMatrix: z
    .string()
    .trim()
    .min(10, 'Permissoes deve ter ao menos 10 caracteres.'),
  accessScope: z.enum(['self_service', 'team', 'global'], {
    message: 'Escopo invalido.',
  }),
});

export type AccessControlRoleInput = z.infer<typeof accessControlRoleSchema>;
