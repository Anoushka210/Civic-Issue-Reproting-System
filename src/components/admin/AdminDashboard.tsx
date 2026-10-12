import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Filter, 
  BarChart3, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  Building2, 
  Sparkles, 
  RefreshCw, 
  Search, 
  X, 
  ChevronRight, 
  Eye, 
  ShieldAlert, 
  Check, 
  UploadCloud, 
  FileText, 
  Cpu, 
  TrendingUp,
  ArrowUpRight,
  Layers,
  Activity,
  SlidersHorizontal,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { 
  BarChart, 
  Bar, 
  Cell, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid,
  PieChart,
  Pie
} from 'recharts';
import { predictCivicIssue } from '../../services/mlService';
import { 
  CNN_CLASSES, 
  DEPARTMENT_MAPPINGS, 
  CNN_CLASS_LABELS, 
  type CNNClass, 
  type MLPredictionResponse, 
  type CivicDepartment 
} from '../../types/civic';
import { cn, safeFormatDate, apiFetch, safeJson } from '../../lib/utils';
import CNNVisualization from '../ml/CNNVisualization';

// Bypass React 19 / Leaflet 5 typing quirks without introducing TypeScript errors
const LeafletMapContainer = MapContainer as any;
const LeafletTileLayer = TileLayer as any;
const LeafletMarker = Marker as any;
const LeafletPopup = Popup as any;

// Default custom Leaflet pin icon
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

interface AdminDashboardProps {
  issues?: any[];
  setView?: (view: string) => void;
  user?: any;
  onRefresh?: () => Promise<void> | void;
  initialTab?: 'overview' | 'issues' | 'analytics';
}

