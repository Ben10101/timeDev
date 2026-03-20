import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

export default function StatCard({ label, value, description, icon: Icon, trend, trendValue, color = 'blue' }) {
  const colorMap = {
    blue: 'text-blue-600 bg-blue-50 border-blue-100',
    emerald: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    amber: 'text-amber-600 bg-amber-50 border-amber-100',
    rose: 'text-rose-600 bg-rose-50 border-rose-100',
    indigo: 'text-indigo-600 bg-indigo-50 border-indigo-100',
  };

  const selectedColor = colorMap[color] || colorMap.blue;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="group relative overflow-hidden rounded-[24px] border border-white/60 bg-white/40 p-6 shadow-sm backdrop-blur-md transition-all hover:border-blue-200/60 hover:shadow-xl hover:shadow-blue-900/5 hover:-translate-y-1"
    >
      <div className="flex items-start justify-between">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${selectedColor}`}>
                <Icon size={20} strokeWidth={2.5} />
              </div>
            )}
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500/80">
              {label}
            </p>
          </div>
          
          <div>
            <h3 className="text-3xl font-bold tracking-tight text-slate-900">
              {value}
            </h3>
            {description && (
              <p className="mt-1 text-xs font-medium text-slate-400">
                {description}
              </p>
            )}
          </div>

          {trend && (
            <div className="flex items-center gap-1.5 pt-1">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                trend === 'up' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
              }`}>
                {trend === 'up' ? '↑' : '↓'} {trendValue}
              </span>
              <span className="text-[10px] font-medium text-slate-400">vs last month</span>
            </div>
          )}
        </div>
      </div>

      {/* Subtle bottom gradient decoration */}
      <div className={`absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-transparent via-${color}-500/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100`} />
    </motion.div>
  );
}
