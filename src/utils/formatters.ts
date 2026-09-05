export function formatDateRange(startDate?: string, endDate?: string): string {
  if (!startDate) return 'Date TBD';
  if (!endDate || startDate === endDate) {
    return formatDate(startDate);
  }

  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');

  const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
  const startDay = start.getDate();
  const endDay = end.getDate();
  const year = start.getFullYear();

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay}–${endDay}, ${year}`;
  }
  return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${year}`;
}

export function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : ''));
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

export function formatDateTime(isoString?: string | null): string {
  if (!isoString) return 'Not available';
  const d = new Date(isoString);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

/**
 * Checks whether a schedule time window is currently active, upcoming, or passed today.
 */
export function getScheduleTimeStatus(scheduleDate: string, startTime: string, endTime: string): 'upcoming' | 'ongoing' | 'ended' {
  const today = new Date().toISOString().slice(0, 10);
  if (scheduleDate < today) {
    return 'ended';
  }
  if (scheduleDate > today) {
    return 'upcoming';
  }

  // Same day: evaluate hours
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const parseMinutes = (timeStr: string): number => {
    const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!match) return 0;
    let hour = parseInt(match[1], 10);
    const min = parseInt(match[2], 10);
    const ampm = (match[3] || '').toUpperCase();
    if (ampm === 'PM' && hour < 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;
    return hour * 60 + min;
  };

  const startMin = parseMinutes(startTime);
  const endMin = parseMinutes(endTime);

  if (currentMinutes < startMin) {
    return 'upcoming';
  }
  if (currentMinutes >= startMin && currentMinutes <= endMin) {
    return 'ongoing';
  }
  return 'ended';
}
