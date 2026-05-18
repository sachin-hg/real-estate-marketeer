import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2, X } from 'lucide-react'
import { getPrompts, createPrompt, updatePrompt, deletePrompt } from '../lib/api'
import type { Prompt } from '../lib/types'

const MEDIA_FORMAT_BADGE: Record<string, string> = {
  branded_card: 'bg-purple-100 text-purple-700',
  meme_overlay: 'bg-sky-100 text-sky-700',
  text_only: 'bg-slate-100 text-slate-600',
}

const MEDIA_FORMAT_OPTIONS = ['', 'branded_card', 'meme_overlay', 'text_only', 'video_short']

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 50)
}

interface FormState {
  id: string
  event: string
  tags: string
  card: string
  caption: string
  city_hint: string
  media_format: string
  meme_concept: string
}

function PromptModal({
  initial,
  onClose,
  onSave,
  isEditing,
}: {
  initial?: Prompt
  onClose: () => void
  onSave: (data: Partial<Prompt>) => void
  isEditing: boolean
}) {
  const [form, setForm] = useState<FormState>({
    id: initial?.id ?? '',
    event: initial?.event ?? '',
    tags: (initial?.tags ?? []).join(', '),
    card: initial?.card ?? '',
    caption: initial?.caption ?? '',
    city_hint: initial?.city_hint ?? '',
    media_format: initial?.media_format ?? '',
    meme_concept: initial?.meme_concept ?? '',
  })

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const val = e.target.value
    setForm((f) => ({
      ...f,
      [key]: val,
      ...(key === 'event' && !isEditing ? { id: slugify(val) } : {}),
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      id: form.id,
      event: form.event,
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      card: form.card,
      caption: form.caption || undefined,
      city_hint: form.city_hint || undefined,
      media_format: form.media_format || undefined,
      meme_concept: form.meme_concept || undefined,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">
            {isEditing ? 'Edit Prompt' : 'Add Prompt'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-600">Event *</label>
            <input
              required
              value={form.event}
              onChange={set('event')}
              className="mt-1 w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand"
              placeholder="e.g. RCB won IPL 2025"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">ID *</label>
            <input
              required
              value={form.id}
              onChange={set('id')}
              className="mt-1 w-full text-sm border border-slate-200 rounded-lg px-3 py-2 font-mono focus:outline-none focus:border-brand"
              placeholder="auto-generated from event"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Tags (comma-separated)</label>
            <input
              value={form.tags}
              onChange={set('tags')}
              className="mt-1 w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand"
              placeholder="cricket, sports, bengaluru"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Card Text *</label>
            <textarea
              required
              rows={3}
              value={form.card}
              onChange={set('card')}
              className="mt-1 w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-brand"
              placeholder="The actual post copy text"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Caption</label>
            <input
              value={form.caption}
              onChange={set('caption')}
              className="mt-1 w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600">City Hint</label>
              <input
                value={form.city_hint}
                onChange={set('city_hint')}
                className="mt-1 w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand"
                placeholder="bengaluru"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Media Format</label>
              <select
                value={form.media_format}
                onChange={set('media_format')}
                className="mt-1 w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand"
              >
                {MEDIA_FORMAT_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {f || 'None'}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Meme Concept</label>
            <textarea
              rows={2}
              value={form.meme_concept}
              onChange={set('meme_concept')}
              className="mt-1 w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-brand"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              className="flex-1 bg-brand text-white text-sm font-medium rounded-lg px-4 py-2 hover:bg-brand-600 transition-colors"
            >
              {isEditing ? 'Save Changes' : 'Add Prompt'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-medium bg-slate-100 text-slate-600 rounded-lg px-4 py-2 hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Prompts() {
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editPrompt, setEditPrompt] = useState<Prompt | null>(null)
  const qc = useQueryClient()

  const { data: prompts = [], isLoading } = useQuery({
    queryKey: ['prompts'],
    queryFn: getPrompts,
  })

  const createMut = useMutation({
    mutationFn: createPrompt,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['prompts'] }); setShowModal(false) },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Prompt> }) =>
      updatePrompt(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['prompts'] }); setEditPrompt(null) },
  })

  const deleteMut = useMutation({
    mutationFn: deletePrompt,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prompts'] }),
  })

  const filtered = prompts.filter((p) => {
    if (!search) return true
    const q = search.toLowerCase()
    return p.event.toLowerCase().includes(q) || p.tags.some((t) => t.toLowerCase().includes(q))
  })

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex gap-3 items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by event or tags..."
          className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand bg-white shadow-sm"
        />
        <button
          onClick={() => setShowModal(true)}
          className="bg-brand text-white text-sm font-medium rounded-lg px-4 py-2 hover:bg-brand-600 transition-colors flex-shrink-0"
        >
          + Add Prompt
        </button>
      </div>

      {isLoading ? (
        <div className="text-slate-400 text-sm">Loading prompts...</div>
      ) : filtered.length === 0 ? (
        <div className="text-slate-400 text-sm">No prompts found.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((prompt) => (
            <div
              key={prompt.id}
              className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-800 leading-snug">
                  {prompt.event}
                </h3>
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => setEditPrompt(prompt)}
                    className="text-slate-400 hover:text-brand p-1 rounded transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${prompt.id}"?`)) deleteMut.mutate(prompt.id)
                    }}
                    className="text-slate-400 hover:text-red-500 p-1 rounded transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Card text */}
              <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-700">
                {prompt.card}
              </div>

              {/* Caption */}
              {prompt.caption && (
                <p className="text-xs text-slate-500">{prompt.caption}</p>
              )}

              {/* Badges row */}
              <div className="flex flex-wrap gap-1 items-center">
                {prompt.media_format && (
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      MEDIA_FORMAT_BADGE[prompt.media_format] ?? 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {prompt.media_format}
                  </span>
                )}
                {prompt.city_hint && (
                  <span className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">
                    {prompt.city_hint}
                  </span>
                )}
                {prompt.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs bg-brand-50 text-brand px-2 py-0.5 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {prompt.meme_concept && (
                <p className="text-xs text-slate-400 italic line-clamp-2">
                  {prompt.meme_concept}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add modal */}
      {showModal && (
        <PromptModal
          onClose={() => setShowModal(false)}
          onSave={(data) => createMut.mutate(data)}
          isEditing={false}
        />
      )}

      {/* Edit modal */}
      {editPrompt && (
        <PromptModal
          initial={editPrompt}
          onClose={() => setEditPrompt(null)}
          onSave={(data) => updateMut.mutate({ id: editPrompt.id, data })}
          isEditing={true}
        />
      )}
    </div>
  )
}
