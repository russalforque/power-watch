import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileUp,
  MapPin,
  Clock,
  CheckCircle,
  AlertCircle,
  Eye,
  Edit,
  ArrowRight,
  ExternalLink,
  LayoutDashboard
} from 'lucide-react';
import { advisoryService } from '../../services/advisoryService';
import { BrownoutPost } from '../../types';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Card, CardHeader, CardBody } from '../../components/common/Card';
import { LoadingState } from '../../components/common/EmptyState';
import { formatDate, formatDateTime } from '../../utils/formatters';

export function AdminDashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    advisoryService
      .getDashboardStats()
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Failed to load dashboard metrics.');
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="py-16">
        <LoadingState message="Loading dashboard metrics..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-rose-50 text-rose-800 rounded-xl border border-rose-200/80 font-mono text-xs space-y-1">
        <p className="font-semibold uppercase tracking-wider">Metrics Unavailable</p>
        <p>{error}</p>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Published Advisories',
      value: stats?.publishedPosts || 0,
      icon: CheckCircle,
      badgeColor: 'text-emerald-700 bg-emerald-50 border-emerald-200'
    },
    {
      title: 'Drafts for Review',
      value: stats?.draftPosts || 0,
      icon: AlertCircle,
      badgeColor: 'text-amber-800 bg-amber-50 border-amber-200'
    },
    {
      title: 'Active Schedules',
      value: stats?.activeSchedules || 0,
      icon: Clock,
      badgeColor: 'text-stone-700 bg-stone-100 border-stone-200'
    },
    {
      title: 'Registered Barangays',
      value: stats?.totalAreas || 0,
      icon: MapPin,
      badgeColor: 'text-stone-700 bg-stone-100 border-stone-200'
    }
  ];

  return (
    <div className="space-y-6 text-stone-900 font-sans">
      {/* Top Banner & Primary Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 bg-white p-6 sm:p-7 rounded-2xl border border-stone-200/90 shadow-2xs">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider bg-stone-200/70 text-stone-700">
            <LayoutDashboard className="w-3.5 h-3.5 text-amber-600" />
            <span>Operational Console</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-light font-serif text-stone-950 tracking-tight">
            Advisory Management Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 font-light">
            Import, parse, and verify Visayan Electric rotational brownout schedules across Metro Cebu.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Link to="/admin/advisories/import">
            <Button
              variant="primary"
              className="bg-stone-950 hover:bg-stone-800 text-white font-mono text-xs tracking-wider uppercase py-2.5 px-4 rounded-lg"
              icon={<FileUp className="w-3.5 h-3.5" />}
            >
              Import Advisory
            </Button>
          </Link>
          <Link to="/" target="_blank" rel="noopener noreferrer">
            <Button
              variant="outline"
              className="font-mono text-xs border-stone-300 hover:bg-stone-100 text-stone-800 py-2.5 px-3.5 rounded-lg"
              icon={<Eye className="w-3.5 h-3.5" />}
            >
              View Live Map
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(s => {
          const Icon = s.icon;
          return (
            <Card key={s.title} className="border border-stone-200/90 shadow-2xs bg-white rounded-xl overflow-hidden">
              <CardBody className="flex items-center justify-between p-5">
                <div className="space-y-1">
                  <p className="text-[11px] font-mono font-medium text-stone-500 uppercase tracking-wider">
                    {s.title}
                  </p>
                  <p className="text-3xl font-light font-mono text-stone-950">{s.value}</p>
                </div>
                <div className={`w-11 h-11 rounded-lg flex items-center justify-center border ${s.badgeColor}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>

      {/* Recent Advisories Table */}
      <Card className="border border-stone-200/90 shadow-2xs bg-white rounded-xl overflow-hidden">
        <CardHeader className="bg-white border-b border-stone-100 px-6 py-4">
          <div className="flex items-center justify-between w-full">
            <div className="space-y-0.5">
              <h2 className="text-base font-serif font-medium text-stone-950">Recent Advisories</h2>
              <p className="text-xs font-mono text-stone-500">Official notices imported into PowerWatch</p>
            </div>
            <Link
              to="/admin/advisories"
              className="text-xs font-mono font-medium text-amber-800 hover:text-amber-950 flex items-center gap-1 transition-colors"
            >
              <span>View All Advisories</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </CardHeader>

        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-stone-600">
              <thead className="bg-stone-50/80 text-[11px] font-mono font-medium uppercase tracking-wider text-stone-500 border-b border-stone-200">
                <tr>
                  <th className="px-5 py-3.5">Advisory Title</th>
                  <th className="px-5 py-3.5">Coverage Dates</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Time Windows</th>
                  <th className="px-5 py-3.5">Last Modified</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {stats?.recentAdvisories && stats.recentAdvisories.length > 0 ? (
                  stats.recentAdvisories.map((post: BrownoutPost) => (
                    <tr key={post.id} className="hover:bg-stone-50/60 transition-colors">
                      <td className="px-5 py-4 font-medium text-stone-950 max-w-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate">{post.title}</span>
                          {post.sourceUrl && (
                            <a
                              href={post.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center text-stone-400 hover:text-stone-900 transition-colors shrink-0"
                              title="Original Facebook post"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs font-mono text-stone-600 whitespace-nowrap">
                        {formatDate(post.startDate)} – {formatDate(post.endDate)}
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
                      <td className="px-5 py-4 text-xs font-mono font-semibold text-stone-800 whitespace-nowrap">
                        {post.schedules?.length || 0} window{post.schedules?.length === 1 ? '' : 's'}
                      </td>
                      <td className="px-5 py-4 text-xs font-mono text-stone-500 whitespace-nowrap">
                        {formatDateTime(post.updatedAt)}
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
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
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-stone-400 text-xs font-mono italic">
                      No advisories imported yet. Click &apos;Import Advisory&apos; above to ingest a new notice.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}