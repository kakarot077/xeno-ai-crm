import { useEffect, useState } from 'react';
import { campaignsApi, segmentsApi, aiApi } from '../api/client';
import { formatCurrency, formatRate, formatDate, statusStyle, channelColor } from '../utils/formatters';

function Modal({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 text-xl font-bold">×</button>
        {children}
      </div>
    </div>
  );
}

function StatChip({ label, value, color }) {
  return (
    <div className={`rounded-lg px-3 py-2 text-center ${color}`}>
      <p className="text-xs font-medium opacity-70">{label}</p>
      <p className="text-sm font-bold">{value}</p>
    </div>
  );
}

export default function Campaigns() {
  const [campaigns, setCampaigns]   = useState([]);
  const [segments, setSegments]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected]     = useState(null);
  const [sending, setSending]       = useState(null);

  // Create form
  const [form, setForm] = useState({
    name: '', segment_id: '', channel: 'WhatsApp', goal: '',
    content: { whatsapp: { message: '', cta: 'Shop Now' } },
  });
  const [creating, setCreating]   = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [campaignPrompt, setCampaignPrompt] = useState('');
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantPreview, setAssistantPreview] = useState(null);
  const [formError, setFormError] = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([campaignsApi.getAll(), segmentsApi.getAll()])
      .then(([c, s]) => {
        setCampaigns(c.campaigns || []);
        setSegments(s.segments || []);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);
  
  async function handleCampaignAssistant() {
    if (assistantLoading) return;
    if (!campaignPrompt.trim()) { setFormError('Describe your campaign first.'); return; }
    setFormError(null);
    setAssistantLoading(true);
    setAssistantPreview(null);
    try {
      const res = await aiApi.generateCampaign(campaignPrompt);
      setAssistantPreview(res);
    } catch (e) {
      if (e.message.includes('429')) {
        setFormError('AI is rate-limited right now — wait ~60 seconds and try again.');
      } else {
        setFormError(e.message);
      }
    } finally {
      setAssistantLoading(false);
    }
  }

  async function handleApplyAssistant() {
    if (!assistantPreview) return;
    setFormError(null);
    setSaving(true);
    try {
      // Step 1: create the segment from AI's filters
      const segRes = await segmentsApi.create({
        name: assistantPreview.segment.name,
        explanation: assistantPreview.segment.explanation,
        filters: assistantPreview.segment.filters,
        color: '#9333ea',
      });
      const newSegment = segRes.segment || segRes;

      // Step 2: populate the campaign form with AI's output
      const ch = assistantPreview.channel.toLowerCase();
      setForm({
        name: assistantPreview.segment.name + ' Campaign',
        segment_id: newSegment.id,
        channel: assistantPreview.channel,
        goal: assistantPreview.goal,
        content: { [ch]: { message: assistantPreview.message, cta: 'Shop Now' } },
      });

      // Step 3: refresh segments list so the new one appears in dropdown
      const segData = await segmentsApi.getAll();
      setSegments(segData.segments || []);

      // Clear assistant state — form is now ready for review/edit
      setCampaignPrompt('');
      setAssistantPreview(null);
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setForm({ name: '', segment_id: '', channel: 'WhatsApp', goal: '', content: { whatsapp: { message: '', cta: 'Shop Now' } } });
    setFormError(null);
    setCampaignPrompt('');
    setAssistantPreview(null);
  }

  function setMessage(val) {
    const ch = form.channel.toLowerCase();
    setForm(prev => ({ ...prev, content: { [ch]: { message: val, cta: 'Shop Now' } } }));
  }

  function handleChannelChange(ch) {
    setForm(prev => ({ ...prev, channel: ch, content: { [ch.toLowerCase()]: { message: '', cta: 'Shop Now' } } }));
  }
 async function handleGenerateMessage() {
    if (aiLoading) return;
    if (!form.goal.trim()) { alert('Please enter a campaign goal first.'); return; }
    setAiLoading(true);
    try {
      const segmentName =
        segments.find(s => s.id === form.segment_id)?.name || 'customers';

      const res = await aiApi.generateMessage(form.goal, segmentName);

      const ch = form.channel.toLowerCase();
      setForm(prev => ({
        ...prev,
        content: {
          ...prev.content,
          [ch]: { ...prev.content[ch], message: res.message },
        },
      }));
    } catch (e) {
      if (e.message.includes('429')) {
        alert('AI is rate-limited right now — wait ~60 seconds and try again.');
      } else {
        alert(e.message);
      }
    } finally {
      setAiLoading(false);
    }
  }
  async function handleCreate() {
    setFormError(null);
    if (!form.name.trim())      { setFormError('Campaign name is required.'); return; }
    if (!form.segment_id)       { setFormError('Please select a segment.');   return; }
    if (!form.goal.trim())      { setFormError('Goal is required.');           return; }
    const ch = form.channel.toLowerCase();
    if (!form.content[ch]?.message?.trim()) { setFormError('Message content is required.'); return; }

    setCreating(true);
    try {
      await campaignsApi.create(form);
      setShowCreate(false);
      resetForm();
      load();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleSend(id, e) {
    e.stopPropagation();
    if (!window.confirm('Send this campaign to its audience?')) return;
    setSending(id);
    try {
      await campaignsApi.updateStatus(id, 'active');
      load();
    } catch (e) {
      alert(e.message);
    } finally {
      setSending(null);
    }
  }

  async function openDetail(id) {
    try {
      const data = await campaignsApi.getById(id);
      setSelected(data.campaign || data);
    } catch (e) {
      alert(e.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
          <p className="text-sm text-gray-500 mt-0.5">{campaigns.length} campaigns total</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowCreate(true); }}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
        >
          + New Campaign
        </button>
      </div>

      {loading && (
        <div className="flex h-40 items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
        </div>
      )}

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 text-sm">{error}</div>}

      {!loading && !error && campaigns.length === 0 && (
        <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 text-gray-400">
          <span className="text-3xl">📢</span>
          <p className="text-sm">No campaigns yet. Create your first one.</p>
        </div>
      )}

      {/* Table */}
      {campaigns.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-6 py-3">Campaign</th>
                  <th className="px-6 py-3">Channel</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Audience</th>
                  <th className="px-6 py-3">Delivered</th>
                  <th className="px-6 py-3">Converted</th>
                  <th className="px-6 py-3">Revenue</th>
                  <th className="px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {campaigns.map((c) => {
                  const st    = statusStyle(c.status);
                  const stats = c.stats || c;
                  const sent  = stats.sent || c.audience_count || 0;
                  const delRate = sent > 0 ? formatRate((stats.delivered / sent) * 100) : '—';
                  const convRate = sent > 0 ? formatRate((stats.converted / sent) * 100) : '—';
                  const canSend = c.status === 'draft';
                  return (
                    <tr
                      key={c.id}
                      onClick={() => openDetail(c.id)}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-3.5">
                        <p className="font-semibold text-gray-900">{c.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{c.segment_name || c.segment_id}</p>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${channelColor(c.channel)}`}>
                          {c.channel}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.bg} ${st.text}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-gray-600">{c.audience_count || 0}</td>
                      <td className="px-6 py-3.5 text-gray-600">{delRate}</td>
                      <td className="px-6 py-3.5 text-gray-600">{convRate}</td>
                      <td className="px-6 py-3.5 font-semibold text-gray-900">{formatCurrency(stats.revenue || 0)}</td>
                      <td className="px-6 py-3.5" onClick={e => e.stopPropagation()}>
                        {canSend && (
                          <button
                            onClick={(e) => handleSend(c.id, e)}
                            disabled={sending === c.id}
                            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                          >
                            {sending === c.id ? 'Sending…' : 'Send'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Campaign Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)}>
        <div className="p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Create Campaign</h2>
          {/* AI Campaign Assistant */}
          <div className="mb-4 rounded-lg border border-purple-200 bg-purple-50 p-4">
            <label className="block text-xs font-semibold text-purple-700 mb-1.5">
              🧠 AI Campaign Assistant — describe the whole campaign
            </label>
            <div className="flex gap-2">
              <input
                value={campaignPrompt}
                onChange={e => setCampaignPrompt(e.target.value)}
                placeholder="e.g. run campaign for inactive users with 20% discount"
                className="flex-1 rounded-lg border border-purple-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCampaignAssistant}
                disabled={assistantLoading}
                className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50 whitespace-nowrap"
              >
                {assistantLoading ? 'Thinking…' : 'Generate Campaign'}
              </button>
            </div>

            {assistantPreview && (
              <div className="mt-3 rounded-lg bg-white border border-purple-200 p-3 space-y-2">
                <div>
                  <p className="text-xs font-semibold text-gray-500">Audience</p>
                  <p className="text-sm text-gray-800">
                    {assistantPreview.segment.name}
                    <span className="ml-2 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-700">
                      {assistantPreview.segment.audience_count} customers
                    </span>
                  </p>
                  <p className="text-xs text-gray-400">{assistantPreview.segment.explanation}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500">Channel</p>
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${channelColor(assistantPreview.channel)}`}>
                    {assistantPreview.channel}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500">Message</p>
                  <p className="text-sm text-gray-800">{assistantPreview.message}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500">Goal</p>
                  <p className="text-sm text-gray-800">{assistantPreview.goal}</p>
                </div>
                <button
                  type="button"
                  onClick={handleApplyAssistant}
                  disabled={saving}
                  className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? 'Applying…' : 'Use This Campaign — Fill Form Below'}
                </button>
              </div>
            )}

            <p className="mt-1.5 text-xs text-purple-500">
              AI will create the audience segment and pre-fill everything below for your review.
            </p>
          </div>

          {formError && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">{formError}</div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Campaign Name *</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Summer Reactivation"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Segment *</label>
                <select value={form.segment_id} onChange={e => setForm(p => ({ ...p, segment_id: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none">
                  <option value="">Select segment…</option>
                  {segments.map(s => <option key={s.id} value={s.id}>{s.name} ({s.count || 0})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Channel *</label>
                <select value={form.channel} onChange={e => handleChannelChange(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none">
                  {['WhatsApp', 'Email', 'SMS', 'RCS'].map(ch => <option key={ch}>{ch}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Campaign Goal *</label>
              <input value={form.goal} onChange={e => setForm(p => ({ ...p, goal: e.target.value }))}
                placeholder="e.g. Re-engage inactive customers with 20% discount"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="block text-xs font-semibold text-gray-600">
                Message *
                </label>

                 <button
                  type="button"
                  onClick={handleGenerateMessage}
                  disabled={aiLoading}
                  className="rounded-md bg-purple-600 px-2 py-1 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {aiLoading ? 'Generating…' : '✨ Generate AI Message'}
                </button>
                </div>
              <textarea
                rows={3}
                value={form.content[form.channel.toLowerCase()]?.message || ''}
                onChange={e => setMessage(e.target.value)}
                placeholder="Write your campaign message…"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button onClick={() => setShowCreate(false)}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button onClick={handleCreate} disabled={creating}
              className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {creating ? 'Creating…' : 'Create Campaign'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Campaign Detail Modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)}>
        {selected && (() => {
          const st    = statusStyle(selected.status);
          const stats = selected.stats || {};
          const sent  = stats.sent || selected.audience_count || 0;
          return (
            <div className="p-6">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selected.name}</h2>
                  <p className="text-sm text-gray-500 mt-0.5">{selected.segment_name} · {formatDate(selected.created_at)}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${st.bg} ${st.text}`}>{st.label}</span>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-5">
                <StatChip label="Sent"      value={sent}                           color="bg-gray-100 text-gray-700" />
                <StatChip label="Delivered" value={stats.delivered || 0}           color="bg-blue-50 text-blue-700" />
                <StatChip label="Opened"    value={stats.opened || 0}              color="bg-cyan-50 text-cyan-700" />
                <StatChip label="Clicked"   value={stats.clicked || 0}             color="bg-amber-50 text-amber-700" />
                <StatChip label="Converted" value={stats.converted || 0}           color="bg-green-50 text-green-700" />
                <StatChip label="Revenue"   value={formatCurrency(stats.revenue || 0)} color="bg-indigo-50 text-indigo-700" />
              </div>

              <div className="rounded-lg bg-gray-50 p-4 text-sm">
                <p className="font-semibold text-gray-700 mb-1">Goal</p>
                <p className="text-gray-600">{selected.goal}</p>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
