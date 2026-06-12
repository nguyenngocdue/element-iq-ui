import React, { useState } from 'react';
import { useApp } from '../store';
import { Download, Folder, CheckCircle, AlertTriangle, XCircle, Search, FileText, Clock } from 'lucide-react';
import { cn } from '../lib/utils';
import { filterFilesByBucket } from '../lib/analysisStatus';
import { DocumentFile } from '../types';
import { ReportStatusBadge } from './StatusLabel';

type ReportFilter = 'ALL' | DocumentFile['status'];

const REPORT_FILTERS: Array<{ id: ReportFilter; label: string; className?: string }> = [
  { id: 'ALL', label: 'ALL' },
  { id: 'PASS', label: 'PASS', className: 'text-[#2eb886]' },
  { id: 'FAIL', label: 'FAIL', className: 'text-[#ef4444]' },
  { id: 'NO-NOTE', label: 'NO-NOTE', className: 'text-[#bba438]' },
  { id: 'NO-TUBE', label: 'NO-TUBE', className: 'text-[#fb923c]' },
  { id: 'WARN', label: 'WARN', className: 'text-[#f59e0b]' },
  { id: 'PENDING', label: 'READY', className: 'text-[#858585]' },
];

export function AnalysisDashboard() {
  const { state } = useApp();
  const [filter, setFilter] = useState<ReportFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const passList = filterFilesByBucket(state.files, 'pass');
  const failList = filterFilesByBucket(state.files, 'fail');
  const noNoteList = state.files.filter((f) => f.status === 'NO-NOTE');
  const noTubeList = state.files.filter((f) => f.status === 'NO-TUBE');
  const warnList = state.files.filter((f) => f.status === 'WARN');
  
  const totalPassRate = state.files.length ? Math.round((passList.length / state.files.length) * 100) : 0;
  
  const totalNF = state.files.reduce((acc, f) => acc + f.detections.filter(d => d.type === 'NF').length, 0);
  const totalFF = state.files.reduce((acc, f) => acc + f.detections.filter(d => d.type === 'FF').length, 0);

  const filteredDocs = state.files.filter(f => {
    if (filter !== 'ALL' && f.status !== filter) return false;
    if (searchQuery && !f.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex-1 bg-[#16161a] flex flex-col overflow-hidden text-[#cccccc] font-sans p-8">
      {/* Header */}
      <div className="flex justify-between items-start mb-8 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Batch Analysis Summary</h1>
          <p className="text-[#858585] text-sm">Comprehensive compliance audit and insights for the current workspace.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-[#252526] rounded-sm border border-[#3c3c3c] overflow-hidden text-xs font-semibold">
            {REPORT_FILTERS.map(({ id, label, className }) => (
              <FilterButton
                key={id}
                active={filter === id}
                onClick={() => setFilter(id)}
                className={className}
              >
                {label}
              </FilterButton>
            ))}
          </div>
          <button className="bg-[#1e5cdc] hover:bg-[#2563eb] text-white px-4 py-2 rounded-sm font-medium text-sm flex items-center gap-2 transition-colors">
            <Download className="w-4 h-4" /> Export Report
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-6 mb-8 shrink-0">
        <SummaryCard 
          icon={<Folder className="w-5 h-5 text-[#1e5cdc]" />}
          iconBg="bg-[#1e5cdc]/10"
          value={state.files.length}
          label="TOTAL DOCUMENTS"
        />
        <SummaryCard 
          icon={<CheckCircle className="w-5 h-5 text-[#2eb886]" />}
          iconBg="bg-[#2eb886]/10"
          value={passList.length}
          label="FULLY COMPLIANT"
          badge={`${totalPassRate}% PASS`}
          badgeColor="text-[#2eb886] bg-[#2eb886]/10"
        />
        <SummaryCard 
          icon={<AlertTriangle className="w-5 h-5 text-[#d4b238]" />}
          iconBg="bg-[#d4b238]/10"
          value={noNoteList.length}
          label="NO NF/FF NOTES"
          badge="NO-NOTE"
          badgeColor="text-[#bba438] bg-[#bba438]/10"
        />
        <SummaryCard 
          icon={<XCircle className="w-5 h-5 text-[#ef4444]" />}
          iconBg="bg-[#ef4444]/10"
          value={failList.length}
          label="CRITICAL VIOLATIONS"
        />
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-3 gap-6 flex-1 min-h-0">
        
        {/* Document Compliance List */}
        <div className="col-span-2 bg-[#1e1e24] border border-[#2b2d35] rounded-xl flex flex-col overflow-hidden">
          <div className="p-5 flex justify-between items-center border-b border-[#2b2d35] shrink-0">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Document Compliance List</h2>
            <div className="relative">
              <Search className="w-4 h-4 text-[#858585] absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Search drawings..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-[#16161a] border border-[#3c3c3c] text-sm text-white rounded-md pl-9 pr-4 py-1.5 focus:outline-none focus:border-[#10b981] w-64"
              />
            </div>
          </div>

          <div className="overflow-auto flex-1 text-sm">
            <table className="w-full text-left border-collapse relative">
              <thead className="sticky top-0 bg-[#1e1e24] z-10 shadow-sm border-b border-[#2b2d35]">
                <tr className="text-[#858585] text-xs uppercase tracking-wider">
                  <th className="px-5 py-4 font-semibold">Document Name</th>
                  <th className="px-5 py-4 font-semibold">Analysis Coverage</th>
                  <th className="px-5 py-4 font-semibold">Status</th>
                  <th className="px-5 py-4 font-semibold text-right">Extracted Data</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-[#858585]">No documents found.</td>
                  </tr>
                ) : filteredDocs.map(doc => (
                  <DocumentRow key={doc.id} doc={doc} />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Validation Breakdown & Stats */}
        <div className="flex flex-col gap-6 overflow-y-auto pb-4 pr-1">
          
          <div className="bg-[#1e1e24] border border-[#2b2d35] rounded-xl p-6">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-6 flex items-center gap-2">
              <span className="w-4 h-4 rounded-full border border-white/30 flex items-center justify-center text-[8px]">✓</span>
              Validation Breakdown
            </h2>
            
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2 text-sm">
                <span className="text-[#cccccc]">Compliant (PASS)</span>
                <span className="text-[#2eb886] font-bold">{passList.length} docs</span>
              </div>
              <div className="h-2 w-full bg-[#16161a] rounded-sm overflow-hidden">
                <div className="h-full bg-[#2eb886]" style={{ width: `${state.files.length ? (passList.length/state.files.length)*100 : 0}%` }}></div>
              </div>
            </div>

            <div className="mb-6">
              <div className="flex justify-between items-center mb-2 text-sm">
                <span className="text-[#cccccc]">Critical (FAIL)</span>
                <span className="text-[#ef4444] font-bold">{failList.length} docs</span>
              </div>
              <div className="h-2 w-full bg-[#16161a] rounded-sm overflow-hidden">
                <div className="h-full bg-[#ef4444]" style={{ width: `${state.files.length ? (failList.length/state.files.length)*100 : 0}%` }}></div>
              </div>
            </div>

            <div className="mb-6">
              <div className="flex justify-between items-center mb-2 text-sm">
                <span className="text-[#cccccc]">No note (NO-NOTE)</span>
                <span className="text-[#bba438] font-bold">{noNoteList.length} docs</span>
              </div>
              <div className="h-2 w-full bg-[#16161a] rounded-sm overflow-hidden">
                <div className="h-full bg-[#bba438]" style={{ width: `${state.files.length ? (noNoteList.length/state.files.length)*100 : 0}%` }}></div>
              </div>
            </div>

            <div className="mb-6">
              <div className="flex justify-between items-center mb-2 text-sm">
                <span className="text-[#cccccc]">No tube (NO-TUBE)</span>
                <span className="text-[#fb923c] font-bold">{noTubeList.length} docs</span>
              </div>
              <div className="h-2 w-full bg-[#16161a] rounded-sm overflow-hidden">
                <div className="h-full bg-[#fb923c]" style={{ width: `${state.files.length ? (noTubeList.length/state.files.length)*100 : 0}%` }}></div>
              </div>
            </div>

            <div className="mb-8">
              <div className="flex justify-between items-center mb-2 text-sm">
                <span className="text-[#cccccc]">Warnings (WARN)</span>
                <span className="text-[#f59e0b] font-bold">{warnList.length} docs</span>
              </div>
              <div className="h-2 w-full bg-[#16161a] rounded-sm overflow-hidden">
                <div className="h-full bg-[#f59e0b]" style={{ width: `${state.files.length ? (warnList.length/state.files.length)*100 : 0}%` }}></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#16161a] border border-[#2b2d35] p-4 rounded-lg flex flex-col items-center justify-center">
                <span className="text-[10px] font-bold text-[#1e5cdc] uppercase mb-1">Extracted NF Quantities</span>
                <span className="text-3xl font-light text-[#b4c5ff]">{totalNF}</span>
              </div>
              <div className="bg-[#16161a] border border-[#2b2d35] p-4 rounded-lg flex flex-col items-center justify-center">
                <span className="text-[10px] font-bold text-[#d4b238] uppercase mb-1">Extracted FF Quantities</span>
                <span className="text-3xl font-light text-[#ffe893]">{totalFF}</span>
              </div>
            </div>
          </div>

          <div className="bg-[#1e1e24] border border-[#2b2d35] rounded-xl p-6 flex-1">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-6">Recent Activity</h2>
            <div className="flex flex-col gap-4 text-sm text-[#858585]">
              {state.files.slice(-5).map(f => (
                <div key={`act-${f.id}`} className="flex items-start gap-3">
                  <Clock className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-white">Analysis finished</span> for {f.name}
                  </div>
                </div>
              ))}
              {state.files.length === 0 && <div className="text-center opacity-50 pt-4">No recent activity.</div>}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function FilterButton({ active, children, onClick, className }: any) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "px-4 py-2 flex-1 transition-colors border-r border-[#3c3c3c] last:border-0",
        active ? "bg-[#333333] text-white" : "hover:bg-[#2d2d2d] text-[#858585]",
        className
      )}
    >
      {children}
    </button>
  );
}

function SummaryCard({ icon, iconBg, value, label, badge, badgeColor }: any) {
  return (
    <div className="bg-[#1e1e24] border border-[#2b2d35] rounded-xl p-6 relative flex flex-col justify-between h-[140px]">
      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center mb-4", iconBg)}>
        {icon}
      </div>
      <div>
        <div className="text-3xl font-light text-white mb-1 leading-none">{value}</div>
        <div className="text-[11px] font-bold text-[#858585] uppercase tracking-wider">{label}</div>
      </div>
      {badge && (
        <div className={cn("absolute top-6 right-6 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider", badgeColor)}>
          {badge}
        </div>
      )}
    </div>
  );
}

function DocumentRow({ doc }: { key?: React.Key, doc: DocumentFile }) {
  const nfCount = doc.detections.filter(d => d.type === 'NF').length;
  const ffCount = doc.detections.filter(d => d.type === 'FF').length;
  const coverage = doc.status === 'PENDING' ? 0 : doc.status === 'ANALYZING' ? 50 : 100;

  return (
    <tr className="border-b border-[#2b2d35]/50 hover:bg-[#25272e] transition-colors group">
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <FileText className="w-4 h-4 text-[#2eb886] opacity-80" />
          <span className="font-medium text-white group-hover:text-primary transition-colors cursor-pointer">{doc.name}</span>
        </div>
      </td>
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="h-1.5 w-24 bg-[#16161a] rounded-sm overflow-hidden">
             <div className="h-full bg-[#2eb886]" style={{ width: `${coverage}%` }}></div>
          </div>
          <span className="text-xs font-mono text-[#858585]">{coverage}%</span>
        </div>
      </td>
      <td className="px-5 py-4">
        <ReportStatusBadge status={doc.status} overallStatus={doc.overallStatus} />
      </td>
      <td className="px-5 py-4">
        <div className="flex items-center justify-end gap-2 font-mono text-[10px]">
          <span className="border border-[#1e5cdc]/30 text-[#82aaff] px-1.5 py-0.5 rounded-sm bg-[#1e5cdc]/10">NF: {nfCount}</span>
          <span className="border border-[#d4b238]/30 text-[#d4b238] px-1.5 py-0.5 rounded-sm bg-[#d4b238]/10">FF: {ffCount}</span>
        </div>
      </td>
    </tr>
  );
}