export default function AdminDashboard({
  issues = [],
  setView,
  user,
  onRefresh,
  initialTab = 'overview'
}: AdminDashboardProps) {
  const safeIssues = Array.isArray(issues) ? issues : [];
  const [activeTab, setActiveTab] = useState<'overview' | 'issues' | 'analytics'>(initialTab);
  const [selectedIssue, setSelectedIssue] = useState<any | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [backendStats, setBackendStats] = useState<any | null>(null);
  const [teams, setTeams] = useState<any[]>([]);

  // Keep activeTab in sync if initialTab prop changes
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Fetch real backend statistics from /api/admin/stats
  const fetchStats = async () => {
    try {
      const res = await apiFetch('/api/admin/stats');
      if (res.ok) {
        const data = await safeJson(res);
        if (data) setBackendStats(data);
      }
    } catch (err) {
      console.warn('Failed to fetch admin stats:', err);
    }
  };

  // Fetch teams from /api/admin/teams
  const fetchTeams = async () => {
    try {
      const res = await apiFetch('/api/admin/teams');
      if (res.ok) {
        const data = await safeJson(res);
        if (Array.isArray(data)) setTeams(data);
      }
    } catch (err) {
      console.warn('Failed to fetch worker teams:', err);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchTeams();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        onRefresh ? onRefresh() : Promise.resolve(),
        fetchStats(),
        fetchTeams()
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Derived statistics using real data
  const stats = useMemo(() => {
    const total = backendStats?.total ?? safeIssues.length;
    const pending = backendStats?.pending ?? safeIssues.filter(i => i && i.status === 'Pending').length;
    const inProgress = backendStats?.inProgress ?? safeIssues.filter(i => i && (i.status === 'In Progress' || i.status === 'Assigned' || i.status === 'In-Progress')).length;
    const resolved = backendStats?.resolved ?? safeIssues.filter(i => i && (i.status === 'Resolved' || i.status === 'Confirmed Resolved')).length;
    const pendingConfirmation = safeIssues.filter(i => i && i.status === 'Pending Citizen Confirmation').length;
    const fake = backendStats?.fake ?? safeIssues.filter(i => i && (i.isFake === 1 || i.isFake === true)).length;

    // MobileNetV2 CNN pipeline classification breakdown
    const cnnIssuesCount = safeIssues.filter(i => {
      const cat = (i.category || '').toLowerCase();
      return (
        cat.includes('pothole') ||
        cat.includes('garbage') ||
        cat.includes('waste') ||
        cat.includes('streetlight') ||
        cat.includes('water leakage') ||
        cat.includes('leak')
      );
    }).length;

    return {
      total,
      pending,
      inProgress,
      resolved,
      pendingConfirmation,
      fake,
      cnnIssuesCount,
      cnnCoveragePercent: total > 0 ? Math.round((cnnIssuesCount / total) * 100) : 0
    };
  }, [backendStats, safeIssues]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* 1. Municipal Command Header */}
      <header className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200/60">
                <ShieldAlert size={13} className="text-blue-700" />
                Municipal Authority Operations
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                ML Service Connected (:8000)
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-black text-slate-900 tracking-tight">
              Admin Operations Center
            </h1>
            <p className="text-sm font-medium text-slate-500">
              City infrastructure complaints, department task routing, and MobileNetV2 classification oversight.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-center">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-colors disabled:opacity-50"
              title="Refresh city issue data"
            >
              <RefreshCw size={14} className={cn(isRefreshing && 'animate-spin text-blue-700')} />
              <span>{isRefreshing ? 'Refreshing...' : 'Sync Data'}</span>
            </button>

            <div className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold">
              <span>Admin:</span>
              <span className="text-slate-900">{user?.username || 'Administrator'}</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 mt-6 pt-5 border-t border-slate-100 overflow-x-auto">
          <button
            onClick={() => {
              setActiveTab('overview');
              if (setView) setView('admin-dashboard');
            }}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0",
              activeTab === 'overview'
                ? "bg-blue-700 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            )}
          >
            <LayoutDashboard size={16} />
            <span>Operations Overview</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('issues');
              if (setView) setView('admin-issues');
            }}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0",
              activeTab === 'issues'
                ? "bg-blue-700 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            )}
          >
            <Filter size={16} />
            <span>Manage Issues</span>
            <span className={cn(
              "ml-1 px-1.5 py-0.2 rounded-full text-[10px]",
              activeTab === 'issues' ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
            )}>
              {safeIssues.length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('analytics');
              if (setView) setView('admin-analytics');
            }}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0",
              activeTab === 'analytics'
                ? "bg-blue-700 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            )}
          >
            <BarChart3 size={16} />
            <span>Category Analytics</span>
          </button>
        </div>
      </header>

      {/* 2. Primary Tab Views */}
      <main>
        {activeTab === 'overview' && (
          <AdminOverviewView
            stats={stats}
            issues={safeIssues}
            onSelectIssue={setSelectedIssue}
            onViewAllIssues={() => {
              setActiveTab('issues');
              if (setView) setView('admin-issues');
            }}
          />
        )}

        {activeTab === 'issues' && (
          <AdminIssueManagementView
            issues={safeIssues}
            teams={teams}
            onSelectIssue={setSelectedIssue}
          />
        )}

        {activeTab === 'analytics' && (
          <AdminAnalyticsView
            issues={safeIssues}
            backendStats={backendStats}
          />
        )}

        {/* 4. Interactive Educational CNN Demonstration (Continuous Loop) */}
        <section className="pt-4">
          <CNNVisualization mode="admin" defaultExpanded={true} />
        </section>
      </main>

      {/* 3. Detailed Issue Review & Management Modal */}
      {selectedIssue && (
        <AdminIssueDetailModal
          issue={selectedIssue}
          teams={teams}
          onClose={() => setSelectedIssue(null)}
          onUpdateSuccess={async () => {
            setSelectedIssue(null);
            if (onRefresh) await onRefresh();
            await fetchStats();
          }}
        />
      )}
    </div>
  );
}

// =============================================================================
// TAB 1: OVERVIEW COMPONENT
// =============================================================================

