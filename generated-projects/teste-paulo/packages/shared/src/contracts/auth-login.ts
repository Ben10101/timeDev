export interface LoginSessionRequest {
  email: string;
  password: string;
}

export interface LoginSessionResponse {
  id: string;
  email: string;
  passwordHint?: string;
  status: 'draft' | 'active';
  createdAt: string;
}

export interface LoginSessionListResponse {
  items: LoginSessionResponse[];
}
