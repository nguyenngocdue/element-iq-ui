import React from 'react';
import { Files, Search, BarChart3, Settings } from 'lucide-react';
import { useApp } from '../store';
import { cn } from '../lib/utils';

export function ActivityBar() {
  const { state, setActiveSidebarTab } = useApp();

  const tabs = [
    { id: 'explorer', icon: Files },
    { id: 'search', icon: Search },
    { id: 'analysis', icon: BarChart3 },
    { id: 'settings', icon: Settings },
  ] as const;

  return (
    <div className="w-[48px] bg-[#333333] flex flex-col items-center py-4 gap-6 shrink-0 border-r border-[#1e1e1e]">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = state.activeSidebarTab === tab.id;
        
        return (
          <div
            key={tab.id}
            onClick={() => setActiveSidebarTab(tab.id)}
            className={cn(
              "cursor-pointer transition-colors",
              isActive ? "text-white opacity-100" : "text-[#858585] hover:text-white",
              tab.id === 'settings' && "mt-auto"
            )}
          >
            <Icon className="w-6 h-6 stroke-[1.5]" />
          </div>
        );
      })}
    </div>
  );
}
