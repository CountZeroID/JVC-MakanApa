import { cn } from '../../lib/utils';

interface MacroBarProps {
  label: string;
  value: number;
  color: string;
  max?: number;
  unit?: string;
}

interface VitaminBarProps {
  label: string;
  value: number;
  akg: number;
  unit: string;
}

export function MacroBar({ label, value, color, max = 100, unit = "g" }: MacroBarProps) {
    const percentage = Math.min(100, Math.max(2, (value / max) * 100)); 
    return (
        <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-bold">
              <span className="text-text-secondary uppercase tracking-widest">{label}</span>
              <span className="text-text-primary">{Math.round(value)}{unit}</span>
            </div>
            <div className="w-full h-2 bg-bg-main rounded-full overflow-hidden border border-border/50">
                <div 
                    className={cn("h-full rounded-full transition-all duration-1000 ease-out", color)} 
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
}

export function VitaminBar({ label, value, akg, unit }: VitaminBarProps) {
    const percentage = Math.round(Math.min(100, (value / akg) * 100)); 
    return (
        <div className="space-y-2 relative" title={`AKG: Angka Kecukupan Gizi harian (${akg}${unit})`}>
            <div className="flex justify-between items-end">
              <span className="text-[11px] font-semibold text-text-primary">{label}</span>
              <span className="text-[10px] text-text-secondary font-medium">{Math.round(value)}{unit} <span className="text-primary-light font-bold">({percentage}%)</span></span>
            </div>
            <div className="h-2 w-full bg-border rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full bg-primary-light/80" 
                  style={{ width: `${percentage}%` }} 
                />
            </div>
        </div>
    );
}
