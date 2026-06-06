import React from 'react';
import { Files, Search, BarChart3, Settings, Brain, PanelRight } from 'lucide-react';
import { useApp } from '../store';
import { cn } from '../lib/utils';

export function ActivityBar() {
  const { state, setActiveSidebarTab, toggleBot, toggleValidation } = useApp();

  const tabs: Array<{
    id: string;
    icon: any;
    action?: () => void;
    isActive?: boolean;
  }> = [
    { id: 'explorer', icon: Files },
    { id: 'search', icon: Search },
    { id: 'analysis', icon: BarChart3 },
    { id: 'validation', icon: PanelRight, action: toggleValidation, isActive: state.isValidationOpen },
    { id: 'bot', icon: Brain, action: toggleBot, isActive: state.isBotOpen },
    { id: 'settings', icon: Settings },
  ];

  return (
    <div className="w-[48px] bg-[#333333] flex flex-col items-center py-4 gap-6 shrink-0 border-r border-[#1e1e1e]">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.isActive !== undefined ? tab.isActive : state.activeSidebarTab === tab.id;
        const isBottom = tab.id === 'validation' || tab.id === 'bot' || tab.id === 'settings';
        
        return (
          <div
            key={tab.id}
            onClick={tab.action ? tab.action : () => setActiveSidebarTab(tab.id as 'explorer'|'search'|'analysis'|'settings'|'reports')}
            className={cn(
              "cursor-pointer transition-colors relative",
              isActive ? "text-white opacity-100" : "text-[#858585] hover:text-white",
              tab.id === 'validation' && "mt-auto"
            )}
            title={tab.id === 'validation' ? 'Toggle Validation Panel' : tab.id === 'bot' ? 'AI Assistant' : tab.id.charAt(0).toUpperCase() + tab.id.slice(1)}
          >
            {isActive && !isBottom && (
              <div className="absolute left-[-16px] top-0 bottom-0 w-1 bg-[#10b981]" />
            )}
            <Icon className="w-6 h-6 stroke-[1.5]" />
          </div>
        );
      })}
    </div>
  );
}
