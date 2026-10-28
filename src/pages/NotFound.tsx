import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center px-4">
      <h1 className="text-6xl font-bold text-pale">404</h1>
      <p className="text-xl font-semibold text-navy mt-4">Page not found</p>
      <p className="text-muted mt-2">The page you're looking for doesn't exist.</p>
      <Link to="/" className="btn-primary mt-6"><ArrowLeft className="h-4 w-4" /> Back to home</Link>
    </div>
  );
}
