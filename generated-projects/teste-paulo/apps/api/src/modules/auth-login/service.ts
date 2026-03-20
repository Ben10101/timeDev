import { randomUUID } from 'crypto';
import type { LoginSessionListResponse, LoginSessionRequest, LoginSessionResponse } from '../../../../../packages/shared/src/contracts/auth-login.ts';

const records: LoginSessionResponse[] = [];

/**
 * - O e-mail deve ser validado antes do envio para persistencia.
 * - A senha nao deve ser persistida em texto puro no ambiente real.
 */
export class LoginService {
  list(): LoginSessionListResponse {
    return { items: records };
  }

  create(input: LoginSessionRequest): LoginSessionResponse {
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

    const item: LoginSessionResponse = {
      id: randomUUID(),
      email: input.email.trim().toLowerCase(),
      passwordHint: 'Senha protegida',
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    records.push(item);
    return item;
  }

  buildSeedFromTask(): LoginSessionRequest {
    return {
      email: 'aluno@exemplo.com',
      password: 'SenhaForte123',
    };
  }
}

export const LoginSessionServiceInstance = new LoginService();
records.push(LoginSessionServiceInstance.create(LoginSessionServiceInstance.buildSeedFromTask()));
