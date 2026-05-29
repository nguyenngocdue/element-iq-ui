import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../store';
import { X, Brain, Send } from 'lucide-react';
import { cn } from '../lib/utils';
import ReactMarkdown from 'react-markdown';
import { useResizable } from '../hooks/useResizable';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export function ElementIQBot() {
  const { state, toggleBot } = useApp();
  const { width, isDragging, handleMouseDown } = useResizable({ initialWidth: 400, minWidth: 250, maxWidth: 600, direction: 'right' });
  const [messages, setMessages] = useState<Message[]>([

    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I am ElementIQ AI. I will soon be able to help you inspect engineering drawings in detail, clarify missing NF/FF note errors according to CODE_SEC_8.4, or provide troubleshooting advice.\n\n**This feature is coming soon!**',
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeSheet = state.files.find(f => f.id === state.activeFileId)?.name || 'None';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');

    // Simulate response
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Cảm ơn bạn đã hỏi. Vui lòng kiểm tra lại thiết lập trên bản vẽ ${activeSheet}.`,
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      };
      setMessages(prev => [...prev, assistantMessage]);
    }, 1000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{ width }} className="flex flex-col bg-[#16161a] border-l border-[#252526] h-full shrink-0 relative">
      {/* Resizer Handle */}
      <div 
        onMouseDown={handleMouseDown}
        className={cn("absolute top-0 left-[-3px] bottom-0 w-[6px] cursor-col-resize z-50 hover:bg-[#10b981] transition-colors", isDragging && "bg-[#10b981]")}
      />
      {/* Header */}
      <div className="p-4 border-b border-[#252526] flex items-start gap-3">
        <div className="w-8 h-8 rounded bg-[#10b981] flex items-center justify-center shrink-0">
          <Brain className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-white whitespace-nowrap overflow-hidden text-ellipsis leading-tight text-sm">Insight AI Blueprint Assistant</h2>
          <p className="text-[#10b981] text-xs mt-0.5">Standard ground rules: CODE_SEC_8.4 & NF/FF codes</p>
        </div>
        <button onClick={toggleBot} className="text-[#858585] hover:text-white shrink-0 mt-0.5">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Sub Header */}
      <div className="px-4 py-2 border-b border-[#252526] flex items-center justify-between text-xs bg-[#1a1a1f]">
        <span className="text-[#858585]">Active sheet: <span className="text-[#10b981] font-mono">{activeSheet}</span></span>
        <div className="flex items-center gap-1.5 text-[#eab308]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#eab308]"></span>
          Coming soon
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {messages.map((msg) => (
          <div key={msg.id} className={cn("flex flex-col", msg.role === 'user' ? "items-end" : "items-start")}>
            <div className="flex gap-2 max-w-[90%]">
              {msg.role === 'assistant' && (
                <div className="w-6 h-6 rounded border border-[#3c3c3c] flex items-center justify-center text-[#858585] shrink-0 mt-1">
                  <Brain className="w-4 h-4" />
                </div>
              )}
              <div className={cn("rounded-lg p-3 text-sm", msg.role === 'user' ? "bg-[#10b981] text-white" : "bg-[#252526] text-[#cccccc]")}>
                <div className="markdown-body text-sm bg-transparent !text-inherit">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            </div>
            <span className="text-[10px] text-[#858585] mt-1 px-8">{msg.timestamp}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-[#252526] bg-[#16161a]">
        <div className="relative flex items-end">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={true}
            placeholder="Insight AI is coming soon..."
            className="w-full bg-[#1a1a1f] border border-[#3c3c3c] rounded pl-3 pr-10 py-2.5 text-sm text-[#858585] focus:outline-none resize-none min-h-[44px] max-h-[150px] opacity-70 cursor-not-allowed"
            rows={1}
            style={{ fieldSizing: "content" } as any}
          />
          <button 
            onClick={handleSend}
            disabled={true}
            className="absolute right-2 bottom-1.5 p-1.5 bg-[#4c556b] hover:bg-[#5b6682] text-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
