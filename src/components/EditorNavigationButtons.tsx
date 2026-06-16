import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';

export function EditorNavigationButtons({
  canGoBack,
  canGoForward,
  onGoBack,
  onGoForward,
  className,
}: {
  canGoBack: boolean;
  canGoForward: boolean;
  onGoBack: () => void;
  onGoForward: () => void;
  className?: string;
}) {
  const btnClass = (enabled: boolean) =>
    cn(
      'h-7 w-7 flex items-center justify-center rounded-sm transition-colors',
      enabled
        ? 'text-[#cccccc] hover:bg-[#3c3c3c] hover:text-white'
        : 'text-[#5a5a5a] cursor-not-allowed',
    );

  return (
    <div className={cn('flex items-center gap-0 shrink-0', className)}>
      <button
        type="button"
        disabled={!canGoBack}
        title="Go Back (Alt+LeftArrow)"
        aria-label="Go Back"
        onClick={onGoBack}
        className={btnClass(canGoBack)}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <button
        type="button"
        disabled={!canGoForward}
        title="Go Forward (Alt+RightArrow)"
        aria-label="Go Forward"
        onClick={onGoForward}
        className={btnClass(canGoForward)}
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
