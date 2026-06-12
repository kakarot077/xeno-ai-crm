export function formatCurrency(value) {
  if (value == null || isNaN(value)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCount(value) {
  if (value == null || isNaN(value)) return '0';
  if (value >= 100000) return `${(value / 100000).toFixed(1)}L`;
  if (value >= 1000)   return `${(value / 1000).toFixed(1)}K`;
  return String(value);
}

export function formatRate(value) {
  if (value == null || isNaN(value)) return '0%';
  return `${Number(value).toFixed(1)}%`;
}

export function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return 'just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export function statusStyle(status) {
  const map = {
    draft:     { label: 'Draft',     bg: 'bg-gray-100',   text: 'text-gray-600'   },
    launched:  { label: 'Launched',  bg: 'bg-blue-100',   text: 'text-blue-700'   },
    active:    { label: 'Active',    bg: 'bg-green-100',  text: 'text-green-700'  },
    completed: { label: 'Completed', bg: 'bg-purple-100', text: 'text-purple-700' },
    paused:    { label: 'Paused',    bg: 'bg-yellow-100', text: 'text-yellow-700' },
    'at-risk': { label: 'At Risk',   bg: 'bg-orange-100', text: 'text-orange-700' },
    churned:   { label: 'Churned',   bg: 'bg-red-100',    text: 'text-red-700'    },
  };
  return map[status] || { label: status, bg: 'bg-gray-100', text: 'text-gray-600' };
}

export function channelColor(channel) {
  const map = {
    WhatsApp: 'bg-green-100 text-green-700',
    Email:    'bg-blue-100 text-blue-700',
    SMS:      'bg-orange-100 text-orange-700',
    RCS:      'bg-purple-100 text-purple-700',
  };
  return map[channel] || 'bg-gray-100 text-gray-600';
}
