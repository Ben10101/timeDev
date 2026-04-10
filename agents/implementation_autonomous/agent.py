# -*- coding: utf-8 -*-
import json
import re
import sys

try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

from agents.developer.llm_service import extract_json_from_text, generate_text_from_llm, is_error_text_response


def _truncate(value, limit=2400):
    return str(value or "").strip()[:limit]


def _compact_json(value, limit=2800):
    if not value:
        return "{}"
    try:
        return json.dumps(value, ensure_ascii=False, indent=2)[:limit]
    except Exception:
        return _truncate(value, limit)


def _normalize_list(value, max_items=6):
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item or "").strip()][:max_items]


def _normalize_component_map(value):
    if not isinstance(value, dict):
        return {}

    allowed_keys = {
        "recordsLead",
        "formPlacement",
        "recordDensity",
        "listStyle",
        "headerTone",
        "tableMode",
        "emptyStateTone",
    }
    normalized = {}
    for key, item in value.items():
        if key in allowed_keys and str(item or "").strip():
            normalized[key] = str(item).strip()
    return normalized


def _clean_template_source(value):
    text = str(value or "").strip()
    if not text:
        return ""
    fenced = re.match(r"^```(?:tsx|ts|jsx|javascript|typescript)?\s*([\s\S]*?)\s*```$", text, re.IGNORECASE)
    if fenced:
        text = fenced.group(1).strip()
    return text


def _normalize_shared_ui_imports(template_source):
    text = str(template_source or "")
    if not text:
        return ""
    return (
        text.replace("__UI_IMPORT_PATH__", "../../../../../packages/ui/src/index.tsx")
        .replace("packages/ui/src/index'", "packages/ui/src/index.tsx'")
        .replace('packages/ui/src/index"', 'packages/ui/src/index.tsx"')
    )


def _escape_ts(value):
    return str(value or "").replace("\\", "\\\\").replace("'", "\\'")


def _extract_form_fields(payload):
    technical_spec = payload.get("technical_spec") or {}
    structured = technical_spec.get("structured") or {}
    ui = structured.get("ui") or {}
    sections = ui.get("sections") or []

    for section in sections:
        if isinstance(section, dict) and section.get("type") == "form" and isinstance(section.get("fields"), list):
            return section.get("fields") or []

    domain = technical_spec.get("domain") or {}
    return domain.get("fields") or []


def _resolve_feature_mode(payload):
    technical_spec = payload.get("technical_spec") or {}
    structured = technical_spec.get("structured") or {}
    classification = structured.get("classification") or {}
    architecture = technical_spec.get("architecture") or {}
    screen_template = str(architecture.get("screenTemplate") or classification.get("screenTemplate") or "crud").strip().lower()
    intent = str(classification.get("intent") or "custom").strip().lower()

    if screen_template == "settings":
        return "settings"
    if intent in {"review", "view"}:
        return "review"
    if intent == "attach":
        return "attach"
    if screen_template == "workspace":
        return "workspace"
    return "general"


def _build_initial_form_literal(fields):
    entries = []
    for field in fields:
        field_name = str((field or {}).get("name") or "").strip()
        if not field_name:
            continue
        if (field or {}).get("inputType") == "select":
            options = (field or {}).get("selectOptions") or []
            default_value = options[0] if options else ""
        else:
            default_value = ""
        entries.append(f"  {field_name}: '{_escape_ts(default_value)}',")
    return "{\n" + "\n".join(entries) + "\n}"


def _build_form_field_blocks(fields):
    blocks = []
    for field in fields:
        field_name = str((field or {}).get("name") or "").strip()
        if not field_name:
            continue
        label = _escape_ts((field or {}).get("label") or field_name)
        hint = _escape_ts((field or {}).get("helperText") or "Preencha o campo conforme o requisito.")
        placeholder = _escape_ts((field or {}).get("placeholder") or "")
        input_type = str((field or {}).get("inputType") or "text").strip().lower()

        if input_type == "select":
            options = (field or {}).get("selectOptions") or []
            option_lines = "\n".join(
                [f"                <option value='{_escape_ts(option)}'>{_escape_ts(option).capitalize()}</option>" for option in options]
            )
            control = (
                f"              <select {{...register('{field_name}')}} style={{inputStyle({{ borderRadius: 10, padding: '12px 13px' }})}}>\n"
                f"{option_lines}\n"
                "              </select>"
            )
        else:
            html_type = "email" if input_type == "email" else "text"
            control = (
                f"              <input {{...register('{field_name}')}} type='{html_type}' placeholder='{placeholder}' "
                "style={inputStyle({ borderRadius: 10, padding: '12px 13px' })} />"
            )

        block = (
            f"            <FieldGroup label='{label}' hint='{hint}'>\n"
            f"{control}\n"
            f"              {{errors.{field_name} ? <small style={{{{ color: '#b91c1c' }}}}>{{errors.{field_name}.message}}</small> : null}}\n"
            "            </FieldGroup>"
        )
        blocks.append(block)
    return "\n".join(blocks)


