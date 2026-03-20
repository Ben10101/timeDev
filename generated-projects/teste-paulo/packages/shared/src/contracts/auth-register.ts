export interface AccountRegistrationRequest {
  email: string;
  password: string;
}

export interface AccountRegistrationResponse {
  id: string;
  email: string;
  passwordHint?: string;
  status: 'draft' | 'active';
  createdAt: string;
}

export interface AccountRegistrationListResponse {
  items: AccountRegistrationResponse[];
}
