import { useEffect, useState } from 'react';
import { analyticsApi, campaignsApi } from '../api/client';
import { formatCurrency, formatRate, channelColor } from '../utils/formatters';

function FunnelStep({ label, count, pct, color, isLast }) {
  return (
    <div className="flex items-center gap-4">
      <div className="w-28 text-right text-xs font-semibold text-gray-600">{label}</div>
      <div className="flex-1">
        <div className="h-8 rounded-lg bg-gray-100 overflow-hidden">
          <div className={`h-8 rounded-lg ${color} flex items-center justify-end pr-3 transition-all`} style={{ width: `${Math.max(pct, 2)}%` }}>
            <span className="text-xs font-bold text-white">{pct}%</span>
          </div>
        </div>
      </div>
      <div className="w-20 text-xs text-gray-500">{count?.toLocaleString('en-IN')}</div>
      {!isLast && <div className="absolute" />}
    </div>
  );
}

export default function Analytics() {
  const [summary, setSummary]     = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [selected, setSelected]   = useState('');
  const [campStats, setCampStats] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError]         = useState(null);

  useEffect(() => {
    Promise.all([analyticsApi.getSummary(), campaignsApi.getAll()])
      .then(([s, c]) => {
        setSummary(s);
        const launched = (c.campaigns || []).filter(x => x.status !== 'draft');
        setCampaigns(launched);
        if (launched.length > 0) setSelected(launched[0].id);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setStatsLoading(true);
    analyticsApi.getCampaignStats(selected)
      .then(data => setCampStats(data))
      .catch(() => setCampStats(null))
      .finally(() => setStatsLoading(false));
  }, [selected]);

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
    </div>
  );

  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">{error}</div>;

  const s = summary || {};
  const totals = s.totals || s.funnel || s.overall || {};

  const sent      = totals.sent      || totals.total_sent      || 0;
  const delivered = totals.delivered || totals.total_delivered || 0;
  const opened    = totals.opened    || totals.total_opened    || 0;
  const clicked   = totals.clicked   || totals.total_clicked   || 0;
  const converted = totals.converted || totals.total_converted || 0;
  const revenue   = totals.revenue   || totals.total_revenue   || 0;

  const channelPerf = s.by_channel || s.channel_performance || s.channels || [];

  const pct = (a, b) => b > 0 ? Math.round((a / b) * 100) : 0;

  // Campaign-level stats
  const cs = campStats?.stats || campStats?.overall || {};
  const cSent      = cs.sent      || 0;
  const cDelivered = cs.delivered || 0;
  const cOpened    = cs.opened    || 0;
  const cClicked   = cs.clicked   || 0;
  const cConverted = cs.converted || 0;
  const cRevenue   = cs.revenue   || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-sm text-gray-500 mt-0.5">Aggregated performance across all campaigns</p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[
          { label: 'Total Sent',  value: sent.toLocaleString('en-IN'),      color: 'text-gray-900'   },
          { label: 'Delivered',   value: delivered.toLocaleString('en-IN'), color: 'text-blue-600'   },
          { label: 'Opened',      value: opened.toLocaleString('en-IN'),    color: 'text-cyan-600'   },
          { label: 'Clicked',     value: clicked.toLocaleString('en-IN'),   color: 'text-amber-600'  },
          { label: 'Converted',   value: converted.toLocaleString('en-IN'), color: 'text-green-600'  },
        ].map(k => (
          <div key={k.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm text-center">
            <p className="text-xs font-medium text-gray-500">{k.label}</p>
            <p className={`mt-1 text-2xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Revenue + Rates */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm text-center">
          <p className="text-xs font-medium text-gray-500">Total Revenue</p>
          <p className="mt-1 text-3xl font-bold text-indigo-600">{formatCurrency(revenue)}</p>
          <p className="mt-1 text-xs text-gray-400">From {converted} conversions</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm text-center">
          <p className="text-xs font-medium text-gray-500">Delivery Rate</p>
          <p className="mt-1 text-3xl font-bold text-blue-600">{formatRate(pct(delivered, sent))}</p>
          <p className="mt-1 text-xs text-gray-400">{delivered} of {sent} sent</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm text-center">
          <p className="text-xs font-medium text-gray-500">Conversion Rate</p>
          <p className="mt-1 text-3xl font-bold text-green-600">{formatRate(pct(converted, sent))}</p>
          <p className="mt-1 text-xs text-gray-400">{converted} of {sent} sent</p>
        </div>
      </div>

      {/* Overall Funnel */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-base font-semibold text-gray-900">Overall Engagement Funnel</h2>
        <div className="space-y-3">
          <FunnelStep label="Sent"      count={sent}      pct={100}              color="bg-indigo-500" />
          <FunnelStep label="Delivered" count={delivered} pct={pct(delivered,sent)} color="bg-blue-500"   />
          <FunnelStep label="Opened"    count={opened}    pct={pct(opened,sent)}    color="bg-cyan-500"   />
          <FunnelStep label="Clicked"   count={clicked}   pct={pct(clicked,sent)}   color="bg-amber-500"  />
          <FunnelStep label="Converted" count={converted} pct={pct(converted,sent)} color="bg-green-500" isLast />
        </div>
      </div>

      {/* Channel Performance Table */}
      {channelPerf.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Channel Performance</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-6 py-3 text-left">Channel</th>
                <th className="px-6 py-3 text-right">Sent</th>
                <th className="px-6 py-3 text-right">Delivered</th>
                <th className="px-6 py-3 text-right">Opened</th>
                <th className="px-6 py-3 text-right">Converted</th>
                <th className="px-6 py-3 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {channelPerf.map(ch => {
                const n = ch.channel || ch.name;
                return (
                  <tr key={n} className="hover:bg-gray-50">
                    <td className="px-6 py-3.5">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${channelColor(n)}`}>{n}</span>
                    </td>
                    <td className="px-6 py-3.5 text-right text-gray-600">{(ch.sent || ch.total || 0).toLocaleString('en-IN')}</td>
                    <td className="px-6 py-3.5 text-right text-gray-600">{(ch.delivered || 0).toLocaleString('en-IN')}</td>
                    <td className="px-6 py-3.5 text-right text-gray-600">{(ch.opened || ch.read_count || 0).toLocaleString('en-IN')}</td>
                    <td className="px-6 py-3.5 text-right text-gray-600">{(ch.converted || 0).toLocaleString('en-IN')}</td>
                    <td className="px-6 py-3.5 text-right font-semibold text-gray-900">{formatCurrency(ch.revenue || 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Per-Campaign Drill-down */}
      {campaigns.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-gray-900">Campaign Drill-down</h2>
            <select
              value={selected}
              onChange={e => setSelected(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
            >
              {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {statsLoading ? (
            <div className="flex h-24 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-indigo-400 border-t-transparent" />
            </div>
          ) : campStats ? (
            <div className="grid grid-cols-3 gap-3 lg:grid-cols-6">
              {[
                { label: 'Sent',      value: cSent,                      color: 'bg-gray-100 text-gray-700'    },
                { label: 'Delivered', value: cDelivered,                  color: 'bg-blue-50 text-blue-700'    },
                { label: 'Opened',    value: cOpened,                     color: 'bg-cyan-50 text-cyan-700'    },
                { label: 'Clicked',   value: cClicked,                    color: 'bg-amber-50 text-amber-700'  },
                { label: 'Converted', value: cConverted,                  color: 'bg-green-50 text-green-700'  },
                { label: 'Revenue',   value: formatCurrency(cRevenue),    color: 'bg-indigo-50 text-indigo-700'},
              ].map(k => (
                <div key={k.label} className={`rounded-xl px-4 py-3 text-center ${k.color}`}>
                  <p className="text-xs font-medium opacity-70">{k.label}</p>
                  <p className="mt-0.5 text-lg font-bold">{typeof k.value === 'number' ? k.value.toLocaleString('en-IN') : k.value}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No stats available for this campaign.</p>
          )}
        </div>
      )}
    </div>
  );
}