def _build_record_lines(fields):
    meaningful_fields = [field for field in fields if str((field or {}).get("name") or "").strip() not in {"id", "status", "createdAt"}]
    preview = meaningful_fields[:2]
    if not preview:
        return (
            "                    <strong style={{ color: '#0f172a', fontSize: 14 }}>{String(item.id || 'registro')}</strong>\n"
            "                    <span style={{ color: '#64748b', fontSize: 12 }}>Registro operacional criado pela feature.</span>"
        )

    lines = []
    first = preview[0]
    first_name = str(first.get("name") or "").strip()
    lines.append(
        f"                    <strong style={{{{ color: '#0f172a', fontSize: 14 }}}}>{{String(item.{first_name} || item.id || 'registro')}}</strong>"
    )
    for field in preview[1:]:
        field_name = str(field.get("name") or "").strip()
        field_label = _escape_ts((field or {}).get("label") or field_name)
        lines.append(
            f"                    <span style={{{{ color: '#64748b', fontSize: 12 }}}}>{field_label}: {{String(item.{field_name} || '-')}}</span>"
        )
    return "\n".join(lines)


def _default_frontend_page_template(payload):
    technical_spec = payload.get("technical_spec") or {}
    frontend = technical_spec.get("frontend") or {}
    title = frontend.get("pageTitle") or payload.get("idea") or "Nova area"
    description = frontend.get("pageDescription") or "Execute a rotina principal com menos ruido e mais clareza."
    eyebrow = frontend.get("navigationLabel") or "Operacao"
    records_title = frontend.get("recordsTitle") or "Registros"
    empty_state = frontend.get("recordsEmptyState") or "Nenhum registro disponivel ainda."
    feature_mode = _resolve_feature_mode(payload)
    form_fields = _extract_form_fields(payload)
    initial_form_literal = _build_initial_form_literal(form_fields)
    form_field_blocks = _build_form_field_blocks(form_fields)
    record_lines = _build_record_lines(form_fields)
    if feature_mode == "review":
        template = """import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { __REQUEST_CONTRACT_NAME__, __RESPONSE_CONTRACT_NAME__ } from '__SHARED_IMPORT_PATH__';
import { FieldGroup, PrimaryButton, SurfaceCard, inputStyle, tokens } from '__UI_IMPORT_PATH__';
import { __SCHEMA_NAME__, type __FORM_VALUES_TYPE__ } from './schema';
import { __QUERY_KEY_NAME__, create__ENTITY_NAME__, fetch__ENTITY_NAME__Items } from './service';

const initialForm: __FORM_VALUES_TYPE__ = __AUTO_INITIAL_FORM__;

function formatCreatedAt(value?: string) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function __PAGE_COMPONENT_NAME__() {
  const queryClient = useQueryClient();
  const { data: items = [], isLoading } = useQuery<__RESPONSE_CONTRACT_NAME__[]>({
    queryKey: __QUERY_KEY_NAME__,
    queryFn: fetch__ENTITY_NAME__Items,
  });
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<__FORM_VALUES_TYPE__>({
    resolver: zodResolver(__SCHEMA_NAME__),
    defaultValues: initialForm,
  });

  const mutation = useMutation({
    mutationFn: (input: __REQUEST_CONTRACT_NAME__) => create__ENTITY_NAME__(input),
    onSuccess: (created) => {
      queryClient.setQueryData<__RESPONSE_CONTRACT_NAME__[]>(__QUERY_KEY_NAME__, (current = []) => [created, ...current]);
      reset(initialForm);
    },
  });

  return (
    <section style={{ display: 'grid', gap: 16 }}>
      <header style={{ display: 'grid', gap: 6 }}>
        <span style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: tokens.color.muted, fontWeight: 800 }}>
          __AUTO_EYEBROW__
        </span>
        <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.05, letterSpacing: '-0.03em', color: '#0f172a' }}>__AUTO_TITLE__</h1>
        <p style={{ margin: 0, color: tokens.color.mutedStrong, maxWidth: 760, lineHeight: 1.65 }}>__AUTO_DESCRIPTION__</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 320px) minmax(0, 1fr)', gap: 14, alignItems: 'start' }}>
        <SurfaceCard title='Consulta guiada' description='Use os filtros da leitura para recuperar historico e reutilizar contexto operacional.'>
          <form onSubmit={handleSubmit((values) => mutation.mutateAsync(values as __REQUEST_CONTRACT_NAME__))} style={{ display: 'grid', gap: 14 }}>
__AUTO_FIELD_BLOCKS__
            <PrimaryButton type='submit'>
              {isSubmitting || mutation.isPending ? 'Processando...' : '__SUBMIT_LABEL__'}
            </PrimaryButton>
            {mutation.isSuccess ? <p style={{ margin: 0, color: '#047857', fontWeight: 600 }}>__SUCCESS_MESSAGE__</p> : null}
            {mutation.error ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{mutation.error instanceof Error ? mutation.error.message : 'Falha ao enviar formulario.'}</p> : null}
          </form>
        </SurfaceCard>

        <SurfaceCard title='__AUTO_RECORDS_TITLE__' description='Leitura direta dos registros encontrados.' meta={isLoading ? 'Carregando...' : `${items.length} itens`}>
          {isLoading ? (
            <div style={{ padding: 8, color: '#64748b' }}>Carregando dados...</div>
          ) : items.length ? (
            <div style={{ display: 'grid' }}>
              {items.map((item) => (
                <div key={String(item.id || Math.random())} style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.9fr 120px', gap: 12, padding: '12px 0', borderBottom: '1px solid #eef2f7', alignItems: 'center' }}>
                  <div style={{ display: 'grid', gap: 4 }}>
__AUTO_RECORD_LINES__
                  </div>
                  <span style={{ color: '#475569', fontSize: 12 }}>{String(item.status || 'ativo')}</span>
                  <span style={{ color: '#64748b', fontSize: 12 }}>{formatCreatedAt(item.createdAt)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: 8, color: '#64748b', lineHeight: 1.6 }}>__AUTO_EMPTY_STATE__</div>
          )}
        </SurfaceCard>
      </div>
    </section>
  );
}
"""
    elif feature_mode == "attach":
        template = """import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { __REQUEST_CONTRACT_NAME__, __RESPONSE_CONTRACT_NAME__ } from '__SHARED_IMPORT_PATH__';
import { FieldGroup, PrimaryButton, SurfaceCard, inputStyle, tokens } from '__UI_IMPORT_PATH__';
import { __SCHEMA_NAME__, type __FORM_VALUES_TYPE__ } from './schema';
import { __QUERY_KEY_NAME__, create__ENTITY_NAME__, fetch__ENTITY_NAME__Items } from './service';

const initialForm: __FORM_VALUES_TYPE__ = __AUTO_INITIAL_FORM__;

export function __PAGE_COMPONENT_NAME__() {
  const queryClient = useQueryClient();
  const { data: items = [], isLoading } = useQuery<__RESPONSE_CONTRACT_NAME__[]>({
    queryKey: __QUERY_KEY_NAME__,
    queryFn: fetch__ENTITY_NAME__Items,
  });
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<__FORM_VALUES_TYPE__>({
    resolver: zodResolver(__SCHEMA_NAME__),
    defaultValues: initialForm,
  });

  const mutation = useMutation({
    mutationFn: (input: __REQUEST_CONTRACT_NAME__) => create__ENTITY_NAME__(input),
    onSuccess: (created) => {
      queryClient.setQueryData<__RESPONSE_CONTRACT_NAME__[]>(__QUERY_KEY_NAME__, (current = []) => [created, ...current]);
      reset(initialForm);
    },
  });

  return (
    <section style={{ display: 'grid', gap: 16 }}>
      <header style={{ display: 'grid', gap: 6 }}>
        <span style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: tokens.color.muted, fontWeight: 800 }}>
          __AUTO_EYEBROW__
        </span>
        <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.05, letterSpacing: '-0.03em', color: '#0f172a' }}>__AUTO_TITLE__</h1>
        <p style={{ margin: 0, color: tokens.color.mutedStrong, maxWidth: 760, lineHeight: 1.65 }}>__AUTO_DESCRIPTION__</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 420px) minmax(0, 1fr)', gap: 14, alignItems: 'start' }}>
        <SurfaceCard title='Vincular acompanhante' description='Associe rapidamente o acompanhante a uma visita aprovada.'>
          <form onSubmit={handleSubmit((values) => mutation.mutateAsync(values as __REQUEST_CONTRACT_NAME__))} style={{ display: 'grid', gap: 14 }}>
__AUTO_FIELD_BLOCKS__
            <PrimaryButton type='submit'>
              {isSubmitting || mutation.isPending ? 'Processando...' : '__SUBMIT_LABEL__'}
            </PrimaryButton>
            {mutation.isSuccess ? <p style={{ margin: 0, color: '#047857', fontWeight: 600 }}>__SUCCESS_MESSAGE__</p> : null}
            {mutation.error ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{mutation.error instanceof Error ? mutation.error.message : 'Falha ao enviar formulario.'}</p> : null}
          </form>
        </SurfaceCard>

        <SurfaceCard title='__AUTO_RECORDS_TITLE__' description='Acompanhantes vinculados nesta operacao.' meta={isLoading ? 'Carregando...' : `${items.length} itens`}>
          {isLoading ? (
            <div style={{ padding: 8, color: '#64748b' }}>Carregando dados...</div>
          ) : items.length ? (
            <div style={{ display: 'grid', gap: 10 }}>
              {items.map((item) => (
                <div key={String(item.id || Math.random())} style={{ padding: 12, borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff' }}>
                  <div style={{ display: 'grid', gap: 4 }}>
__AUTO_RECORD_LINES__
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: 8, color: '#64748b', lineHeight: 1.6 }}>__AUTO_EMPTY_STATE__</div>
          )}
        </SurfaceCard>
      </div>
    </section>
  );
}
"""
    elif feature_mode == "settings":
        template = """import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { __REQUEST_CONTRACT_NAME__, __RESPONSE_CONTRACT_NAME__ } from '__SHARED_IMPORT_PATH__';
import { FieldGroup, PrimaryButton, SurfaceCard, inputStyle, tokens } from '__UI_IMPORT_PATH__';
import { __SCHEMA_NAME__, type __FORM_VALUES_TYPE__ } from './schema';
import { __QUERY_KEY_NAME__, create__ENTITY_NAME__, fetch__ENTITY_NAME__Items } from './service';

const initialForm: __FORM_VALUES_TYPE__ = __AUTO_INITIAL_FORM__;

export function __PAGE_COMPONENT_NAME__() {
  const queryClient = useQueryClient();
  const { data: items = [], isLoading } = useQuery<__RESPONSE_CONTRACT_NAME__[]>({
    queryKey: __QUERY_KEY_NAME__,
    queryFn: fetch__ENTITY_NAME__Items,
  });
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<__FORM_VALUES_TYPE__>({
    resolver: zodResolver(__SCHEMA_NAME__),
    defaultValues: initialForm,
  });

  const mutation = useMutation({
    mutationFn: (input: __REQUEST_CONTRACT_NAME__) => create__ENTITY_NAME__(input),
    onSuccess: (created) => {
      queryClient.setQueryData<__RESPONSE_CONTRACT_NAME__[]>(__QUERY_KEY_NAME__, (current = []) => [created, ...current]);
      reset(initialForm);
    },
  });

  return (
    <section style={{ display: 'grid', gap: 16, maxWidth: 960 }}>
      <header style={{ display: 'grid', gap: 6 }}>
        <span style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: tokens.color.muted, fontWeight: 800 }}>
          __AUTO_EYEBROW__
        </span>
        <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.05, letterSpacing: '-0.03em', color: '#0f172a' }}>__AUTO_TITLE__</h1>
        <p style={{ margin: 0, color: tokens.color.mutedStrong, maxWidth: 760, lineHeight: 1.65 }}>__AUTO_DESCRIPTION__</p>
      </header>

      <SurfaceCard title='Ajuste principal' description='Atualize a configuracao e confira o estado atual logo abaixo.'>
        <form onSubmit={handleSubmit((values) => mutation.mutateAsync(values as __REQUEST_CONTRACT_NAME__))} style={{ display: 'grid', gap: 14 }}>
__AUTO_FIELD_BLOCKS__
          <PrimaryButton type='submit'>
            {isSubmitting || mutation.isPending ? 'Processando...' : '__SUBMIT_LABEL__'}
          </PrimaryButton>
          {mutation.isSuccess ? <p style={{ margin: 0, color: '#047857', fontWeight: 600 }}>__SUCCESS_MESSAGE__</p> : null}
          {mutation.error ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{mutation.error instanceof Error ? mutation.error.message : 'Falha ao enviar formulario.'}</p> : null}
        </form>
      </SurfaceCard>

      <SurfaceCard title='__AUTO_RECORDS_TITLE__' description='Ultimo estado aplicado para esta configuracao.' meta={isLoading ? 'Carregando...' : `${items.length} itens`}>
        {isLoading ? (
          <div style={{ padding: 8, color: '#64748b' }}>Carregando dados...</div>
        ) : items.length ? (
          <div style={{ display: 'grid', gap: 10 }}>
            {items.map((item) => (
              <div key={String(item.id || Math.random())} style={{ display: 'grid', gap: 4, padding: 12, borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
__AUTO_RECORD_LINES__
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: 8, color: '#64748b', lineHeight: 1.6 }}>__AUTO_EMPTY_STATE__</div>
        )}
      </SurfaceCard>
    </section>
  );
}
"""
    else:
        template = """import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { __REQUEST_CONTRACT_NAME__, __RESPONSE_CONTRACT_NAME__ } from '__SHARED_IMPORT_PATH__';
import { FieldGroup, PrimaryButton, SurfaceCard, inputStyle, tokens } from '__UI_IMPORT_PATH__';
import { __SCHEMA_NAME__, type __FORM_VALUES_TYPE__ } from './schema';
import { __QUERY_KEY_NAME__, create__ENTITY_NAME__, fetch__ENTITY_NAME__Items } from './service';

const initialForm: __FORM_VALUES_TYPE__ = __AUTO_INITIAL_FORM__;

function formatCreatedAt(value?: string) {
  if (!value) return 'Agora';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Agora';
  return parsed.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function __PAGE_COMPONENT_NAME__() {
  const queryClient = useQueryClient();
  const { data: items = [], isLoading } = useQuery<__RESPONSE_CONTRACT_NAME__[]>({
    queryKey: __QUERY_KEY_NAME__,
    queryFn: fetch__ENTITY_NAME__Items,
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<__FORM_VALUES_TYPE__>({
    resolver: zodResolver(__SCHEMA_NAME__),
    defaultValues: initialForm,
  });

  const mutation = useMutation({
    mutationFn: (input: __REQUEST_CONTRACT_NAME__) => create__ENTITY_NAME__(input),
    onSuccess: (created) => {
      queryClient.setQueryData<__RESPONSE_CONTRACT_NAME__[]>(__QUERY_KEY_NAME__, (current = []) => [created, ...current]);
      reset(initialForm);
    },
  });

  return (
    <section style={{ display: 'grid', gap: 16 }}>
      <header style={{ display: 'grid', gap: 6 }}>
        <span style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: tokens.color.muted, fontWeight: 800 }}>
          __AUTO_EYEBROW__
        </span>
        <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.05, letterSpacing: '-0.03em', color: '#0f172a' }}>__AUTO_TITLE__</h1>
        <p style={{ margin: 0, color: tokens.color.mutedStrong, maxWidth: 760, lineHeight: 1.65 }}>__AUTO_DESCRIPTION__</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 380px) minmax(0, 1fr)', gap: 14, alignItems: 'start' }}>
        <SurfaceCard title='Cadastro' description='Preencha os campos principais e confirme o registro.'>
          <form onSubmit={handleSubmit((values) => mutation.mutateAsync(values as __REQUEST_CONTRACT_NAME__))} style={{ display: 'grid', gap: 14 }}>
__AUTO_FIELD_BLOCKS__
            <PrimaryButton type='submit'>
            {isSubmitting || mutation.isPending ? 'Processando...' : '__SUBMIT_LABEL__'}
            </PrimaryButton>
            {mutation.isSuccess ? <p style={{ margin: 0, color: '#047857', fontWeight: 600 }}>__SUCCESS_MESSAGE__</p> : null}
            {mutation.error ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{mutation.error instanceof Error ? mutation.error.message : 'Falha ao enviar formulario.'}</p> : null}
          </form>
        </SurfaceCard>

        <SurfaceCard title='__AUTO_RECORDS_TITLE__' description='Lista operacional com leitura direta dos campos principais.' meta={isLoading ? 'Carregando...' : `${items.length} itens`}>
          {isLoading ? (
            <div style={{ padding: 8, color: '#64748b' }}>Carregando dados...</div>
          ) : items.length ? (
            <div style={{ display: 'grid' }}>
              {items.map((item) => (
                <div key={String(item.id || Math.random())} style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 10, padding: '12px 0', borderBottom: '1px solid #eef2f7', alignItems: 'center' }}>
                  <div style={{ display: 'grid', gap: 4 }}>
__AUTO_RECORD_LINES__
                  </div>
                  <span style={{ color: '#64748b', fontSize: 12 }}>{formatCreatedAt(item.createdAt)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: 8, color: '#64748b', lineHeight: 1.6 }}>__AUTO_EMPTY_STATE__</div>
          )}
        </SurfaceCard>
      </div>
    </section>
  );
}
"""

    return (
        template.replace("__AUTO_EYEBROW__", eyebrow)
        .replace("__AUTO_TITLE__", title)
        .replace("__AUTO_DESCRIPTION__", description)
        .replace("__AUTO_RECORDS_TITLE__", records_title)
        .replace("__AUTO_EMPTY_STATE__", empty_state)
        .replace("__AUTO_INITIAL_FORM__", initial_form_literal)
        .replace("__AUTO_FIELD_BLOCKS__", form_field_blocks)
        .replace("__AUTO_RECORD_LINES__", record_lines)
    )


