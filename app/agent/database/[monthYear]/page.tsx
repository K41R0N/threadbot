'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import type { UserPrompt } from '@/lib/supabase-agent';

// Force dynamic rendering (requires authentication at runtime)
export const dynamic = 'force-dynamic';

export default function DatabasePage({ params }: { params: Promise<{ monthYear: string }> }) {
  const { monthYear } = use(params);
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedPrompts, setEditedPrompts] = useState<string[]>([]);

  // Parse month year
  const [year, month] = monthYear.split('-');
  const monthName = new Date(`${monthYear}-01`).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  // Calculate date range for the month
  const startDate = `${monthYear}-01`;
  const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
  const endDate = `${monthYear}-${lastDay.toString().padStart(2, '0')}`;

  const { data: prompts, refetch } = trpc.agent.getPrompts.useQuery({
    startDate,
    endDate,
  });

  const updatePrompt = trpc.agent.updatePrompt.useMutation({
    onSuccess: () => {
      toast.success('Prompt updated!');
      setEditingId(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deletePrompt = trpc.agent.deletePrompt.useMutation({
    onSuccess: () => {
      toast.success('Prompt deleted');
      refetch();
    },
  });

  const handleEdit = (prompt: UserPrompt) => {
    setEditingId(prompt.id);
    setEditedPrompts(prompt.prompts);
  };

  const handleSave = (id: string) => {
    updatePrompt.mutate({
      id,
      prompts: editedPrompts,
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditedPrompts([]);
  };

  const handleExportCSV = () => {
    if (!prompts || prompts.length === 0) {
      toast.error('No prompts to export');
      return;
    }

    // Create CSV content
    const headers = ['Name', 'Date', 'Week Theme', 'Post Type', 'Status', 'Prompts'];
    const rows = (prompts as UserPrompt[]).map((p) => [
      p.name,
      p.date,
      p.week_theme,
      p.post_type,
      p.status,
      p.prompts.map((prompt: string, i: number) => `${i + 1}. ${prompt}`).join(' '),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prompts-${monthYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success('CSV exported!');
  };

  // Group prompts by date
  const promptsByDate = (prompts as UserPrompt[] | undefined)?.reduce((acc: Record<string, UserPrompt[]>, prompt) => {
    if (!acc[prompt.date]) {
      acc[prompt.date] = [];
    }
    acc[prompt.date].push(prompt);
    return acc;
  }, {}) || {};

  const dates = Object.keys(promptsByDate).sort();

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b-2 border-black">
        <div className="container mx-auto px-4 py-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() => router.push('/dashboard')}
              >
                ← BACK
              </Button>
              <h1 className="text-4xl font-display">{monthName}</h1>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={handleExportCSV}>
                EXPORT CSV
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push('/settings')}
              >
                SETTINGS
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push('/dashboard')}
              >
                DASHBOARD
              </Button>
            </div>
          </div>

          {/* Breadcrumb */}
          <div className="text-sm text-gray-600">
            <span className="cursor-pointer hover:text-black" onClick={() => router.push('/dashboard')}>Dashboard</span>
            <span className="mx-2">→</span>
            <span>{monthName}</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {!prompts || prompts.length === 0 ? (
          <div className="border-2 border-black p-12 text-center">
            <p className="text-xl text-gray-600 mb-4">No prompts found for this month</p>
            <Button onClick={() => router.push('/agent')}>← BACK TO DATABASES</Button>
          </div>
        ) : (
          <div className="border-2 border-black">
            {/* Table Header */}
            <div className="bg-black text-white p-4 grid grid-cols-12 gap-4 font-display text-sm">
              <div className="col-span-2">DATE</div>
              <div className="col-span-2">WEEK THEME</div>
              <div className="col-span-1">TYPE</div>
              <div className="col-span-6">PROMPTS</div>
              <div className="col-span-1">ACTIONS</div>
            </div>

            {/* Table Body */}
            <div className="divide-y-2 divide-black">
              {dates.map((date) => {
                const datePrompts = promptsByDate[date].sort((a, b) =>
                  a.post_type === 'morning' ? -1 : 1
                );

                return datePrompts.map((prompt) => {
                  const isEditing = editingId === prompt.id;

                  return (
                    <div
                      key={prompt.id}
                      className="p-4 grid grid-cols-12 gap-4 hover:bg-gray-50 transition"
                    >
                      {/* Date */}
                      <div className="col-span-2 text-sm">
                        <div className="font-display">
                          {new Date(prompt.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </div>
                        <div className="text-gray-500 text-xs">
                          {new Date(prompt.date).toLocaleDateString('en-US', {
                            weekday: 'short',
                          })}
                        </div>
                      </div>

                      {/* Week Theme */}
                      <div className="col-span-2 text-sm">
                        <div className="text-gray-700">{prompt.week_theme}</div>
                      </div>

                      {/* Type */}
                      <div className="col-span-1 text-sm">
                        <span
                          className={`px-2 py-1 text-xs font-display ${
                            prompt.post_type === 'morning'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {prompt.post_type === 'morning' ? '🌅 AM' : '🌆 PM'}
                        </span>
                      </div>

                      {/* Prompts */}
                      <div className="col-span-6 text-sm">
                        {isEditing ? (
                          <div className="space-y-2">
                            {editedPrompts.map((p, i) => (
                              <Input
                                key={i}
                                value={p}
                                onChange={(e) => {
                                  const newPrompts = [...editedPrompts];
                                  newPrompts[i] = e.target.value;
                                  setEditedPrompts(newPrompts);
                                }}
                                className="text-xs"
                              />
                            ))}
                          </div>
                        ) : (
                          <ol className="list-decimal list-inside space-y-1 text-gray-700">
                            {prompt.prompts.map((p, i) => (
                              <li key={i} className="text-xs">
                                {p}
                              </li>
                            ))}
                          </ol>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="col-span-1 flex gap-2">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => handleSave(prompt.id)}
                              className="text-green-600 hover:text-green-800 text-xl"
                              title="Save"
                            >
                              ✓
                            </button>
                            <button
                              onClick={handleCancel}
                              className="text-red-600 hover:text-red-800 text-xl"
                              title="Cancel"
                            >
                              ×
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleEdit(prompt)}
                              className="text-blue-600 hover:text-blue-800 text-sm"
                              title="Edit"
                            >
                              ✎
                            </button>
                            <button
                              onClick={() => {
                                if (confirm('Delete this prompt?')) {
                                  deletePrompt.mutate({ id: prompt.id });
                                }
                              }}
                              className="text-red-600 hover:text-red-800 text-sm"
                              title="Delete"
                            >
                              🗑
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                });
              })}
            </div>
          </div>
        )}

        {/* Stats */}
        {prompts && prompts.length > 0 && (
          <div className="mt-8 border-2 border-black p-6">
            <h3 className="font-display text-xl mb-4">DATABASE STATS</h3>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <div className="text-3xl font-display">{prompts.length}</div>
                <div className="text-sm text-gray-600">Total Prompts</div>
              </div>
              <div>
                <div className="text-3xl font-display">
                  {(prompts as UserPrompt[]).filter((p) => p.post_type === 'morning').length}
                </div>
                <div className="text-sm text-gray-600">Morning Prompts</div>
              </div>
              <div>
                <div className="text-3xl font-display">
                  {(prompts as UserPrompt[]).filter((p) => p.post_type === 'evening').length}
                </div>
                <div className="text-sm text-gray-600">Evening Prompts</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
