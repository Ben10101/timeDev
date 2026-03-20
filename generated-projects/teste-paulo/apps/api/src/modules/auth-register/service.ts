import { randomUUID } from 'crypto';
import type { AccountRegistrationListResponse, AccountRegistrationRequest, AccountRegistrationResponse } from '../../../../../packages/shared/src/contracts/auth-register.ts';

const records: AccountRegistrationResponse[] = [];

/**
 * - O sistema nao deve permitir registros com e-mail duplicado.
 * - O e-mail deve ser validado antes do envio para persistencia.
 * - A senha precisa atender aos criterios minimos de seguranca antes de criar o registro.
 */
export class RegisterAccountService {
  list(): AccountRegistrationListResponse {
    return { items: records };
  }

  create(input: AccountRegistrationRequest): AccountRegistrationResponse {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
      throw new Error('E-mail invalido.');
    }

    const password = input.password || '';
    const hasStrongPassword = password.length >= 8 && /[A-Z]/.test(password) && /\d/.test(password);
    if (!hasStrongPassword) {
      throw new Error('Senha invalida.');
    }

    const normalizedEmail = input.email.trim().toLowerCase();
    const duplicated = records.find((record) => record.email === normalizedEmail);
    if (duplicated) {
      throw new Error('E-mail ja cadastrado.');
    }

    const item: AccountRegistrationResponse = {
      id: randomUUID(),
      email: input.email.trim().toLowerCase(),
      passwordHint: 'Senha protegida',
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    records.push(item);
    return item;
  }

  buildSeedFromTask(): AccountRegistrationRequest {
    return {
      email: 'aluno@exemplo.com',
      password: 'SenhaForte123',
    };
  }
}

export const AccountRegistrationServiceInstance = new RegisterAccountService();
records.push(AccountRegistrationServiceInstance.create(AccountRegistrationServiceInstance.buildSeedFromTask()));