def _default_frontend_service_template():
    return """import type { __LIST_CONTRACT_NAME__, __REQUEST_CONTRACT_NAME__, __RESPONSE_CONTRACT_NAME__ } from '__SHARED_IMPORT_PATH__';

export const __QUERY_KEY_NAME__ = ['__ENTITY_NAME__'];

export async function fetch__ENTITY_NAME__Items(): Promise<__RESPONSE_CONTRACT_NAME__[]> {
  const response = await fetch('__ROUTE_BASE__');
  if (!response.ok) {
    throw new Error('Falha ao carregar registros da feature.');
  }
  const data: __LIST_CONTRACT_NAME__ = await response.json();
  return data.items || [];
}

export async function create__ENTITY_NAME__(input: __REQUEST_CONTRACT_NAME__): Promise<__RESPONSE_CONTRACT_NAME__> {
  const response = await fetch('__ROUTE_BASE__', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Falha ao criar registro.' }));
    throw new Error(error.message || 'Falha ao criar registro.');
  }

  return response.json();
}
"""


def _default_frontend_index_template():
    return """export { __PAGE_COMPONENT_NAME__ } from './page';
export { fetch__ENTITY_NAME__Items } from './service';
"""


def _default_backend_service_template():
    return """import { PrismaClient } from '@prisma/client';
import type { __REQUEST_CONTRACT_NAME__, __RESPONSE_CONTRACT_NAME__ } from '__SHARED_IMPORT_PATH__';

const prisma = new PrismaClient();

export class __BACKEND_SERVICE_NAME__ {
  async list(): Promise<{ items: __RESPONSE_CONTRACT_NAME__[] }> {
    const items = await prisma.__PRISMA_MODEL_ID__.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return { items: items as unknown as __RESPONSE_CONTRACT_NAME__[] };
  }

  async create(input: __REQUEST_CONTRACT_NAME__): Promise<__RESPONSE_CONTRACT_NAME__> {
    const item = await prisma.__PRISMA_MODEL_ID__.create({
      data: {
        ...input,
        status: 'active'
      }
    });

    return item as unknown as __RESPONSE_CONTRACT_NAME__;
  }
}

export const __BACKEND_SERVICE_INSTANCE_NAME__ = new __BACKEND_SERVICE_NAME__();
"""


