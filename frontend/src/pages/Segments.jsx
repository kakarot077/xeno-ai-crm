import { useEffect, useState } from 'react';
import { segmentsApi } from '../api/client';
import { formatDate } from '../utils/formatters';

const OPERATOR_LABELS = { gt: '>', lt: '<', gte: '≥', lte: '≤', eq: '=', contains: 'contains', in: 'in' };

const FILTER_FIELDS = [
  { value: 'ltv',              label: 'Lifetime Value (₹)' },
  { value: 'order_count',      label: 'Order Count'        },
  { value: 'last_purchase_days', label: 'Days Since Purchase' },
  { value: 'avg_order_value',  label: 'Avg Order Value'    },
  { value: 'engagement_score', label: 'Engagement Score'   },
  { value: 'city',             label: 'City'               },
  { value: 'status',           label: 'Customer Status'    },
  { value: 'preferred_channel',label: 'Preferred Channel'  },
];

const NUMERIC_OPS = [
  { value: 'gt',  label: 'Greater than' },
  { value: 'lt',  label: 'Less than'    },
  { value: 'gte', label: 'At least'     },
  { value: 'lte', label: 'At most'      },
  { value: 'eq',  label: 'Equals'       },
];

const STRING_OPS = [
  { value: 'eq',       label: 'Is'       },
  { value: 'contains', label: 'Contains' },
];

const STRING_FIELDS = ['city', 'status', 'preferred_channel'];

function emptyFilter() {
  return { field: 'ltv', operator: 'gt', value: '' };
}

function FilterPill({ f }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
      {f.field} {OPERATOR_LABELS[f.operator] || f.operator} {f.value}
    </span>
  );
}

function Modal({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 text-xl font-bold"
        >
          ×
        </button>
        {children}
      </div>
    </div>
  );
}