function AdminOverviewView({
  stats,
  issues,
  onSelectIssue,
  onViewAllIssues
}: {
  stats: any;
  issues: any[];
  onSelectIssue: (issue: any) => void;
  onViewAllIssues: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
        <SummaryCard
          label="Total Reported"
          value={stats.total}
          subtext="City-wide submissions"
          icon={<FileText size={18} className="text-slate-700" />}
          badgeColor="bg-slate-100 text-slate-800"
        />
        <SummaryCard
          label="Pending Review"
          value={stats.pending}
          subtext="Awaiting team dispatch"
          icon={<Clock size={18} className="text-amber-600" />}
          badgeColor="bg-amber-50 text-amber-800 border-amber-200"
        />
        <SummaryCard
          label="In Progress"
          value={stats.inProgress}
          subtext="Under municipal work"
          icon={<Activity size={18} className="text-blue-600" />}
          badgeColor="bg-blue-50 text-blue-800 border-blue-200"
        />
        <SummaryCard
          label="Resolved / Done"
          value={stats.resolved + (stats.pendingConfirmation || 0)}
          subtext="Completed operations"
          icon={<CheckCircle2 size={18} className="text-emerald-600" />}
          badgeColor="bg-emerald-50 text-emerald-800 border-emerald-200"
        />
        <SummaryCard
          label="Flagged / Fake"
          value={stats.fake}
          subtext="Rejected or unverified"
          icon={<AlertTriangle size={18} className="text-red-600" />}
          badgeColor="bg-red-50 text-red-800 border-red-200"
        />
      </div>

      {/* College Project ML Pipeline Spotlight Card */}
      <div className="bg-gradient-to-r from-blue-900 via-slate-900 to-indigo-950 text-white rounded-2xl p-6 shadow-md border border-slate-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-full bg-blue-500/10 blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-400/30">
                Core ML Pipeline Component
              </span>
              <span className="text-xs text-slate-400 font-mono">MobileNetV2 (TFLite)</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Automated AI Image Classification & Department Routing
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              When citizens upload issue photos, our custom-trained 4-class CNN categorizes the infrastructure failure and automatically routes it to the designated municipal department.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
            {CNN_CLASSES.map((cls) => {
              const dept = DEPARTMENT_MAPPINGS[cls];
              const label = CNN_CLASS_LABELS[cls];
              return (
                <div
                  key={cls}
                  className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 flex flex-col justify-between"
                >
                  <p className="text-[11px] font-bold text-white leading-tight">{label}</p>
                  <div className="mt-2 pt-2 border-t border-white/10">
                    <p className="text-[9px] uppercase tracking-wider font-semibold text-blue-300">Target Dept</p>
                    <p className="text-[11px] font-medium text-slate-200 truncate">{dept}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Two-Column Grid: Recent Issues & City Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Reports List */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Recent Complaints</h3>
                <p className="text-xs text-slate-500">Latest citizen submissions requiring administrative review</p>
              </div>
              <button
                onClick={onViewAllIssues}
                className="text-xs font-bold text-blue-700 hover:text-blue-800 flex items-center gap-1 hover:underline"
              >
                <span>View all ({issues.length})</span>
                <ChevronRight size={14} />
              </button>
            </div>

            <div className="space-y-2.5">
              {issues.slice(0, 5).map((issue: any) => (
                <div
                  key={issue.id}
                  onClick={() => onSelectIssue(issue)}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50/70 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0 border border-slate-200 bg-slate-100">
                      <img
                        src={issue.imageUrl || `https://picsum.photos/seed/${issue.id}/100`}
                        alt={issue.category || 'Issue'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {issue.category || 'Civic Issue'}
                        </p>
                        <PriorityPill priority={issue.priority} />
                      </div>
                      <p className="text-[11px] text-slate-500 truncate max-w-[240px]">
                        {issue.description || 'No description provided'}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {safeFormatDate(issue.timestamp, 'MMM d, yyyy • h:mm a')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0 ml-3">
                    <StatusBadge status={issue.status} />
                    <button
                      className="p-1.5 rounded-lg text-slate-400 group-hover:text-blue-700 group-hover:bg-blue-50 transition-colors"
                      title="Manage issue"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              ))}

              {issues.length === 0 && (
                <div className="text-center py-10 bg-slate-50 rounded-xl border border-slate-100 text-slate-500">
                  <p className="text-xs font-medium">No complaints currently on file.</p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Showing 5 latest issues</span>
            <button
              onClick={onViewAllIssues}
              className="font-semibold text-blue-700 hover:underline"
            >
              Open Issue Management →
            </button>
          </div>
        </div>

        {/* City Operations Interactive Map */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">City Operations Map</h3>
              <p className="text-xs text-slate-500">Spatial distribution of complaints across Hyderabad sectors</p>
            </div>
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
              {issues.filter(i => i.latitude && i.longitude).length} Geolocated Reports
            </span>
          </div>

          <div className="h-[360px] w-full rounded-xl overflow-hidden border border-slate-200 relative">
            <LeafletMapContainer center={[17.3850, 78.4867]} zoom={12} style={{ height: '100%', width: '100%' }}>
              <LeafletTileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {issues.map((i: any) => {
                if (!i.latitude || !i.longitude) return null;
                return (
                  <LeafletMarker key={i.id} position={[i.latitude, i.longitude]} icon={defaultIcon}>
                    <LeafletPopup>
                      <div className="p-1 max-w-[200px]">
                        <p className="text-xs font-bold text-slate-900">{i.category}</p>
                        <p className="text-[11px] text-slate-600 line-clamp-2 mt-1">{i.description}</p>
                        <div className="mt-2 flex items-center justify-between text-[10px]">
                          <span className="font-semibold">{i.status}</span>
                          <span className="text-blue-700 font-bold">{i.priority}</span>
                        </div>
                      </div>
                    </LeafletPopup>
                  </LeafletMarker>
                );
              })}
            </LeafletMapContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// TAB 2: ISSUE MANAGEMENT (SEARCH & FILTERABLE DATA TABLE)
// =============================================================================

function AdminIssueManagementView({
  issues,
  teams,
  onSelectIssue
}: {
  issues: any[];
  teams: any[];
  onSelectIssue: (issue: any) => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [onlyCNN, setOnlyCNN] = useState(false);

  // Available unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    issues.forEach(i => {
      if (i.category) set.add(i.category);
    });
    return Array.from(set);
  }, [issues]);

  // Filtered issues
  const filtered = useMemo(() => {
    return issues.filter((i: any) => {
      if (!i) return false;

      // Status filter
      if (statusFilter !== 'All') {
        if (statusFilter === 'Resolved') {
          if (i.status !== 'Resolved' && i.status !== 'Confirmed Resolved') return false;
        } else if (statusFilter === 'In Progress') {
          if (i.status !== 'In Progress' && i.status !== 'Assigned' && i.status !== 'In-Progress') return false;
        } else if (statusFilter === 'Fake/Closed') {
          if (i.isFake !== 1 && i.status !== 'Closed') return false;
        } else if (i.status !== statusFilter) {
          return false;
        }
      }

      // Category filter
      if (categoryFilter !== 'All' && i.category !== categoryFilter) {
        return false;
      }

      // Priority filter
      if (priorityFilter !== 'All' && i.priority !== priorityFilter) {
        return false;
      }

      // CNN only filter
      if (onlyCNN) {
        const cat = (i.category || '').toLowerCase();
        const isCNN =
          cat.includes('pothole') ||
          cat.includes('garbage') ||
          cat.includes('waste') ||
          cat.includes('streetlight') ||
          cat.includes('water leakage') ||
          cat.includes('leak');
        if (!isCNN) return false;
      }

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = (i.id || '').toLowerCase().includes(q);
        const matchesDesc = (i.description || '').toLowerCase().includes(q);
        const matchesCat = (i.category || '').toLowerCase().includes(q);
        const matchesUser = (i.username || '').toLowerCase().includes(q) || (i.userEmail || '').toLowerCase().includes(q);
        const matchesLoc = (i.locationAddress || '').toLowerCase().includes(q);
        if (!matchesId && !matchesDesc && !matchesCat && !matchesUser && !matchesLoc) {
          return false;
        }
      }

      return true;
    });
  }, [issues, statusFilter, categoryFilter, priorityFilter, onlyCNN, searchQuery]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Filter and Search Controls */}
      <div className="p-5 border-b border-slate-100 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by ticket ID, description, address, reporter..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 placeholder:text-slate-400 outline-none focus:border-blue-600 focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 self-start md:self-center">
            <button
              onClick={() => setOnlyCNN(!onlyCNN)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border",
                onlyCNN
                  ? "bg-blue-50 text-blue-800 border-blue-300"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              )}
            >
              <Cpu size={14} className={onlyCNN ? "text-blue-700" : "text-slate-400"} />
              <span>CNN Classes Only</span>
            </button>

            {(searchQuery || statusFilter !== 'All' || categoryFilter !== 'All' || priorityFilter !== 'All' || onlyCNN) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('All');
                  setCategoryFilter('All');
                  setPriorityFilter('All');
                  setOnlyCNN(false);
                }}
                className="text-xs text-slate-500 hover:text-slate-800 font-semibold px-2 py-1"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Filter Selectors */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Filter By:</span>

          {/* Status buttons */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {['All', 'Pending', 'In Progress', 'Resolved', 'Fake/Closed'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all",
                  statusFilter === s ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Category Dropdown */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 outline-none focus:border-blue-600"
          >
            <option value="All">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Priority Dropdown */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 outline-none focus:border-blue-600"
          >
            <option value="All">All Priorities</option>
            <option value="Emergency">Emergency</option>
            <option value="High">High</option>
            <option value="Normal">Normal</option>
          </select>

          <span className="ml-auto text-xs font-medium text-slate-500">
            Showing <strong className="text-slate-900">{filtered.length}</strong> of {issues.length} records
          </span>
        </div>
      </div>

      {/* Issues Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
              <th className="px-5 py-3.5">Ticket ID / Photo</th>
              <th className="px-5 py-3.5">Category & Description</th>
              <th className="px-5 py-3.5">Location</th>
              <th className="px-5 py-3.5">Reporter</th>
              <th className="px-5 py-3.5">Priority</th>
              <th className="px-5 py-3.5">Status</th>
              <th className="px-5 py-3.5">Assigned Team</th>
              <th className="px-5 py-3.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((issue: any) => {
              const isCNN = isCNNRecognized(issue.category);
              return (
                <tr key={issue.id} className="hover:bg-slate-50/80 transition-colors">
                  {/* Photo & ID */}
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-slate-200 bg-slate-100">
                        <img
                          src={issue.imageUrl || `https://picsum.photos/seed/${issue.id}/100`}
                          alt={issue.id}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div>
                        <span className="font-mono font-bold text-slate-900">#{issue.id}</span>
                        <p className="text-[10px] text-slate-400">
                          {safeFormatDate(issue.timestamp, 'MMM d, h:mm a')}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Category & Description */}
                  <td className="px-5 py-3.5 max-w-[240px]">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-slate-900">{issue.category}</span>
                      {isCNN && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          CNN
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5" title={issue.description}>
                      {issue.description || 'No description provided'}
                    </p>
                  </td>

                  {/* Location */}
                  <td className="px-5 py-3.5 max-w-[180px]">
                    <div className="flex items-center gap-1 text-slate-600 truncate">
                      <MapPin size={12} className="shrink-0 text-slate-400" />
                      <span className="truncate" title={issue.locationAddress}>
                        {(issue.locationAddress || 'Unknown location').split(',')[0]}
                      </span>
                    </div>
                    {issue.division && (
                      <span className="text-[10px] text-slate-400">Div: {issue.division}</span>
                    )}
                  </td>

                  {/* Reporter */}
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <p className="font-semibold text-slate-800">{issue.username || 'Citizen'}</p>
                    {issue.userEmail && (
                      <p className="text-[10px] text-slate-400 truncate max-w-[120px]">{issue.userEmail}</p>
                    )}
                  </td>

                  {/* Priority */}
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <PriorityPill priority={issue.priority} />
                  </td>

                  {/* Status */}
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <StatusBadge status={issue.status} />
                  </td>

                  {/* Assigned Team */}
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <span className="font-semibold text-slate-700">
                      {issue.assignedTeam || 'Unassigned'}
                    </span>
                  </td>

                  {/* Action */}
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    <button
                      onClick={() => onSelectIssue(issue)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold transition-colors"
                    >
                      <Eye size={13} />
                      <span>Review</span>
                    </button>
                  </td>
                </tr>
              );
            })}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-12 text-slate-500">
                  <div className="max-w-xs mx-auto space-y-2">
                    <AlertTriangle size={24} className="mx-auto text-slate-400" />
                    <p className="text-sm font-bold text-slate-700">No issues match current filters</p>
                    <p className="text-xs text-slate-400">
                      Try resetting your search query, status, or category filters.
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =============================================================================
// TAB 3: CATEGORY ANALYTICS COMPONENT
// =============================================================================

function AdminAnalyticsView({
  issues,
  backendStats
}: {
  issues: any[];
  backendStats: any;
}) {
  // Category distribution data
  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {};
    issues.forEach(i => {
      const cat = i.category || 'Other';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  }, [issues]);

  // Priority distribution data
  const priorityData = useMemo(() => {
    const counts: Record<string, number> = { Emergency: 0, High: 0, Normal: 0 };
    issues.forEach(i => {
      const p = i.priority || 'Normal';
      counts[p] = (counts[p] || 0) + 1;
    });
    return [
      { name: 'Emergency', count: counts.Emergency, color: '#ef4444' },
      { name: 'High', count: counts.High, color: '#f59e0b' },
      { name: 'Normal', count: counts.Normal, color: '#3b82f6' }
    ];
  }, [issues]);

  const COLORS = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#475569'];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category Distribution Bar Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Complaints by Category</h3>
              <p className="text-xs text-slate-500">Distribution across municipal service categories</p>
            </div>
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
              {categoryData.length} Active Categories
            </span>
          </div>

          <div className="h-72 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '12px'
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {categoryData.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Priority Breakdown Pie Chart */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Priority Severity</h3>
            <p className="text-xs text-slate-500 mb-4">Urgency classification of reports</p>

            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={priorityData}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                  >
                    {priorityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-2 pt-4 border-t border-slate-100">
            {priorityData.map(p => (
              <div key={p.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                  <span className="font-medium text-slate-700">{p.name} Priority</span>
                </div>
                <span className="font-bold text-slate-900">{p.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Municipal Operations Performance Matrix */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        <h3 className="text-base font-bold text-slate-900 mb-1">Municipal Department Routing Matrix</h3>
        <p className="text-xs text-slate-500 mb-6">Automated mapping from CNN classes to departments</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {CNN_CLASSES.map(cls => {
            const dept = DEPARTMENT_MAPPINGS[cls];
            const matchingCount = issues.filter(i => (i.category || '').toLowerCase().includes(cls.replace('_', ' '))).length;
            return (
              <div key={cls} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">{CNN_CLASS_LABELS[cls]}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                    {matchingCount} reports
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-200/60">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Responsible Department</p>
                  <p className="text-xs font-semibold text-slate-700 mt-0.5">{dept}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MODAL: ISSUE DETAIL, ML INSPECTION, AND ADMIN ACTIONS
// =============================================================================

function AdminIssueDetailModal({
  issue,
  teams,
  onClose,
  onUpdateSuccess
}: {
  issue: any;
  teams: any[];
  onClose: () => void;
  onUpdateSuccess: () => void;
}) {
  const [adminNotes, setAdminNotes] = useState(issue.adminNotes || '');
  const [assignedTeam, setAssignedTeam] = useState(issue.assignedTeam || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null);

  // Live CNN Inference Testing for this issue's photo
  const [livePrediction, setLivePrediction] = useState<MLPredictionResponse | null>(null);
  const [isRunningInference, setIsRunningInference] = useState(false);
  const [inferenceError, setInferenceError] = useState<string | null>(null);

  // Resolution photo for proof of fix
  const [resolutionPhoto, setResolutionPhoto] = useState<string | null>(issue.resolutionImageUrl || issue.workerImageUrl || null);

  const handleResolutionPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setResolutionPhoto(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  // Run on-demand MobileNetV2 prediction on the issue's photo
  const handleRunCNNInference = async () => {
    if (!issue.imageUrl) {
      setInferenceError('No photo is attached to this issue.');
      return;
    }

    setIsRunningInference(true);
    setInferenceError(null);

    try {
      // Fetch image and create File object
      const res = await fetch(issue.imageUrl);
      if (!res.ok) throw new Error('Could not download issue photo for CNN processing.');
      const blob = await res.blob();
      const mime = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/jpeg';
      const file = new File([blob], 'issue-photo.jpg', { type: mime });

      // Run live model inference via FastAPI proxy
      const pred = await predictCivicIssue(file);
      setLivePrediction(pred);
    } catch (err: any) {
      console.error('CNN inference failed:', err);
      setInferenceError(err.message || 'CNN prediction service unavailable. Ensure ML service is running on port 8000.');
    } finally {
      setIsRunningInference(false);
    }
  };

  // Perform backend update using PUT /api/admin/issues/:id
  const executeUpdate = async (patch: {
    status?: string;
    assignedTeam?: string;
    adminNotes?: string;
    isFake?: boolean;
    resolutionImage?: string | null;
  }) => {
    setIsUpdating(true);
    setUpdateError(null);
    setUpdateSuccess(null);

    try {
      const payload: any = {
        ...patch,
        adminNotes: patch.adminNotes !== undefined ? patch.adminNotes : adminNotes,
        assignedTeam: patch.assignedTeam !== undefined ? patch.assignedTeam : assignedTeam,
      };

      if (resolutionPhoto) {
        payload.resolutionImage = resolutionPhoto;
      }

      const res = await apiFetch(`/api/admin/issues/${issue.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await safeJson(res);
        throw new Error(data?.error || `Update failed with status ${res.status}`);
      }

      setUpdateSuccess('Issue updated successfully!');
      setTimeout(() => {
        onUpdateSuccess();
      }, 700);
    } catch (err: any) {
      setUpdateError(err.message || 'Failed to update issue');
    } finally {
      setIsUpdating(false);
    }
  };

  // Check if historical prediction metadata exists or was run live
  const activePrediction: MLPredictionResponse | null =
    livePrediction ||
    (issue.mlPrediction ? issue.mlPrediction : null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-white rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col border border-slate-200"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm font-bold bg-slate-200/80 text-slate-800 px-2.5 py-1 rounded-lg">
              #{issue.id}
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900">{issue.category || 'Civic Issue'}</h2>
              <p className="text-xs text-slate-500">
                Reported {safeFormatDate(issue.timestamp, 'MMMM d, yyyy • h:mm a')} by {issue.username || 'Citizen'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <StatusBadge status={issue.status} />
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto p-6 space-y-6 flex-1">
          {updateError && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle size={16} />
              <span>{updateError}</span>
            </div>
          )}

          {updateSuccess && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 size={16} />
              <span>{updateSuccess}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Visual Evidence & ML Inspection */}
            <div className="space-y-5">
              {/* Report Photo */}
              <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-100 relative group">
                <img
                  src={issue.imageUrl || `https://picsum.photos/seed/${issue.id}/600/400`}
                  alt={issue.category}
                  className="w-full h-56 object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="p-2.5 bg-white border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-500">Report Evidence Photo</span>
                  {issue.imageUrl && (
                    <a
                      href={issue.imageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-700 font-bold hover:underline"
                    >
                      Full Size ↗
                    </a>
                  )}
                </div>
              </div>

              {/* Dedicated ML Component Inspection Card */}
              <div className="bg-slate-900 text-white rounded-xl p-4.5 space-y-3.5 border border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu size={16} className="text-blue-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      MobileNetV2 CNN Analysis
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-blue-300 bg-blue-950/80 px-2 py-0.5 rounded border border-blue-800/40">
                    4-Class Pipeline
                  </span>
                </div>

                {activePrediction ? (
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400">Predicted Category</p>
                        <p className="text-sm font-bold text-white capitalize">
                          {CNN_CLASS_LABELS[activePrediction.predicted_class] || activePrediction.predicted_class}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase font-bold text-slate-400">Confidence</p>
                        <p className="text-sm font-mono font-black text-emerald-400">
                          {activePrediction.confidence_percent ? `${activePrediction.confidence_percent.toFixed(1)}%` : `${(activePrediction.confidence * 100).toFixed(1)}%`}
                        </p>
                      </div>
                    </div>

                    {/* Department Routing */}
                    <div className="text-xs bg-blue-500/10 border border-blue-500/20 p-2.5 rounded-lg flex items-center justify-between">
                      <span className="text-slate-300">Routing Department:</span>
                      <span className="font-bold text-blue-300">{activePrediction.department}</span>
                    </div>

                    {/* Class probabilities breakdown */}
                    {activePrediction.probabilities && (
                      <div className="space-y-1.5 pt-1">
                        <p className="text-[10px] uppercase font-bold text-slate-400">Model Probability Breakdown</p>
                        {Object.entries(activePrediction.probabilities).map(([cName, prob]) => {
                          const pct = prob > 1 ? prob : prob * 100;
                          return (
                            <div key={cName} className="space-y-0.5">
                              <div className="flex justify-between text-[10px]">
                                <span className="capitalize text-slate-300">{cName.replace('_', ' ')}</span>
                                <span className="font-mono text-slate-400">{pct.toFixed(1)}%</span>
                              </div>
                              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-blue-500 transition-all"
                                  style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3 bg-white/5 rounded-lg border border-white/5 text-xs text-slate-300 space-y-1">
                      <p className="font-bold text-white flex items-center gap-1.5">
                        <Info size={13} className="text-amber-400" />
                        Historical Submission Notice
                      </p>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        ML inference metadata was not persisted at the time of submission for this report. You can run on-demand MobileNetV2 verification now to demonstrate the model on this photo.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleRunCNNInference}
                      disabled={isRunningInference || !issue.imageUrl}
                      className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                    >
                      <Sparkles size={14} className={isRunningInference ? 'animate-spin' : ''} />
                      <span>{isRunningInference ? 'Running MobileNetV2 Inference...' : 'Run CNN Inference on Photo'}</span>
                    </button>

                    {inferenceError && (
                      <p className="text-[11px] text-red-400 font-medium">{inferenceError}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Geographic Information */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <MapPin size={14} className="text-blue-700" />
                  <span>Report Location</span>
                </div>
                <p className="text-slate-600">{issue.locationAddress || 'No detailed address recorded.'}</p>
                {issue.latitude && issue.longitude && (
                  <p className="text-[11px] font-mono text-slate-400">
                    Coords: {issue.latitude.toFixed(5)}, {issue.longitude.toFixed(5)}
                  </p>
                )}
              </div>
            </div>

            {/* Right Column: Administrative Workflow & Actions */}
            <div className="space-y-5">
              {/* Description & Grievance Details */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Citizen Description</label>
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-800 leading-relaxed min-h-[70px]">
                  {issue.description || 'No detailed complaint description was provided.'}
                </div>
              </div>

              {/* Status Update Actions */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Update Status</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isUpdating}
                    onClick={() => executeUpdate({ status: 'In Progress' })}
                    className={cn(
                      "py-2.5 px-3 rounded-xl text-xs font-bold border transition-all text-center",
                      issue.status === 'In Progress'
                        ? "bg-blue-700 text-white border-blue-700 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    Set In Progress
                  </button>

                  <button
                    type="button"
                    disabled={isUpdating}
                    onClick={() => executeUpdate({ status: 'Resolved' })}
                    className={cn(
                      "py-2.5 px-3 rounded-xl text-xs font-bold border transition-all text-center",
                      issue.status === 'Resolved' || issue.status === 'Confirmed Resolved'
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    Mark as Resolved
                  </button>
                </div>
              </div>

              {/* Department / Team Assignment */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Assign Municipal Team / Department
                </label>
                <select
                  disabled={isUpdating}
                  value={assignedTeam}
                  onChange={(e) => {
                    const newTeam = e.target.value;
                    setAssignedTeam(newTeam);
                    executeUpdate({ assignedTeam: newTeam });
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 outline-none focus:border-blue-600"
                >
                  <option value="">-- Unassigned --</option>
                  <option value="Roads & Infrastructure">Roads & Infrastructure</option>
                  <option value="Sanitation">Sanitation Department</option>
                  <option value="Electricity">Electricity & Lighting</option>
                  <option value="Water Supply">Water Supply & Sewerage</option>
                  {teams.map(t => (
                    <option key={t.id || t.name} value={t.name || t.id}>
                      {t.name || t.id}
                    </option>
                  ))}
                </select>
              </div>

              {/* Admin Work Notes */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Administrative Notes & Work Log
                  </label>
                </div>
                <textarea
                  rows={3}
                  value={adminNotes}
                  disabled={isUpdating}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Record inspection findings, worker instructions, or verification notes..."
                  className="w-full p-3 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-600 resize-none"
                />
                <button
                  type="button"
                  disabled={isUpdating || adminNotes === (issue.adminNotes || '')}
                  onClick={() => executeUpdate({ adminNotes })}
                  className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-900 transition-colors disabled:opacity-40"
                >
                  Save Notes
                </button>
              </div>

              {/* Resolution Proof Photo (Before & After) */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <label className="block text-xs font-bold text-slate-700">Attach Resolution Proof Photo</label>
                <input
                  type="file"
                  accept="image/*"
                  disabled={isUpdating}
                  onChange={handleResolutionPhotoUpload}
                  className="text-xs text-slate-600"
                />
                {resolutionPhoto && (
                  <div className="mt-2 w-full h-24 rounded-lg overflow-hidden border border-slate-200 bg-white">
                    <img src={resolutionPhoto} alt="Resolution" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              {/* Consequential Flag Action */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={() => {
                    if (window.confirm('Are you sure you want to flag this issue as a fake report? This will close the issue.')) {
                      executeUpdate({ isFake: true, status: 'Closed' });
                    }
                  }}
                  className="text-xs font-bold text-red-600 hover:text-red-700 hover:underline inline-flex items-center gap-1"
                >
                  <AlertTriangle size={13} />
                  <span>Flag as Suspected Fake Report</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// =============================================================================
// HELPER COMPONENTS & UTILS
// =============================================================================

function SummaryCard({
  label,
  value,
  subtext,
  icon,
  badgeColor
}: {
  label: string;
  value: number | string;
  subtext: string;
  icon: React.ReactNode;
  badgeColor: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
        <div className={cn("p-1.5 rounded-lg border", badgeColor)}>
          {icon}
        </div>
      </div>
      <div className="mt-3">
        <p className="text-2xl sm:text-3xl font-display font-black text-slate-900 tracking-tight">{value}</p>
        <p className="text-[11px] font-medium text-slate-400 mt-0.5">{subtext}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const s = status || 'Pending';
  let color = 'bg-amber-50 text-amber-700 border-amber-200';

  if (s === 'Resolved' || s === 'Confirmed Resolved') {
    color = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (s === 'In Progress' || s === 'Assigned' || s === 'In-Progress') {
    color = 'bg-blue-50 text-blue-700 border-blue-200';
  } else if (s === 'Pending Citizen Confirmation') {
    color = 'bg-purple-50 text-purple-700 border-purple-200';
  } else if (s === 'Closed') {
    color = 'bg-slate-100 text-slate-600 border-slate-200';
  }

  return (
    <span className={cn('px-2.5 py-0.5 rounded-full text-[11px] font-bold border inline-block', color)}>
      {s}
    </span>
  );
}

function PriorityPill({ priority }: { priority?: string }) {
  const p = priority || 'Normal';
  let color = 'bg-blue-50 text-blue-700 border-blue-200';

  if (p === 'Emergency') {
    color = 'bg-red-50 text-red-700 border-red-200';
  } else if (p === 'High') {
    color = 'bg-amber-50 text-amber-700 border-amber-200';
  }

  return (
    <span className={cn('px-2 py-0.2 rounded-md text-[10px] font-bold border inline-flex items-center gap-1', color)}>
      {p === 'Emergency' && <AlertTriangle size={10} />}
      {p}
    </span>
  );
}

function isCNNRecognized(category?: string): boolean {
  if (!category) return false;
  const c = category.toLowerCase();
  return (
    c.includes('pothole') ||
    c.includes('garbage') ||
    c.includes('waste') ||
    c.includes('streetlight') ||
    c.includes('water leakage') ||
    c.includes('leak')
  );
}
