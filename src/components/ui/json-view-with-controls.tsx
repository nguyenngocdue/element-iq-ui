import { useState } from 'react';
import { Check, Copy, ExternalLink, Maximize2, Minimize2, X } from 'lucide-react';
import JsonView from './json-view';
import { useCopy } from '../../hooks/use-copy';

interface JsonViewWithControlsProps {
  data: unknown;
  className?: string;
  defaultExpandAll?: boolean;
  title?: string;
}

function toJsonString(data: unknown): string {
  if (typeof data === 'string') return data;
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

export function JsonViewWithControls({
  data,
  className = '',
  defaultExpandAll = false,
  title = 'JSON Data Viewer',
}: JsonViewWithControlsProps) {
  const { copied, copy } = useCopy();
  const [expandAll, setExpandAll] = useState(defaultExpandAll);
  const [isPopupOpen, setIsPopupOpen] = useState(false);

  const controls = (
    <div className="flex gap-1">
      <button
        type="button"
        className="flex h-8 w-8 items-center justify-center rounded-md text-[#858585] hover:bg-[#3c3c3c] hover:text-white transition-colors"
        onClick={() => setExpandAll((value) => !value)}
        title={expandAll ? 'Collapse All' : 'Expand All'}
      >
        {expandAll ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </button>
      <button
        type="button"
        className="flex h-8 w-8 items-center justify-center rounded-md text-[#858585] hover:bg-[#3c3c3c] hover:text-white transition-colors"
        onClick={() => void copy(toJsonString(data))}
        title="Copy JSON"
      >
        {copied ? <Check className="h-4 w-4 text-[#2eb886]" /> : <Copy className="h-4 w-4" />}
      </button>
      <button
        type="button"
        className="flex h-8 w-8 items-center justify-center rounded-md text-[#858585] hover:bg-[#3c3c3c] hover:text-white transition-colors"
        onClick={() => setIsPopupOpen(true)}
        title="Open in Popup"
      >
        <ExternalLink className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <>
      <div className={`flex w-full flex-col ${className}`}>
        <div className="mb-2 ml-auto flex">{controls}</div>
        <JsonView data={data} expandAll={expandAll} initialExpandDepth={2} />
      </div>

      {isPopupOpen ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
          onClick={() => setIsPopupOpen(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-[#3c3c3c] bg-[#252526] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#3c3c3c] px-4 py-3">
              <span className="text-sm font-semibold text-white">{title}</span>
              <div className="flex items-center gap-2">
                {controls}
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-md text-[#858585] hover:bg-[#3c3c3c] hover:text-white transition-colors"
                  onClick={() => setIsPopupOpen(false)}
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <JsonView data={data} expandAll={expandAll} initialExpandDepth={2} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
