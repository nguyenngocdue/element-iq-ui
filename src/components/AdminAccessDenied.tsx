import { ArrowLeft, ShieldOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BrandHeader } from './LoadingScreen';

export type AdminArea = 'admin' | 'model-lab';

const AREA_LABEL: Record<AdminArea, string> = {
  admin: 'Admin Console',
  'model-lab': 'Model Lab',
};

interface AdminAccessDeniedProps {
  area?: AdminArea;
}

export function AdminAccessDenied({ area = 'admin' }: AdminAccessDeniedProps) {
  const navigate = useNavigate();
  const pageName = AREA_LABEL[area];

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-10">
          <BrandHeader size="md" />
        </div>

        <div className="bg-[#1e1e1e] border border-[#3c3c3c] rounded-xl p-8 shadow-2xl">
          <div className="flex flex-col items-center text-center">
            <div className="p-3.5 rounded-full bg-[#ef4444]/10 mb-5">
              <ShieldOff className="w-7 h-7 text-[#ef4444]" strokeWidth={1.75} />
            </div>

            <h2 className="text-lg font-semibold text-white mb-2">Access denied</h2>
            <p className="text-sm text-[#a0a5b5] leading-relaxed max-w-sm">
              <span className="text-white font-medium">{pageName}</span> is restricted to accounts with the{' '}
              <span className="text-white font-medium">ADMIN</span> role. Contact a Super Admin if you need access.
            </p>
          </div>

          <div className="mt-8 flex flex-col items-center">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-[#10b981] hover:bg-[#059669] text-white text-sm font-semibold transition-colors w-full sm:w-auto"
            >
              Back to home
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="mt-4 inline-flex items-center justify-center text-xs text-[#858585] hover:text-[#cccccc] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
              Go back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
