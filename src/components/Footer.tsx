import { Link } from 'react-router-dom';
import { Waves } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface mt-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-white">
                <Waves className="h-4 w-4" />
              </div>
              <span className="font-bold text-navy">Next Wave Project Lab</span>
            </div>
            <p className="text-sm text-muted max-w-md">
              A Next Wave initiative helping students move beyond building projects to truly
              understanding how real-world software works.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-ink mb-3">Platform</h4>
            <ul className="space-y-2 text-sm text-muted">
              <li><Link to="/assessment" className="hover:text-primary">Assessment</Link></li>
              <li><Link to="/workshop" className="hover:text-primary">Workshop</Link></li>
              <li><Link to="/register" className="hover:text-primary">Register</Link></li>
              <li><Link to="/admin" className="hover:text-primary">Admin</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-ink mb-3">Legal</h4>
            <ul className="space-y-2 text-sm text-muted">
              <li><Link to="/privacy" className="hover:text-primary">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-primary">Terms of Use</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-10 pt-6 border-t border-line text-xs text-muted">
          &copy; {new Date().getFullYear()} Next Wave. Next Wave Project Lab is a Next Wave initiative.
        </div>
      </div>
    </footer>
  );
}