def _default_backend_router_template():
    return """import { Router } from 'express';
import type { __REQUEST_CONTRACT_NAME__ } from '__SHARED_IMPORT_PATH__';
import { __BACKEND_SERVICE_INSTANCE_NAME__ } from './service';

export const __BACKEND_ROUTER_NAME__ = Router();

__BACKEND_ROUTER_NAME__.get('/', async (_req, res) => {
  try {
    const data = await __BACKEND_SERVICE_INSTANCE_NAME__.list();
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Falha ao buscar registros.' });
  }
});

__BACKEND_ROUTER_NAME__.post('/', async (req, res) => {
  try {
    const input = (req.body || {}) as __REQUEST_CONTRACT_NAME__;
    const created = await __BACKEND_SERVICE_INSTANCE_NAME__.create(input);
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Falha ao processar a requisicao.' });
  }
});
"""


def _default_backend_index_template():
    return """export { __BACKEND_ROUTER_NAME__ } from './router';
export { __BACKEND_SERVICE_INSTANCE_NAME__ } from './service';
"""


def _resolve_materialization_summary(frontend, backend):
    file_sources = {
        "frontend": {
            "pageTsxTemplate": "llm_primary" if frontend.get("pageTsxTemplate") else "fallback_minimal",
            "serviceTsTemplate": "llm_primary" if frontend.get("serviceTsTemplate") else "fallback_minimal",
            "indexTsTemplate": "llm_primary" if frontend.get("indexTsTemplate") else "fallback_minimal",
        },
        "backend": {
            "serviceTsTemplate": "llm_primary" if backend.get("serviceTsTemplate") else "fallback_minimal",
            "routerTsTemplate": "llm_primary" if backend.get("routerTsTemplate") else "fallback_minimal",
            "indexTsTemplate": "llm_primary" if backend.get("indexTsTemplate") else "fallback_minimal",
        },
    }
    flat_sources = [
        *file_sources["frontend"].values(),
        *file_sources["backend"].values(),
    ]
    llm_count = sum(1 for item in flat_sources if item == "llm_primary")
    fallback_count = len(flat_sources) - llm_count

    if llm_count == len(flat_sources):
        generation_source = "llm_primary"
    elif llm_count == 0:
        generation_source = "fallback_full"
    else:
        generation_source = "llm_primary_with_fallback"

    return {
        "generationSource": generation_source,
        "llmFileCount": llm_count,
        "fallbackFileCount": fallback_count,
        "fileSources": file_sources,
    }


