'use client';

import { useState, useMemo } from 'react';
import type { UserPrompt } from '@/lib/supabase-agent';

interface PromptCalendarProps {
  prompts: UserPrompt[];
  startDate: string;
  endDate: string;
  onDayClick: (date: string, prompts: UserPrompt[]) => void;
}

export function PromptCalendar({ prompts, startDate, endDate, onDayClick }: PromptCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const start = new Date(startDate);
    return new Date(start.getFullYear(), start.getMonth(), 1);
  });

  // Group prompts by date
  const promptsByDate = useMemo(() => {
    const grouped: Record<string, UserPrompt[]> = {};
    prompts.forEach((prompt) => {
      const dateKey = prompt.date;
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(prompt);
    });
    return grouped;
  }, [prompts]);

  // Get calendar days for current month
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    // First day of month
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // Start from Sunday of the week containing first day
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());
    
    // End on Saturday of the week containing last day
    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));
    
    const days: Array<{ date: Date; isCurrentMonth: boolean; dateKey: string }> = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
      const dateKey = current.toISOString().split('T')[0];
      days.push({
        date: new Date(current),
        isCurrentMonth: current.getMonth() === month,
        dateKey,
      });
      current.setDate(current.getDate() + 1);
    }
    
    return days;
  }, [currentMonth]);

  // Check if date is in the prompt range
  const isInRange = (dateKey: string) => {
    return dateKey >= startDate && dateKey <= endDate;
  };

  // Navigate months
  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  };

  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="border-2 border-black">
      {/* Calendar Header */}
      <div className="bg-black text-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={goToPreviousMonth}
            className="hover:bg-gray-800 p-2 rounded transition"
            aria-label="Previous month"
          >
            ←
          </button>
          <button
            onClick={goToToday}
            className="hover:bg-gray-800 px-4 py-2 rounded transition font-display text-sm"
          >
            TODAY
          </button>
          <button
            onClick={goToNextMonth}
            className="hover:bg-gray-800 p-2 rounded transition"
            aria-label="Next month"
          >
            →
          </button>
          <h2 className="font-display text-2xl ml-4">{monthName}</h2>
        </div>
      </div>

      {/* Week Day Headers */}
      <div className="grid grid-cols-7 border-b-2 border-black bg-gray-100">
        {weekDays.map((day) => (
          <div key={day} className="p-3 text-center font-display text-sm border-r-2 border-black last:border-r-0">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7">
        {calendarDays.map((dayInfo, index) => {
          const dayPrompts = promptsByDate[dayInfo.dateKey] || [];
          const isToday = dayInfo.dateKey === new Date().toISOString().split('T')[0];
          const hasPrompts = dayPrompts.length > 0;
          const inRange = isInRange(dayInfo.dateKey);

          return (
            <div
              key={index}
              className={`
                min-h-[120px] border-r-2 border-b-2 border-black last:border-r-0
                ${!dayInfo.isCurrentMonth ? 'bg-gray-50' : 'bg-white'}
                ${isToday ? 'ring-2 ring-blue-500 ring-inset' : ''}
                ${hasPrompts && inRange ? 'cursor-pointer hover:bg-gray-50' : ''}
                ${!inRange ? 'opacity-50' : ''}
              `}
              onClick={() => {
                if (hasPrompts && inRange) {
                  onDayClick(dayInfo.dateKey, dayPrompts);
                }
              }}
            >
              {/* Date Number */}
              <div className="p-2">
                <div
                  className={`
                    text-sm font-display mb-1
                    ${!dayInfo.isCurrentMonth ? 'text-gray-400' : 'text-black'}
                    ${isToday ? 'font-bold text-blue-600' : ''}
                  `}
                >
                  {dayInfo.date.getDate()}
                </div>

                {/* Prompts */}
                {hasPrompts && inRange && (
                  <div className="space-y-1">
                    {dayPrompts.map((prompt) => (
                      <div
                        key={prompt.id}
                        className={`
                          text-xs p-1 rounded border
                          ${prompt.post_type === 'morning' 
                            ? 'bg-yellow-100 border-yellow-300 text-yellow-800' 
                            : 'bg-blue-100 border-blue-300 text-blue-800'
                          }
                        `}
                        title={`${prompt.post_type === 'morning' ? '🌅 AM' : '🌆 PM'}: ${prompt.prompts[0]?.substring(0, 30)}...`}
                      >
                        <div className="flex items-center gap-1">
                          <span>{prompt.post_type === 'morning' ? '🌅' : '🌆'}</span>
                          <span className="truncate">{prompt.prompts.length} prompts</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

