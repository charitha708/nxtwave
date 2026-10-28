import { Link } from 'react-router-dom';
import { Waves } from 'lucide-react';

export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'sm' ? 'h-7 w-7' : size === 'lg' ? 'h-12 w-12' : 'h-9 w-9';
  const text = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-2xl' : 'text-lg';
  return (
    <Link to="/" className="flex items-center gap-2 group">
      <div className={`${dim} rounded-xl bg-primary flex items-center justify-center text-white shadow-sm group-hover:shadow-md transition-shadow`}>
        <Waves className="h-1/2 w-1/2" />
      </div>
      <div className="leading-tight">
        <div className={`${text} font-bold text-navy`}>Next Wave</div>
        <div className="text-[11px] text-muted -mt-0.5">Project Lab</div>
      </div>
    </Link>
  );
}
