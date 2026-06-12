import { useEffect, useState } from 'react';
import { analyticsApi, campaignsApi } from '../api/client';
import { formatCurrency, formatRate, formatDate, statusStyle, channelColor } from '../utils/formatters';

function MetricCard({ label, value, sub, accent }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className={`mt-1.5 text-3xl font-bold ${accent || 'text-gray-900'}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function FunnelBar({ label, count, total, color }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="text-gray-500">{count?.toLocaleString('en-IN')} <span className="text-gray-400">({pct}%)</span></span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-gray-100">
        <div className={`h-2.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [summary, setSummary]   = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  useEffect(() => {
    Promise.all([analyticsApi.getSummary(), campaignsApi.getAll()])
      .then(([s, c]) => {
        setSummary(s);
        setCampaigns((c.campaigns || []).slice(0, 5));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
    </div>
  );

  if (error) return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">{error}</div>
  );

  const s = summary || {};
  const totals = s.totals || s.funnel || s.overall || {};
  const sent      = totals.sent      || totals.total_sent      || 0;
  const delivered = totals.delivered || totals.total_delivered || 0;
  const opened    = totals.opened    || totals.total_opened    || 0;
  const clicked   = totals.clicked   || totals.total_clicked   || 0;
  const converted = totals.converted || totals.total_converted || 0;
  const revenue   = totals.revenue   || totals.total_revenue   || 0;0;

  const channelPerf = s.by_channel || s.channel_performance || s.channels || [];

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Overview of your CRM performance</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          label="Total Revenue"
          value={formatCurrency(revenue)}
          sub="From converted communications"
          accent="text-indigo-600"
        />
        <MetricCard
          label="Total Sent"
          value={sent.toLocaleString('en-IN')}
          sub="Across all campaigns"
        />
        <MetricCard
          label="Delivered"
          value={delivered.toLocaleString('en-IN')}
          sub={`${formatRate(sent ? (delivered / sent) * 100 : 0)} delivery rate`}
          accent="text-green-600"
        />
        <MetricCard
          label="Converted"
          value={converted.toLocaleString('en-IN')}
          sub={`${formatRate(sent ? (converted / sent) * 100 : 0)} conversion rate`}
          accent="text-purple-600"
        />
      </div>

      {/* Funnel + Channel */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* Engagement funnel */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-gray-900">Engagement Funnel</h2>
          <div className="space-y-4">
            <FunnelBar label="Sent"      count={sent}      total={sent} color="bg-indigo-500" />
            <FunnelBar label="Delivered" count={delivered} total={sent} color="bg-blue-500"   />
            <FunnelBar label="Opened"    count={opened}    total={sent} color="bg-cyan-500"   />
            <FunnelBar label="Clicked"   count={clicked}   total={sent} color="bg-amber-500"  />
            <FunnelBar label="Converted" count={converted} total={sent} color="bg-green-500"  />
          </div>
        </div>

        {/* Channel performance */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-gray-900">Channel Performance</h2>
          {channelPerf.length === 0 ? (
            <p className="text-sm text-gray-400">No channel data yet.</p>
          ) : (
            <div className="space-y-3">
              {channelPerf.map((ch) => {
                const chName = ch.channel || ch.name;
                const chSent = ch.sent || ch.total || 0;
                const chRev  = ch.revenue || 0;
                return (
                  <div key={chName} className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${channelColor(chName)}`}>
                        {chName}
                      </span>
                      <span className="text-sm text-gray-600">{chSent.toLocaleString('en-IN')} sent</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{formatCurrency(chRev)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent campaigns */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">Recent Campaigns</h2>
          <a href="/campaigns" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
            View all →
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-6 py-3">Campaign</th>
                <th className="px-6 py-3">Channel</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Audience</th>
                <th className="px-6 py-3">Revenue</th>
                <th className="px-6 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {campaigns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-gray-400">
                    No campaigns yet.
                  </td>
                </tr>
              ) : campaigns.map((c) => {
                const st = statusStyle(c.status);
                const stats = c.stats || {};
                return (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3.5 font-medium text-gray-900">{c.name}</td>
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
                    <td className="px-6 py-3.5 font-semibold text-gray-900">{formatCurrency(stats.revenue || 0)}</td>
                    <td className="px-6 py-3.5 text-gray-500">{formatDate(c.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