def _ensure_materialized_templates(result, payload):
    materialized = result or _fallback_frontend(payload)
    frontend = materialized.get("frontend") or {}
    backend = materialized.get("backend") or {}

    if not frontend.get("pageTsxTemplate"):
        frontend["pageTsxTemplate"] = _default_frontend_page_template(payload)
    frontend["pageTsxTemplate"] = _normalize_shared_ui_imports(frontend.get("pageTsxTemplate"))
    if not frontend.get("serviceTsTemplate"):
        frontend["serviceTsTemplate"] = _default_frontend_service_template()
    if not frontend.get("indexTsTemplate"):
        frontend["indexTsTemplate"] = _default_frontend_index_template()

    if not backend.get("serviceTsTemplate"):
        backend["serviceTsTemplate"] = _default_backend_service_template()
    if not backend.get("routerTsTemplate"):
        backend["routerTsTemplate"] = _default_backend_router_template()
    if not backend.get("indexTsTemplate"):
        backend["indexTsTemplate"] = _default_backend_index_template()

    materialization = _resolve_materialization_summary(frontend, backend)
    frontend["fileSources"] = materialization["fileSources"]["frontend"]
    backend["fileSources"] = materialization["fileSources"]["backend"]
    materialized["frontend"] = frontend
    materialized["backend"] = backend
    feature_mode = _resolve_feature_mode(payload)
    materialized["materialization"] = {
        "generationSource": materialization["generationSource"],
        "llmFileCount": materialization["llmFileCount"],
        "fallbackFileCount": materialization["fallbackFileCount"],
        "variationProfile": feature_mode,
    }
    materialized["generationSource"] = materialization["generationSource"]
    materialized["variationProfile"] = feature_mode
    materialized["compositionSignature"] = f"{feature_mode}:{frontend.get('layoutVariant') or 'default'}:{frontend.get('pageArchetype') or 'general'}"
    return materialized


