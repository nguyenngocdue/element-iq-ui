import React from "react";
import { X, Bug } from "lucide-react";

export function AboutModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm shadow-2xl">
      <div className="bg-[#252526] border border-[#3c3c3c] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-[#3c3c3c] bg-[#1e1e1e]">
          <h2 className="text-xl font-bold text-white tracking-wider">About Element IQ</h2>
          <button onClick={onClose} className="p-1 hover:bg-[#3c3c3c] rounded transition-colors text-[#858585] hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4 text-sm text-[#cccccc]">
          <p>
            <strong className="text-white text-base">Element IQ</strong> is a comprehensive platform designed to allow engineers and planners to seamlessly analyze, audit, and extract insights from engineering drawings.
          </p>
          <p>
            By integrating advanced OCR and spatial analysis, Element IQ provides a holistic environment for rule-based drawing inspection, code compliance checking, and rapid error detection on PDF blueprints.
          </p>
          <div className="pt-4 mt-4 border-t border-[#3c3c3c]">
            <p>Element IQ version: 0.0.0</p>
            <p>Version ID: f4bcdb16-2f65-4f45-81aa-c50ad9080240</p>
          </div>
          <div className="pt-4 text-xs text-[#858585]">
            © 2026 Surbana Technologies. All rights reserved.
          </div>
        </div>
        <div className="flex items-center justify-end p-5 border-t border-[#3c3c3c] bg-[#1e1e1e] gap-3">
          <button onClick={onClose} className="px-6 py-2 text-sm font-semibold rounded bg-[#10b981] hover:bg-[#059669] text-white shadow-lg transition-colors shadow-[#10b981]/20">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function ReportIssueModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm shadow-2xl">
      <div className="bg-[#252526] border border-[#3c3c3c] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-[#3c3c3c] bg-[#1e1e1e] pb-3">
          <div>
            <h2 className="text-xl font-bold text-white tracking-wider flex items-center gap-2">Create Issue</h2>
            <p className="text-xs text-[#858585] mt-1">Raise a ticket directly into our development backlog.</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-[#3c3c3c] rounded transition-colors text-[#858585] hover:text-white -mt-4">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-bold text-[#cccccc] mb-2">Issue Type <span className="text-red-500">*</span></label>
            <div className="relative">
              <select className="w-full appearance-none bg-[#121212] border border-[#8a2be2] rounded px-3 py-2 text-sm focus:outline-none focus:border-[#a020f0] transition-colors text-white">
                <option value="bug">🐛 Bug</option>
                <option value="feature">✨ Feature Request</option>
                <option value="improvement">📈 Improvement</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#858585]">▼</div>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-bold text-[#cccccc] mb-2">Summary <span className="text-red-500">*</span></label>
            <input type="text" placeholder="Provide a concise summary of the problem" className="w-full bg-[#121212] border border-[#333] rounded px-3 py-2 text-sm focus:outline-none focus:border-[#10b981] transition-colors text-white placeholder-[#555]" />
          </div>

          <div>
            <label className="block text-sm font-bold text-[#cccccc] mb-2">Description</label>
            <textarea placeholder="Steps to reproduce, expected behavior, actual outcome..." className="w-full bg-[#121212] border border-[#333] rounded px-3 py-2 text-sm focus:outline-none focus:border-[#10b981] transition-colors text-white placeholder-[#555] min-h-[100px] resize-none"></textarea>
          </div>

          <div className="bg-[#1e1e1e] border border-[#333] rounded p-4 mt-4">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#858585] mb-2">Environment Footprint (Auto-Attached)</h4>
            <div className="text-xs text-[#cccccc] space-y-1 font-mono break-all">
              <p><span className="text-[#858585]">Client OS:</span> Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...</p>
              <p><span className="text-[#858585]">Element IQ Version:</span> f4bcdb16-2f65-4f45-81aa-c50ad9080240</p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end p-5 border-t border-[#3c3c3c] bg-[#1e1e1e] gap-3">
          <button onClick={onClose} className="px-6 py-2 text-sm font-semibold rounded text-[#cccccc] hover:text-white transition-colors">
            Cancel
          </button>
          <button onClick={onClose} className="px-6 py-2 text-sm font-semibold flex items-center gap-2 rounded transition-colors shadow-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white">
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
