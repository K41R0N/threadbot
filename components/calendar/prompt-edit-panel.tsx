'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { UserPrompt } from '@/lib/supabase-agent';
import { X } from 'lucide-react';

interface PromptEditPanelProps {
  date: string;
  prompts: UserPrompt[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, prompts: string[]) => void;
  onDelete: (id: string) => void;
}

export function PromptEditPanel({
  date,
  prompts,
  isOpen,
  onClose,
  onSave,
  onDelete,
}: PromptEditPanelProps) {
  const [editingPrompts, setEditingPrompts] = useState<Record<string, string[]>>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Initialize editing state
      const initial: Record<string, string[]> = {};
      prompts.forEach((prompt) => {
        initial[prompt.id] = [...prompt.prompts];
      });
      setEditingPrompts(initial);
      setEditingId(null);
    }
  }, [isOpen, prompts]);

  if (!isOpen) return null;

  const formattedDate = new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const handlePromptChange = (promptId: string, index: number, value: string) => {
    setEditingPrompts((prev) => {
      const updated = { ...prev };
      if (!updated[promptId]) {
        updated[promptId] = [];
      }
      updated[promptId] = [...updated[promptId]];
      updated[promptId][index] = value;
      return updated;
    });
  };

  const handleSave = (promptId: string) => {
    const promptsToSave = editingPrompts[promptId];
    if (promptsToSave) {
      onSave(promptId, promptsToSave);
      setEditingId(null);
    }
  };

  const handleCancel = (promptId: string) => {
    // Reset to original
    const originalPrompt = prompts.find((p) => p.id === promptId);
    if (originalPrompt) {
      setEditingPrompts((prev) => ({
        ...prev,
        [promptId]: [...originalPrompt.prompts],
      }));
    }
    setEditingId(null);
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-96 bg-white border-l-4 border-black shadow-2xl z-50 overflow-y-auto">
      {/* Header */}
      <div className="bg-black text-white p-6 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h2 className="font-display text-2xl mb-1">EDIT PROMPTS</h2>
          <p className="text-sm text-gray-300">{formattedDate}</p>
        </div>
        <button
          onClick={onClose}
          className="hover:bg-gray-800 p-2 rounded transition"
          aria-label="Close panel"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {prompts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>No prompts for this date</p>
          </div>
        ) : (
          prompts.map((prompt) => {
            const isEditing = editingId === prompt.id;
            const promptTexts = editingPrompts[prompt.id] || prompt.prompts;

            return (
              <div
                key={prompt.id}
                className="border-2 border-black p-4 space-y-4"
              >
                {/* Prompt Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 text-xs font-display ${
                      prompt.post_type === 'morning'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {prompt.post_type === 'morning' ? '🌅 AM' : '🌆 PM'}
                    </span>
                    <span className="text-xs text-gray-600">{prompt.week_theme}</span>
                  </div>
                  {!isEditing && (
                    <button
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this prompt?')) {
                          onDelete(prompt.id);
                        }
                      }}
                      className="text-red-600 hover:text-red-800 text-xs"
                    >
                      Delete
                    </button>
                  )}
                </div>

                {/* Prompts List */}
                {isEditing ? (
                  <div className="space-y-2">
                    {promptTexts.map((text, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <span className="text-sm text-gray-500 mt-2">{index + 1}.</span>
                        <textarea
                          value={text}
                          onChange={(e) => handlePromptChange(prompt.id, index, e.target.value)}
                          className="flex-1 text-sm border-2 border-black px-3 py-2 font-display min-h-[60px] resize-y"
                          rows={3}
                        />
                      </div>
                    ))}
                    <div className="flex gap-2 pt-2">
                      <Button
                        onClick={() => handleSave(prompt.id)}
                        className="flex-1"
                        size="sm"
                      >
                        SAVE
                      </Button>
                      <Button
                        onClick={() => handleCancel(prompt.id)}
                        variant="outline"
                        className="flex-1"
                        size="sm"
                      >
                        CANCEL
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
                      {promptTexts.map((text, index) => (
                        <li key={index} className="mb-2">{text}</li>
                      ))}
                    </ol>
                    <Button
                      onClick={() => setEditingId(prompt.id)}
                      variant="outline"
                      className="w-full mt-4"
                      size="sm"
                    >
                      EDIT PROMPTS
                    </Button>
                  </div>
                )}

                {/* Response (if exists) */}
                {prompt.response && (
                  <div className="mt-4 pt-4 border-t-2 border-gray-200">
                    <p className="text-xs text-gray-500 mb-1">Your Response:</p>
                    <p className="text-sm text-gray-700">{prompt.response}</p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

