import React, { useEffect, useState } from 'react';
import { MapPin, Search, Plus, ExternalLink } from 'lucide-react';
import { areaService } from '../../services/areaService';
import { Area } from '../../types';
import { Button } from '../../components/common/Button';
import { Input, Select } from '../../components/common/Input';
import { Card, CardHeader, CardBody } from '../../components/common/Card';
import { Modal } from '../../components/common/Modal';
import { LoadingState } from '../../components/common/EmptyState';

export function AdminAreasPage() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('ALL');

  // Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [city, setCity] = useState('Cebu City');
  const [lat, setLat] = useState('10.3157');
  const [lng, setLng] = useState('123.8854');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAreas();
  }, []);

  const fetchAreas = () => {
    setLoading(true);
    areaService
      .getAreas()
      .then(data => {
        setAreas(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  const handleCreateArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    try {
      await areaService.createArea({
        name: name.trim(),
        city,
        latitude: parseFloat(lat) || 10.3157,
        longitude: parseFloat(lng) || 123.8854
      });

      setIsAddModalOpen(false);
      setName('');
      fetchAreas();
    } catch (err: any) {
      alert(err.message || 'Failed to create area.');
    } finally {
      setSubmitting(false);
    }
  };

  const cities = Array.from(new Set(areas.map(a => a.city))).sort();

  const filteredAreas = areas.filter(a => {
    const matchesCity = cityFilter === 'ALL' || a.city === cityFilter;
    const matchesSearch =
      !search ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.city.toLowerCase().includes(search.toLowerCase());
    return matchesCity && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-black text-slate-950 tracking-tight flex items-center gap-2">
            <MapPin className="w-5 h-5 text-amber-500" />
            Registered Barangays & Areas
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Geographic coordinates and normalized names for Metro Cebu automated parser matching.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => setIsAddModalOpen(true)}
          icon={<Plus className="w-4 h-4" />}
        >
          Add New Barangay
        </Button>
      </div>

      {/* Filters & Search */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <Input
            placeholder="Search by barangay name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            icon={<Search className="w-4 h-4" />}
          />
        </div>
        <div>
          <select
            className="w-full text-sm p-2.5 border border-slate-300 rounded-lg bg-white cursor-pointer"
            value={cityFilter}
            onChange={e => setCityFilter(e.target.value)}
          >
            <option value="ALL">All Cities ({cities.length})</option>
            {cities.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Areas Table */}
      <Card>
        <CardBody className="p-0">
          {loading ? (
            <LoadingState message="Loading areas..." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-3">Barangay Name</th>
                    <th className="px-5 py-3">City / Municipality</th>
                    <th className="px-5 py-3">Normalized Match Key</th>
                    <th className="px-5 py-3">Latitude</th>
                    <th className="px-5 py-3">Longitude</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAreas.length > 0 ? (
                    filteredAreas.map(area => (
                      <tr key={area.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-3 font-semibold text-slate-900">{area.name}</td>
                        <td className="px-5 py-3 text-slate-700">{area.city}</td>
                        <td className="px-5 py-3 font-mono text-xs text-slate-500">
                          {area.normalizedName}
                        </td>
                        <td className="px-5 py-3 font-mono text-xs text-slate-500">
                          {area.latitude.toFixed(4)}
                        </td>
                        <td className="px-5 py-3 font-mono text-xs text-slate-500">
                          {area.longitude.toFixed(4)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-slate-400 italic">
                        No areas match your search filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Add Area Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Barangay to Database"
      >
        <form onSubmit={handleCreateArea} className="space-y-4">
          <Input
            label="Barangay Name"
            placeholder="e.g. Sambag 1"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />

          <Select
            label="City / Municipality"
            value={city}
            onChange={e => setCity(e.target.value)}
            options={[
              { value: 'Cebu City', label: 'Cebu City' },
              { value: 'Mandaue City', label: 'Mandaue City' },
              { value: 'Talisay City', label: 'Talisay City' },
              { value: 'Consolacion', label: 'Consolacion' },
              { value: 'Liloan', label: 'Liloan' },
              { value: 'Minglanilla', label: 'Minglanilla' },
              { value: 'City of Naga', label: 'City of Naga' },
              { value: 'San Fernando', label: 'San Fernando' }
            ]}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Latitude"
              value={lat}
              onChange={e => setLat(e.target.value)}
              placeholder="10.3157"
            />
            <Input
              label="Longitude"
              value={lng}
              onChange={e => setLng(e.target.value)}
              placeholder="123.8854"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={submitting}
            >
              Save Barangay
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