export default function Segments() {
  const [segments, setSegments]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [showModal, setShowModal]   = useState(false);

  // Form state
  const [name, setName]             = useState('');
  const [explanation, setExplanation] = useState('');
  const [color, setColor]           = useState('#6366f1');
  const [filters, setFilters]       = useState([emptyFilter()]);

  // Preview state
  const [preview, setPreview]       = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [formError, setFormError]   = useState(null);

  const load = () => {
    setLoading(true);
    segmentsApi.getAll()
      .then((data) => setSegments(data.segments || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  function resetForm() {
    setName(''); setExplanation(''); setColor('#6366f1');
    setFilters([emptyFilter()]); setPreview(null); setFormError(null);
  }

  function updateFilter(i, key, val) {
    setFilters(prev => prev.map((f, idx) => idx === i ? { ...f, [key]: val } : f));
  }

  function removeFilter(i) {
    setFilters(prev => prev.filter((_, idx) => idx !== i));
  }

  async function handlePreview() {
    setFormError(null);
    const valid = filters.filter(f => f.value !== '');
    if (!valid.length) { setFormError('Add at least one filter.'); return; }
    setPreviewing(true);
    try {
      const res = await segmentsApi.preview(valid);
      setPreview(res);
    } catch (e) {
      setFormError(e.message);
    } finally {
      setPreviewing(false);
    }
  }

  async function handleSave() {
    setFormError(null);
    if (!name.trim()) { setFormError('Segment name is required.'); return; }
    const valid = filters.filter(f => f.value !== '');
    if (!valid.length) { setFormError('Add at least one filter.'); return; }
    setSaving(true);
    try {
      await segmentsApi.create({ name: name.trim(), explanation, filters: valid, color });
      setShowModal(false);
      resetForm();
      load();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Segments</h1>
          <p className="text-sm text-gray-500 mt-0.5">{segments.length} audience segments</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
        >
          + New Segment
        </button>
      </div>

      {loading && (
        <div className="flex h-40 items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 text-sm">{error}</div>
      )}

      {!loading && !error && segments.length === 0 && (
        <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 text-gray-400">
          <span className="text-3xl">👥</span>
          <p className="text-sm">No segments yet. Create your first one.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {segments.map((seg) => {
          const segs_filters = typeof seg.filters === 'string' ? JSON.parse(seg.filters) : (seg.filters || []);
          return (
            <div key={seg.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: seg.color || '#6366f1' }} />
                  <h3 className="font-semibold text-gray-900 text-sm">{seg.name}</h3>
                </div>
                <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
                  {(seg.count || 0).toLocaleString('en-IN')} customers
                </span>
              </div>
              {seg.explanation && (
                <p className="text-xs text-gray-500 mb-3 line-clamp-2">{seg.explanation}</p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {segs_filters.slice(0, 3).map((f, i) => <FilterPill key={i} f={f} />)}
                {segs_filters.length > 3 && (
                  <span className="text-xs text-gray-400">+{segs_filters.length - 3} more</span>
                )}
              </div>
              <p className="mt-3 text-xs text-gray-400">Created {formatDate(seg.created_at)}</p>
            </div>
          );
        })}
      </div>

      {/* Create Segment Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)}>
        <div className="p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Create New Segment</h2>

          {formError && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
              {formError}
            </div>
          )}

          {/* Name + Color */}
          <div className="mb-4 flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Segment Name *</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. High-Value Inactive"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Color</label>
              <input type="color" value={color} onChange={e => setColor(e.target.value)}
                className="h-[38px] w-12 rounded-lg border border-gray-300 cursor-pointer" />
            </div>
          </div>

          {/* Explanation */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
            <textarea
              value={explanation}
              onChange={e => setExplanation(e.target.value)}
              rows={2}
              placeholder="Describe this segment..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* Filters */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-600">Filters *</label>
              <button
                onClick={() => setFilters(prev => [...prev, emptyFilter()])}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
              >
                + Add filter
              </button>
            </div>
            <div className="space-y-2">
              {filters.map((f, i) => {
                const isString = STRING_FIELDS.includes(f.field);
                const ops = isString ? STRING_OPS : NUMERIC_OPS;
                return (
                  <div key={i} className="flex items-center gap-2">
                    <select
                      value={f.field}
                      onChange={e => updateFilter(i, 'field', e.target.value)}
                      className="flex-1 rounded-lg border border-gray-300 px-2 py-2 text-xs focus:border-indigo-500 focus:outline-none"
                    >
                      {FILTER_FIELDS.map(ff => (
                        <option key={ff.value} value={ff.value}>{ff.label}</option>
                      ))}
                    </select>
                    <select
                      value={f.operator}
                      onChange={e => updateFilter(i, 'operator', e.target.value)}
                      className="w-32 rounded-lg border border-gray-300 px-2 py-2 text-xs focus:border-indigo-500 focus:outline-none"
                    >
                      {ops.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                    </select>
                    <input
                      value={f.value}
                      onChange={e => updateFilter(i, 'value', e.target.value)}
                      placeholder="Value"
                      className="w-24 rounded-lg border border-gray-300 px-2 py-2 text-xs focus:border-indigo-500 focus:outline-none"
                    />
                    {filters.length > 1 && (
                      <button onClick={() => removeFilter(i)} className="text-gray-400 hover:text-red-500 font-bold text-lg leading-none">×</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Preview result */}
          {preview && (
            <div className="mb-4 rounded-lg bg-indigo-50 border border-indigo-200 px-4 py-3">
              <p className="text-sm font-semibold text-indigo-800 mb-2">
                {preview.count} matching customers
              </p>
              {(preview.sample || []).slice(0, 4).map(c => (
                <div key={c.id} className="flex items-center justify-between text-xs text-indigo-700 py-0.5">
                  <span>{c.name}</span>
                  <span className="text-indigo-500">{c.city}</span>
                </div>
              ))}
              {preview.count > 4 && (
                <p className="text-xs text-indigo-500 mt-1">+{preview.count - 4} more customers</p>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={handlePreview}
              disabled={previewing}
              className="flex-1 rounded-lg border border-indigo-300 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 transition-colors"
            >
              {previewing ? 'Previewing…' : 'Preview Audience'}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save Segment'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
