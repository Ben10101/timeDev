import { z } from 'zod';
export const visitApprovalCutoffSettingFormSchema = z.object({
 cutoffTime: z.string().trim().min(1, 'Use o formato HH:MM para definir o horario limite diario.'),
});
export type VisitApprovalCutoffSettingFormValues = z.infer<typeof visitApprovalCutoffSettingFormSchema>;