def _fallback_frontend(payload):
    technical_spec = payload.get("technical_spec") or {}
    frontend = technical_spec.get("frontend") or {}
    classification = (technical_spec.get("structured") or {}).get("classification") or {}
    screen_template = (technical_spec.get("architecture") or {}).get("screenTemplate") or classification.get("screenTemplate") or "crud"

    records_lead = "denseTable" if screen_template == "workspace" else "summaryCards"
    form_placement = "leftRail" if screen_template == "workspace" else "mainColumn"

    return {
        "frontend": {
            "layoutVariant": frontend.get("layoutVariant") or ("evidence-split" if screen_template == "workspace" else "summary-first"),
            "heroEyebrow": frontend.get("navigationLabel") or "Operacao",
            "heroTitle": frontend.get("pageTitle") or payload.get("idea") or "Nova area",
            "heroDescription": frontend.get("pageDescription") or "Executar a tarefa com menos ruido e mais clareza operacional.",
            "formCardTitle": frontend.get("pageTitle") or "Preencha os dados",
            "formCardDescription": frontend.get("pageDescription") or "Use o formulario para registrar o item principal desta area.",
            "recordsTitle": frontend.get("recordsTitle") or "Registros",
            "recordsEmptyState": frontend.get("recordsEmptyState") or "Nenhum registro disponivel ainda.",
            "highlights": [],
            "pageArchetype": "operational-tool",
            "fallbackPattern": "artifact-first",
            "sections": ["context", "form", "records"],
            "componentMap": {
                "recordsLead": records_lead,
                "formPlacement": form_placement,
                "recordDensity": "compact",
                "listStyle": "table",
                "headerTone": "utilitarian",
                "tableMode": "dense",
                "emptyStateTone": "quiet",
            },
            "pageTsxTemplate": "",
            "serviceTsTemplate": "",
            "indexTsTemplate": "",
        },
        "backend": {
            "serviceStyle": "contract-first",
            "notes": [
                "Preservar rotas e contratos definidos no manifesto.",
                "Manter seeds e validacoes minimas para smoke incremental.",
            ],
            "serviceTsTemplate": "",
            "routerTsTemplate": "",
            "indexTsTemplate": "",
        },
        "shared": {
            "contractEmphasis": ["request-response-alignment", "stable-shared-types"],
        },
        "reviewFocus": [
            "Aderencia ao Requirement Spec",
            "Aderencia ao Test Spec",
            "Coerencia com a shell e com o dominio da feature",
        ],
        "generationSource": "fallback_full",
        "variationProfile": _resolve_feature_mode(payload),
    }


