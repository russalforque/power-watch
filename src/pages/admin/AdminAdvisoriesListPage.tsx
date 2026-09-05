import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  FileUp,
  Edit,
  ExternalLink,
  Archive,
  Trash2,
  Search,
  X
} from 'lucide-react';
import { advisoryService } from '../../services/advisoryService';
import { BrownoutPost } from '../../types';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Card, CardBody } from '../../components/common/Card';
import { LoadingState } from '../../components/common/EmptyState';
import { formatDate, formatDateTime } from '../../utils/formatters';

export function AdminAdvisoriesListPage() {
  const [advisories, setAdvisories] = useState<BrownoutPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    fetchAdvisories();
  }, []);

  const fetchAdvisories = () => {
    setLoading(true);
    advisoryService
      .getAllAdvisories()
      .then(data => {
        setAdvisories(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load advisories:', err);
        setLoading(false);
      });
  };

  const handleArchive = async (id: string) => {
    if (!window.confirm('Are you sure you want to archive this advisory?')) return;
    try {
      await advisoryService.archiveAdvisory(id);
      fetchAdvisories();
    } catch (err: any) {
      alert(err.message || 'Failed to archive advisory.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to permanently discard this draft?')) return;
    try {
      if ((advisoryService as any).deleteAdvisory) {
        await (advisoryService as any).deleteAdvisory(id);
      } else {
        await advisoryService.archiveAdvisory(id);
      }
      fetchAdvisories();
    } catch (err: any) {
      alert(err.message || 'Failed to delete advisory.');
    }
  };

  // Filter by status tab & search query
  const filteredAdvisories = useMemo(() => {
    return advisories.filter(a => {
      const matchesStatus = statusFilter === 'ALL' || a.status === statusFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        a.title.toLowerCase().includes(q) ||
        (a.source && a.source.toLowerCase().includes(q));
      return matchesStatus && matchesSearch;
    });
  }, [advisories, statusFilter, searchQuery]);

  return (
    <div className="space-y-6 text-stone-900 font-sans">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 sm:p-7 rounded-2xl border border-stone-200/90 shadow-2xs">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider bg-stone-200/70 text-stone-700">
            <FileText className="w-3.5 h-3.5 text-amber-600" />
            <span>Advisory Archive &amp; Queue</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-light font-serif text-stone-950 tracking-tight">
            Official Utility Advisories
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 font-light">
            Manage drafts, published public schedules, and historical rotational brownout notices.
          </p>
        </div>

        <Link to="/admin/advisories/import" className="shrink-0">
          <Button
            variant="primary"
            className="bg-stone-950 hover:bg-stone-800 text-white font-mono text-xs tracking-wider uppercase py-2.5 px-4 rounded-lg"
            icon={<FileUp className="w-4 h-4" />}
          >
            Import Advisory
          </Button>
        </Link>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200 pb-3">
        {/* Status Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {['ALL', 'Draft', 'Published', 'Archived'].map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                statusFilter === tab
                  ? 'bg-stone-900 text-white font-medium shadow-2xs'
                  : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
              }`}
            >
              {tab === 'ALL' ? 'All Advisories' : tab}
              <span className="ml-1.5 text-[11px] opacity-75 font-semibold">
                ({tab === 'ALL' ? advisories.length : advisories.filter(a => a.status === tab).length})
              </span>
            </button>
          ))}
        </div>

        {/* Quick Search */}
        <div className="relative max-w-xs w-full">
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by title..."
            className="w-full pl-9 pr-8 py-1.5 text-xs font-mono bg-white border border-stone-200 rounded-lg text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-stone-800 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Advisories Table */}
      <Card className="border border-stone-200/90 shadow-xs bg-white rounded-xl overflow-hidden">
        <CardBody className="p-0">
          {loading ? (
            <div className="py-12">
              <LoadingState message="Loading utility advisories..." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-stone-600">
                <thead className="bg-stone-50/80 text-[11px] font-mono font-medium uppercase tracking-wider text-stone-500 border-b border-stone-200">
                  <tr>
                    <th className="px-5 py-3.5">Advisory Title</th>
                    <th className="px-5 py-3.5">Coverage Dates</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Time Windows</th>
                    <th className="px-5 py-3.5">Created</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredAdvisories.length > 0 ? (
                    filteredAdvisories.map(post => (
                      <tr key={post.id} className="hover:bg-stone-50/60 transition-colors">
                        <td className="px-5 py-4 font-medium text-stone-950 max-w-sm">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate">{post.title}</span>
                            {post.sourceUrl && (
                              <a
                                href={post.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-stone-400 hover:text-stone-900 transition-colors shrink-0"
                                title="Open original Facebook post"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-xs font-mono text-stone-600 whitespace-nowrap">
                          {post.startDate ? formatDate(post.startDate) : '—'} –{' '}
                          {post.endDate ? formatDate(post.endDate) : '—'}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <Badge
                            variant={
                              post.status === 'Published'
                                ? 'green'
                                : post.status === 'Draft'
                                ? 'amber'
                                : 'slate'
                            }
                            size="sm"
                            dot={post.status === 'Published'}
                          >
                            {post.status}
                          </Badge>
                        </td>
                        <td className="px-5 py-4 text-xs font-mono font-semibold text-stone-800">
                          {post.schedules?.length || 0} window{post.schedules?.length === 1 ? '' : 's'}
                        </td>
                        <td className="px-5 py-4 text-xs font-mono text-stone-500 whitespace-nowrap">
                          {post.createdAt ? formatDateTime(post.createdAt) : '—'}
                        </td>
                        <td className="px-5 py-4 text-right space-x-2 whitespace-nowrap">
                          <Link to={`/admin/advisories/review/${post.id}`}>
                            <Button
                              size="sm"
                              variant="outline"
                              className="font-mono text-xs border-stone-300 hover:bg-stone-100 text-stone-800"
                              icon={<Edit className="w-3 h-3" />}
                            >
                              Review / Edit
                            </Button>
                          </Link>

                          {post.status === 'Published' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleArchive(post.id)}
                              className="font-mono text-xs text-stone-600 hover:text-stone-900 hover:bg-stone-100"
                              icon={<Archive className="w-3 h-3" />}
                            >
                              Archive
                            </Button>
                          )}

                          {post.status === 'Draft' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(post.id)}
                              className="font-mono text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                              icon={<Trash2 className="w-3 h-3" />}
                            >
                              Discard
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-stone-400 text-xs font-mono italic">
                        No advisories found matching &quot;{searchQuery || statusFilter}&quot;.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}