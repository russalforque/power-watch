// src/pages/admin/AdminReviewPage.tsx

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  FileText,
  Save,
  Send,
  Archive,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  ExternalLink,
  ArrowLeft,
  Clock,
  Eye
} from 'lucide-react';
import { advisoryService } from '../../services/advisoryService';
import { areaService } from '../../services/areaService';
import { BrownoutPost, Area } from '../../types';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Badge } from '../../components/common/Badge';
import { Alert } from '../../components/common/Alert';
import { Card, CardHeader, CardBody } from '../../components/common/Card';
import { Modal } from '../../components/common/Modal';
import { LoadingState } from '../../components/common/EmptyState';
import { formatDate } from '../../utils/formatters';

interface EditableSchedule {
  id: string;
  scheduleDate: string;
  startTime: string;
  endTime: string;
  scheduleType: 'PossibleRotationalBrownout';
  areas: {
    rawAreaName: string;
    city: string;
    matchedAreaId?: string;
    isMatched: boolean;
  }[];
}

export function AdminReviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [advisory, setAdvisory] = useState<BrownoutPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [source, setSource] = useState('Visayan Electric');
  const [sourceUrl, setSourceUrl] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [schedules, setSchedules] = useState<EditableSchedule[]>([]);
  const [knownAreas, setKnownAreas] = useState<Area[]>([]);

  // Modals & inputs
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [newAreaInputs, setNewAreaInputs] = useState<Record<number, { name: string; city: string }>>({});

  useEffect(() => {
    if (!id) return;

    Promise.all([
      advisoryService.getAdvisoryById(id),
      areaService.getAreas().catch(() => [] as Area[]) // Safe fallback if route is not implemented
    ])
      .then(([post, areas]) => {
        setAdvisory(post);
        setKnownAreas(areas || []);
        setTitle(post?.title || 'Visayan Electric Advisory');
        setSource(post?.source || 'Visayan Electric');
        setSourceUrl(post?.sourceUrl || '');
        setStartDate(post?.startDate || new Date().toISOString().slice(0, 10));
        setEndDate(post?.endDate || new Date().toISOString().slice(0, 10));

        // Maps backend Area objects (which have a.id) to EditableSchedule
        const safeSchedules: EditableSchedule[] = (post?.schedules || [])
          .filter(Boolean)
          .map((s, sIdx) => ({
            id: s?.id || `sched-${Date.now()}-${sIdx}`,
            scheduleDate: s?.scheduleDate || post?.startDate || new Date().toISOString().slice(0, 10),
            startTime: s?.startTime || '10:00 AM',
            endTime: s?.endTime || '12:30 PM',
            scheduleType: 'PossibleRotationalBrownout',
            areas: (s?.areas || [])
              .filter(Boolean)
              .map((a: any) => ({
                rawAreaName: a?.rawAreaName || a?.name || '',
                city: a?.city || 'Cebu City',
                // Fixes matchedAreaId TypeScript error by reading a.matchedAreaId or a.id from Database.ts
                matchedAreaId: a?.matchedAreaId || a?.id || undefined,
                isMatched: Boolean(a?.isMatched ?? true)
              }))
          }));

        setSchedules(safeSchedules);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Failed to load advisory details.');
        setLoading(false);
      });
  }, [id]);

  const updateScheduleField = (index: number, field: keyof EditableSchedule, value: any) => {
    const updated = [...schedules];
    if (updated[index]) {
      (updated[index] as any)[field] = value;
      setSchedules(updated);
    }
  };

  const removeSchedule = (index: number) => {
    if (schedules.length <= 1) {
      alert('An advisory must have at least one schedule window.');
      return;
    }
    setSchedules(schedules.filter((_, i) => i !== index));
  };

  const addSchedule = () => {
    const newSched: EditableSchedule = {
      id: `sched-${Date.now()}`,
      scheduleDate: startDate || new Date().toISOString().slice(0, 10),
      startTime: '10:00 AM',
      endTime: '12:30 PM',
      scheduleType: 'PossibleRotationalBrownout',
      areas: []
    };
    setSchedules([...schedules, newSched]);
  };

  const removeAreaFromSchedule = (schedIdx: number, areaIdx: number) => {
    const updated = [...schedules];
    if (updated[schedIdx]) {
      updated[schedIdx].areas = updated[schedIdx].areas.filter((_, i) => i !== areaIdx);
      setSchedules(updated);
    }
  };

  // Adds an area directly in memory. Database.ts automatically creates and geocodes it upon save
  const addAreaToSchedule = (schedIdx: number) => {
    const input = newAreaInputs[schedIdx] || { name: '', city: 'Cebu City' };
    const trimmed = input.name.trim();
    if (!trimmed || !schedules[schedIdx]) return;

    const matched = knownAreas.find(
      a => a.normalizedName?.toLowerCase() === trimmed.toLowerCase() && a.city?.toLowerCase() === input.city.toLowerCase()
    );

    const updated = [...schedules];
    updated[schedIdx].areas.push({
      rawAreaName: trimmed,
      city: input.city,
      matchedAreaId: matched?.id,
      isMatched: true
    });

    setSchedules(updated);
    setNewAreaInputs({
      ...newAreaInputs,
      [schedIdx]: { name: '', city: input.city }
    });
  };

  const handleReparse = async () => {
    if (!id || !window.confirm('Re-running the parser will overwrite current manual edits. Continue?')) {
      return;
    }

    setSaving(true);
    try {
      const parsed = await advisoryService.reparseAdvisory(id);
      setTitle(parsed.title || title);
      setStartDate(parsed.startDate || startDate);
      setEndDate(parsed.endDate || endDate);

      const parsedSchedules: EditableSchedule[] = (parsed.schedules || [])
        .filter(Boolean)
        .map((s: any, idx: number) => ({
          id: `sched-reparsed-${Date.now()}-${idx}`,
          scheduleDate: s?.date || s?.scheduleDate || parsed.startDate || startDate,
          startTime: s?.startTime || '10:00 AM',
          endTime: s?.endTime || '12:30 PM',
          scheduleType: 'PossibleRotationalBrownout',
          areas: (s?.areas || [])
            .filter(Boolean)
            .map((a: any) => ({
              rawAreaName: a?.rawName || a?.rawAreaName || a?.name || '',
              city: a?.city || 'Cebu City',
              matchedAreaId: a?.matchedAreaId || a?.id || undefined,
              isMatched: true
            }))
        }));

      setSchedules(parsedSchedules);
      setSuccessMessage('Successfully re-parsed advisory.');
    } catch (err: any) {
      setError(err.message || 'Failed to re-parse advisory.');
    } finally {
      setSaving(false);
    }
  };

  // Sends updated advisory to Database.ts (which auto-runs findOrCreateArea for any new barangays)
  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const updated = await advisoryService.updateAdvisory(id, {
        title,
        source,
        sourceUrl: sourceUrl.trim() || undefined,
        startDate,
        endDate,
        status: advisory?.status || 'Draft',
        schedules
      });

      setAdvisory(updated);
      setSuccessMessage('Advisory changes saved successfully.');
    } catch (err: any) {
      setError(err.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  // Publishes advisory to public map
  // Replace handlePublish in src/pages/admin/AdminReviewPage.tsx

const handlePublish = async () => {
  if (!id) return;
  setPublishing(true);
  setError(null);

  try {
    if (!schedules || schedules.length === 0) {
      setError('Cannot publish advisory with 0 schedules.');
      setIsPublishModalOpen(false);
      setPublishing(false);
      return;
    }

    const activeSchedules = schedules.filter(s => s?.areas && s.areas.length > 0);
    if (activeSchedules.length === 0) {
      setError('Cannot publish advisory without affected areas.');
      setIsPublishModalOpen(false);
      setPublishing(false);
      return;
    }

    const publishPayload = {
      title,
      source,
      sourceUrl: sourceUrl.trim() || undefined,
      startDate,
      endDate,
      status: 'Published' as const,
      schedules: activeSchedules
    };

    let published;
    try {
      // 1. Try dedicated publish endpoint
      published = await advisoryService.publishAdvisory(id, publishPayload);
    } catch (err: any) {
      // 2. If /publish is 404 on the backend, updateAdvisory with status: 'Published'
      // triggers publication directly in Database.ts!
      console.warn('Falling back to updateAdvisory with status: Published');
      published = await advisoryService.updateAdvisory(id, publishPayload);
    }

    setAdvisory(published);
    setIsPublishModalOpen(false);
    setSuccessMessage('Advisory published successfully! It is now live on the public interactive map.');
  } catch (err: any) {
    setError(err.message || 'Failed to publish advisory to the map.');
    setIsPublishModalOpen(false);
  } finally {
    setPublishing(false);
  }
};

  const handleArchive = async () => {
    if (!id || !window.confirm('Are you sure you want to archive this advisory?')) return;
    try {
      const archived = await advisoryService.archiveAdvisory(id);
      setAdvisory(archived);
      setSuccessMessage('Advisory moved to Archived status.');
    } catch (err: any) {
      setError(err.message || 'Failed to archive advisory.');
    }
  };

  if (loading) return <LoadingState message="Loading advisory details..." />;
  if (!advisory) {
    return (
      <div className="p-6 text-center">
        <p className="text-slate-600">Advisory not found.</p>
        <Link to="/admin/advisories" className="text-amber-600 underline mt-2 inline-block">
          Return to Advisories List
        </Link>
      </div>
    );
  }

  let totalAreas = 0;
  schedules.forEach(s => {
    if (s?.areas) totalAreas += s.areas.length;
  });

  const cityOptions = [
    { value: 'Cebu City', label: 'Cebu City' },
    { value: 'Mandaue City', label: 'Mandaue City' },
    { value: 'Talisay City', label: 'Talisay City' },
    { value: 'Consolacion', label: 'Consolacion' },
    { value: 'Liloan', label: 'Liloan' },
    { value: 'Minglanilla', label: 'Minglanilla' },
    { value: 'City of Naga', label: 'City of Naga' },
    { value: 'San Fernando', label: 'San Fernando' }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4 pb-12">
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/admin/advisories"
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Advisory Review
              </span>
              <Badge
                variant={
                  advisory.status === 'Published'
                    ? 'green'
                    : advisory.status === 'Draft'
                    ? 'amber'
                    : 'slate'
                }
                size="sm"
                dot={advisory.status === 'Published'}
              >
                {advisory.status}
              </Badge>
            </div>
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-950 truncate">
              {title || 'Untitled Advisory'}
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReparse}
            disabled={saving}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${saving ? 'animate-spin' : ''}`} />}
          >
            Re-Parse Text
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            isLoading={saving}
            onClick={handleSave}
            icon={<Save className="w-3.5 h-3.5" />}
          >
            Save Draft
          </Button>

          {advisory.status === 'Published' ? (
            <>
              <Link to="/" target="_blank">
                <Button size="sm" variant="outline" icon={<Eye className="w-3.5 h-3.5" />}>
                  View Live
                </Button>
              </Link>
              <Button
                size="sm"
                variant="danger"
                onClick={handleArchive}
                icon={<Archive className="w-3.5 h-3.5" />}
              >
                Archive
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsPublishModalOpen(true)}
              icon={<Send className="w-3.5 h-3.5" />}
            >
              Publish to Map
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert type="error" title="Notice">
          {error}
        </Alert>
      )}
      {successMessage && (
        <Alert type="success" title="Success">
          {successMessage}
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left 2 Cols: Form & Schedules */}
        <div className="lg:col-span-2 space-y-6 min-w-0">
          <Card>
            <CardHeader>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-500" />
                Advisory Details
              </h2>
            </CardHeader>
            <CardBody className="space-y-4">
              <Input
                id="field-advisory-title"
                name="advisoryTitle"
                label="Advisory Title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  id="field-advisory-source"
                  name="advisorySource"
                  label="Official Source"
                  value={source}
                  onChange={e => setSource(e.target.value)}
                  required
                />
                <Input
                  id="field-advisory-source-url"
                  name="advisorySourceUrl"
                  label="Source Facebook Post URL"
                  value={sourceUrl}
                  onChange={e => setSourceUrl(e.target.value)}
                  placeholder="https://facebook.com/..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  id="field-advisory-start-date"
                  name="advisoryStartDate"
                  label="Start Date"
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  required
                />
                <Input
                  id="field-advisory-end-date"
                  name="advisoryEndDate"
                  label="End Date"
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  required
                />
              </div>
            </CardBody>
          </Card>

          {/* Schedules Section */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-500" />
                  Possible Brownout Schedules ({schedules.length})
                </h2>
                <p className="text-xs text-slate-500">
                  {totalAreas} total affected barangay assignments
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addSchedule}
                icon={<Plus className="w-3.5 h-3.5" />}
              >
                Add Schedule Window
              </Button>
            </div>

            {schedules.map((sched, sIdx) => {
  if (!sched) return null;
  return (
    <Card key={sched.id || `sched-${sIdx}`} className="border-slate-300">
      <CardHeader className="bg-slate-50/70 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-900 flex items-center justify-center font-bold text-xs">
            {sIdx + 1}
          </span>
          <span className="font-bold text-slate-900 text-sm">
            Schedule Window #{sIdx + 1}
          </span>
        </div>

        <button
          type="button"
          onClick={() => removeSchedule(sIdx)}
          className="text-slate-400 hover:text-rose-600 transition-colors p-1"
          title="Remove this schedule window"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </CardHeader>

      <CardBody className="space-y-4 p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            id={`schedule-${sIdx}-date`}
            name={`sched_date_${sIdx}`}
            label="Schedule Date"
            type="date"
            value={sched.scheduleDate || startDate || ''}
            onChange={e => updateScheduleField(sIdx, 'scheduleDate', e.target.value)}
          />
          <Input
            id={`schedule-${sIdx}-start-time`}
            name={`sched_start_${sIdx}`}
            label="Start Time"
            value={sched.startTime || ''}
            placeholder="e.g. 10:00 AM"
            onChange={e => updateScheduleField(sIdx, 'startTime', e.target.value)}
          />
          <Input
            id={`schedule-${sIdx}-end-time`}
            name={`sched_end_${sIdx}`}
            label="End Time"
            value={sched.endTime || ''}
            placeholder="e.g. 12:30 PM"
            onChange={e => updateScheduleField(sIdx, 'endTime', e.target.value)}
          />
        </div>

        <div className="space-y-2.5 pt-2 border-t border-slate-100">
          {/* Changed from <label> to <div> to resolve unassociated form control audit */}
          <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide flex items-center justify-between">
            <span>Affected Barangays ({sched.areas?.length || 0})</span>
            <span className="text-[11px] text-slate-400 font-normal">
              Click &times; to remove
            </span>
          </div>

          <div className="flex flex-wrap gap-2 min-h-[36px] p-2 bg-slate-50 rounded-lg border border-slate-200">
            {(!sched.areas || sched.areas.length === 0) ? (
              <span className="text-xs text-rose-500 italic p-1">
                No areas added yet. Every schedule must have at least one affected area.
              </span>
            ) : (
              sched.areas.map((area, aIdx) => (
                <div
                  key={`${area.rawAreaName}-${aIdx}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border border-slate-300 bg-white text-slate-900 shadow-2xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="font-medium">{area.rawAreaName}</span>
                  <span className="text-[10px] text-slate-500">({area.city})</span>

                  <button
                    type="button"
                    onClick={() => removeAreaFromSchedule(sIdx, aIdx)}
                    className="text-slate-400 hover:text-rose-600 ml-1 rounded p-0.5 cursor-pointer"
                  >
                    &times;
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Add Area Controls */}
          <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
            <div className="w-full sm:w-1/3">
              <label htmlFor={`schedule-${sIdx}-city-select`} className="sr-only">
                Select City
              </label>
              <select
                id={`schedule-${sIdx}-city-select`}
                name={`sched_city_${sIdx}`}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                value={newAreaInputs[sIdx]?.city || 'Cebu City'}
                onChange={e =>
                  setNewAreaInputs({
                    ...newAreaInputs,
                    [sIdx]: {
                      name: newAreaInputs[sIdx]?.name || '',
                      city: e.target.value
                    }
                  })
                }
              >
                {cityOptions.map(c => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 w-full">
              <label htmlFor={`schedule-${sIdx}-new-area-input`} className="sr-only">
                Barangay Name
              </label>
              <input
                id={`schedule-${sIdx}-new-area-input`}
                name={`sched_area_input_${sIdx}`}
                type="text"
                placeholder="Type barangay name (e.g. Guadalupe, Lahug)..."
                className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                value={newAreaInputs[sIdx]?.name || ''}
                onChange={e =>
                  setNewAreaInputs({
                    ...newAreaInputs,
                    [sIdx]: {
                      name: e.target.value,
                      city: newAreaInputs[sIdx]?.city || 'Cebu City'
                    }
                  })
                }
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addAreaToSchedule(sIdx);
                  }
                }}
              />
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addAreaToSchedule(sIdx)}
              className="w-full sm:w-auto shrink-0"
            >
              Add Area
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
})}
          </div>
        </div>

        {/* Right 1 Col: Preserved Raw Post Text */}
        <div className="space-y-4">
          <Card className="lg:sticky lg:top-20">
            <CardHeader className="bg-slate-900 text-white">
              <div className="flex items-center justify-between w-full">
                <span className="font-bold text-sm flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-amber-400" />
                  Original Advisory Text
                </span>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                  Preserved
                </span>
              </div>
            </CardHeader>
            <CardBody className="p-4 space-y-3">
              <p className="text-xs text-slate-500">
                The original Facebook post text is preserved for reference.
              </p>
              <div className="max-h-[500px] overflow-y-auto bg-slate-50 p-3 rounded-lg border border-slate-200 font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed select-all">
                {advisory.originalContent}
              </div>

              {advisory.sourceUrl && (
                <a
                  href={advisory.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open Original Facebook Post
                </a>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={isPublishModalOpen}
        onClose={() => setIsPublishModalOpen(false)}
        title="Confirm Advisory Publication"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsPublishModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              isLoading={publishing}
              onClick={handlePublish}
              icon={<Send className="w-3.5 h-3.5" />}
            >
              Confirm &amp; Publish Now
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-slate-700">
          <p>Are you sure you want to publish this advisory to the public map?</p>
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-950 space-y-1 font-mono">
            <div><strong>Advisory:</strong> {title}</div>
            <div><strong>Date:</strong> {formatDate(startDate)} – {formatDate(endDate)}</div>
            <div><strong>Schedules:</strong> {schedules.length} time windows</div>
            <div><strong>Total Areas:</strong> {totalAreas} barangay assignments</div>
          </div>
          <p className="text-xs text-slate-500">
            Once published, these schedules will appear immediately on the public interactive map.
          </p>
        </div>
      </Modal>
    </div>
  );
}