class ImplementationAutonomousAgent:
    def __init__(self, project_id):
        self.project_id = project_id

    def _build_prompt(self, payload):
        idea = payload.get("idea") or ""
        implementation_manifest = payload.get("implementation_manifest") or {}
        technical_spec = payload.get("technical_spec") or {}
        current_implementation_context = payload.get("current_implementation_context") or {}
        requirement_spec = payload.get("requirement_spec") or {}
        test_spec = payload.get("test_spec") or {}
        architecture = payload.get("architecture") or {}
        repair_context = payload.get("repair_context") or {}
        autonomous_contract = implementation_manifest.get("autonomousAgent") or {}

        return f"""
Voce e o implementation_autonomous_agent do Aligna.

Sua tarefa e materializar IMPLEMENTACAO REAL para uma feature, com liberdade de composicao, estrutura visual e divisao de codigo, sem trocar rotas, contratos ou escopo.

FEATURE
{_truncate(idea, 500)}

IMPLEMENTATION MANIFEST
{_compact_json(implementation_manifest, 4200)}

TECHNICAL SPEC
{_compact_json(technical_spec, 4200)}

CURRENT IMPLEMENTATION CONTEXT
{_compact_json(current_implementation_context, 4200)}

REQUIREMENT SPEC
{_compact_json(requirement_spec, 2800)}

TEST SPEC
{_compact_json(test_spec, 2600)}

ARQUITETURA
{_compact_json(architecture, 2200)}

REPAIR CONTEXT
{_compact_json(repair_context, 2200)}

CONTRATO DE AUTONOMIA
{_compact_json(autonomous_contract, 2200)}

REGRAS
- Nao troque rotas.
- Nao troque nomes de contratos compartilhados.
- Nao invente workflow fora do requisito.
- A liberdade e para composicao, copy, densidade, split de arquivo, shell e enfase visual.
- Pense como um agente senior de desenvolvimento criando uma ferramenta real, nao como gerador de template.
- Voce PODE nao usar shell compartilhado quando o contrato de autonomia permitir. Nesse caso, use apenas primitivas compartilhadas suficientes (`FieldGroup`, `PrimaryButton`, `inputStyle`, `tokens`, `SurfaceCard`) e construa a pagina livremente.
- Evite paginas com cara de template repetido, loops genéricos de campos, placeholders abstratos, texto autoexplicativo da esteira, hero desnecessario ou cockpit sem motivo.
- Para frontend, prefira codigo final explicito: campos nomeados, lista legivel, hierarquia de informacao concreta, copy de produto, estrutura coerente com a tarefa.
- Se a feature for operacional simples, uma tela seca e utilitaria e melhor que um workspace ornamental.
- Use `CURRENT IMPLEMENTATION CONTEXT` como base da iteracao: se ja houver arquivos materializados, evolua esses arquivos em vez de reinventar a feature do zero.
- Em repair, trate `CURRENT IMPLEMENTATION CONTEXT.files` como a versao atual da solucao. Corrija em cima dela e preserve o que ja estiver bom.
- Se houver REPAIR CONTEXT, trate-o como prioridade alta: corrija os findings diretamente na solucao proposta, sem resetar a feature para um molde generico.
- Se `REPAIR CONTEXT.debugDiagnosis` vier preenchido, trate `rootCause`, `suggestedFix` e `affectedFiles` como a melhor pista tecnica sobre onde agir primeiro.
- Preserve a autoria e a estrutura da solucao quando os erros forem locais; reconstrua apenas o que os findings realmente exigirem.
- Se `REPAIR CONTEXT.executionFocus.focusFiles` vier preenchido, concentre a maior parte das mudancas nesses arquivos.
- Trate `REPAIR CONTEXT.executionFocus.preserveFiles` como arquivos a preservar. Nao reescreva esses arquivos sem necessidade clara causada pelos findings.
- Se `REPAIR CONTEXT.executionFocus.writeSet.mode` for `local_patch`, faca uma correcao pequena e cirurgica em vez de recompor a feature inteira.
- Se `REPAIR CONTEXT.executionFocus.primaryFailureSurface` ou `REPAIR CONTEXT.repairScope` apontarem so para frontend ou so para backend, evite mudar a outra camada.
- Se `CONTRATO DE AUTONOMIA.structuralFreedomHints` trouxer `avoidLayoutSignatures`, evite repetir essas assinaturas de layout. Se trouxer `preferredArchetypes`, use isso como guia estrutural na composicao do frontend.
- Responda APENAS com JSON valido.
- Se optar por gerar templates, use placeholders controlados como:
  - `__PRISMA_MODEL_ID__`
  - `__SHARED_IMPORT_PATH__`
  - `__UI_IMPORT_PATH__`
  - `__REQUEST_CONTRACT_NAME__`
  - `__RESPONSE_CONTRACT_NAME__`
  - `__LIST_CONTRACT_NAME__`
  - `__ENTITY_NAME__`
  - `__PAGE_COMPONENT_NAME__`
  - `__QUERY_KEY_NAME__`
  - `__SCHEMA_NAME__`
  - `__FORM_VALUES_TYPE__`
  - `__ROUTE_BASE__`
  - `__SUBMIT_LABEL__`
  - `__SUCCESS_MESSAGE__`
  - `__BACKEND_ROUTER_NAME__`
  - `__BACKEND_SERVICE_NAME__`
  - `__BACKEND_SERVICE_INSTANCE_NAME__`
- `serviceTsTemplate` deve ser um arquivo `service.ts` completo.
- Para o backend, NAO use arrays em memoria (`const records = []`) para armazenar ou gerenciar dados.
- Importe o Prisma Client com dependencias no topo do service (`import {{ PrismaClient }} from '@prisma/client'; const prisma = new PrismaClient();`).
- Utilize puramente metodos assincronos (`async`/`await`) nas classes de servico e routers criados.
- Utilize explicitamente `await prisma.__PRISMA_MODEL_ID__.findMany()` e `await prisma.__PRISMA_MODEL_ID__.create({{ data }})`. O orquestrador no NodeJS injetara a string correta no lugar de `__PRISMA_MODEL_ID__`.
- `indexTsTemplate` deve ser um arquivo `index.ts` completo.
- `routerTsTemplate` deve ser um arquivo `router.ts` completo.
- O template deve ser um arquivo completo e compilavel para a camada correspondente.
- Quando gerar `pageTsxTemplate`, entregue a pagina final inteira. Nao devolva pseudo-template, scaffolding genérico ou loop baseado em `Object.keys(initialForm)`.
- Se usar shell compartilhado, declare explicitamente `productMode`.
- Se nao usar shell, a pagina ainda precisa usar o design system compartilhado por primitivas importadas.

FORMATO EXATO
{{
  "frontend": {{
    "layoutVariant": "string",
    "heroEyebrow": "string",
    "heroTitle": "string",
    "heroDescription": "string",
    "formCardTitle": "string",
    "formCardDescription": "string",
    "recordsTitle": "string",
    "recordsEmptyState": "string",
    "highlights": ["string"],
    "pageArchetype": "string",
    "fallbackPattern": "string",
    "sections": ["string"],
    "pageTsxTemplate": "string",
    "serviceTsTemplate": "string",
    "indexTsTemplate": "string",
    "componentMap": {{
      "recordsLead": "string",
      "formPlacement": "string",
      "recordDensity": "string",
      "listStyle": "string",
      "headerTone": "string",
      "tableMode": "string",
      "emptyStateTone": "string"
    }}
  }},
  "backend": {{
    "serviceStyle": "string",
    "notes": ["string"],
    "serviceTsTemplate": "string",
    "routerTsTemplate": "string",
    "indexTsTemplate": "string"
  }},
  "shared": {{
    "contractEmphasis": ["string"]
  }},
  "reviewFocus": ["string"]
}}
""".strip()

    def _normalize_result(self, result, payload):
        fallback = _fallback_frontend(payload)
        if not result:
            return fallback

        frontend = result.get("frontend") if isinstance(result, dict) else None
        backend = result.get("backend") if isinstance(result, dict) else None
        shared = result.get("shared") if isinstance(result, dict) else None
        review_focus = result.get("reviewFocus") if isinstance(result, dict) else None

        normalized_frontend = {
            **fallback["frontend"],
            **({k: str(v).strip() for k, v in frontend.items() if isinstance(v, str) and str(v).strip()} if isinstance(frontend, dict) else {}),
        }
        if isinstance(frontend, dict):
            normalized_frontend["highlights"] = _normalize_list(frontend.get("highlights"), max_items=4) or fallback["frontend"]["highlights"]
            normalized_frontend["sections"] = _normalize_list(frontend.get("sections"), max_items=8) or fallback["frontend"]["sections"]
            page_template = _clean_template_source(frontend.get("pageTsxTemplate"))
            service_template = _clean_template_source(frontend.get("serviceTsTemplate"))
            index_template = _clean_template_source(frontend.get("indexTsTemplate"))
            if page_template and "export function" in page_template:
                normalized_frontend["pageTsxTemplate"] = _normalize_shared_ui_imports(page_template)
            if service_template and "export " in service_template:
                normalized_frontend["serviceTsTemplate"] = service_template
            if index_template and "export " in index_template:
                normalized_frontend["indexTsTemplate"] = index_template
            normalized_frontend["componentMap"] = {
                **fallback["frontend"]["componentMap"],
                **_normalize_component_map(frontend.get("componentMap")),
            }

        return {
            "frontend": normalized_frontend,
            "backend": {
                "serviceStyle": str((backend or {}).get("serviceStyle") or fallback["backend"]["serviceStyle"]).strip(),
                "notes": _normalize_list((backend or {}).get("notes"), max_items=5) or fallback["backend"]["notes"],
                "serviceTsTemplate": _clean_template_source((backend or {}).get("serviceTsTemplate")),
                "routerTsTemplate": _clean_template_source((backend or {}).get("routerTsTemplate")),
                "indexTsTemplate": _clean_template_source((backend or {}).get("indexTsTemplate")),
            },
            "shared": {
                "contractEmphasis": _normalize_list((shared or {}).get("contractEmphasis"), max_items=5)
                or fallback["shared"]["contractEmphasis"],
            },
            "reviewFocus": _normalize_list(review_focus, max_items=6) or fallback["reviewFocus"],
            "generationSource": str((result or {}).get("generationSource") or "llm_primary").strip(),
        }

    def process(self, payload):
        prompt = self._build_prompt(payload)
        model = payload.get("model")

        try:
            raw = generate_text_from_llm(
                prompt,
                model=model,
                options_override={"temperature": 0.2, "num_predict": 1800},
                use_cache=False,
            )
            if not raw or is_error_text_response(raw):
                return _ensure_materialized_templates(self._normalize_result(None, payload), payload)
            parsed = extract_json_from_text(raw)
            return _ensure_materialized_templates(
                self._normalize_result(parsed if isinstance(parsed, dict) else None, payload),
                payload,
            )
        except Exception:
            return _ensure_materialized_templates(self._normalize_result(None, payload), payload)
