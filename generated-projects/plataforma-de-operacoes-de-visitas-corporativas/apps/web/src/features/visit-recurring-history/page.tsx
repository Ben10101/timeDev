import { useQuery } from '@tanstack/react-query';
import type { VisitRecurringHistoryResponse } from '../../../../../packages/shared/src/contracts/visit-recurring-history';
import { SurfaceCard, inputStyle, tokens } from '../../../../../packages/ui/src/index';
import { visitRecurringHistoryQueryKey, fetchVisitRecurringHistoryItems } from './service';
function formatCreatedAt(value?: string) {
 if (!value) return '-';
 const parsed = new Date(value);
 if (Number.isNaN(parsed.getTime())) return '-';
 return parsed.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}
export function VisitRecurringHistoryPage() {
 const { data: items = [], isLoading } = useQuery<VisitRecurringHistoryResponse[]>({
 queryKey: visitRecurringHistoryQueryKey,
 queryFn: fetchVisitRecurringHistoryItems,
 });
 return (
 <section style={{ display: 'grid', gap: 16 }}>
 <header style={{ display: 'grid', gap: 6 }}>
 <span style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: tokens.color.muted, fontWeight: 800 }}>
 Historico de visitas
 </span>
 <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.05, letterSpacing: '-0.03em', color: '#0f172a' }}>Consulte visitas recorrentes</h1>
 <p style={{ margin: 0, color: tokens.color.mutedStrong, maxWidth: 760, lineHeight: 1.65 }}>Visualize o historico recente do cliente para reaproveitar contexto e agilizar um novo agendamento.</p>
 </header>
 <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 320px) minmax(0, 1fr)', gap: 14, alignItems: 'start' }}>
 <SurfaceCard title='Consulta' description='Use esta area para orientar a leitura do historico recente.'>
 <div style={{ display: 'grid', gap: 12 }}>
 <input readOnly value='Cliente recorrente' style={inputStyle({ borderRadius: 10, padding: '12px 13px', opacity: 0.8 })} />
 <input readOnly value='Ultimos registros disponiveis' style={inputStyle({ borderRadius: 10, padding: '12px 13px', opacity: 0.8 })} />
 </div>
 </SurfaceCard>
 <SurfaceCard title='Busca do cliente' description='Leitura direta dos registros encontrados.' meta={isLoading ? 'Carregando...' : `${items.length} itens`}>
 {isLoading ? (
 <div style={{ padding: 8, color: '#64748b' }}>Carregando dados...</div>
 ) : items.length ? (
 <div style={{ display: 'grid' }}>
 {items.map((item) => (
 <div key={String(item.id || Math.random())} style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.9fr 120px', gap: 12, padding: '12px 0', borderBottom: '1px solid #eef2f7', alignItems: 'center' }}>
 <div style={{ display: 'grid', gap: 4 }}>
 <strong style={{ color: '#0f172a', fontSize: 14 }}>{String(item.clientIdentifier || item.id || 'registro')}</strong>
 <span style={{ color: '#64748b', fontSize: 12 }}>Periodo: {String(item.periodRange || '-')}</span>
 </div>
 <span style={{ color: '#475569', fontSize: 12 }}>{String(item.status || 'ativo')}</span>
 <span style={{ color: '#64748b', fontSize: 12 }}>{formatCreatedAt(item.createdAt)}</span>
 </div>
 ))}
 </div>
 ) : (
 <div style={{ padding: 8, color: '#64748b', lineHeight: 1.6 }}>Nenhum historico localizado ainda para o cliente informado.</div>
 )}
 </SurfaceCard>
 </div>
 </section>
 );
}