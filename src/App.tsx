import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  Plus,
  Filter,
  Zap,
  Map,
  X,
  Search,
  Activity,
  Tag,
  Calendar,
  MapPin,
  Target,
  RotateCcw,
  Download,
  Pencil,
  Trash2,
} from 'lucide-react';

// ============================================================================
// 🛠️ EDITABLE DEFAULT FILTER OPTIONS
// ============================================================================
const WATTS_RANGES = ['Under 25', '25-50', 'Over 50'];
const DEFAULT_LOCATIONS = ['Northeast', 'Midwest', 'South', 'West'];
const DEFAULT_GOALS = [
  'Recruitment',
  'Company Culture',
  'Brand Awareness',
  'New Customers',
  'Existing Customers',
  'Events',
];
const DEFAULT_SEASONALS = [
  'General Holiday',
  'Fall',
  'Winter',
  'Spring',
  'Summer',
];
const DEFAULT_TYPES = [
  'Collateral',
  'OOH',
  'Apparel',
  'Vehicle',
  'Digital/Social Marketing',
  'Print Marketing',
];

const REGION_KEY_DATA = [
  {
    region: 'Northeast',
    desc: 'New England (CT, ME, MA, NH, RI, VT) & Middle Atlantic (NJ, NY, PA).',
  },
  {
    region: 'Midwest',
    desc: 'East North Central (IL, IN, MI, OH, WI) & West North Central (IA, KS, MN, MO, NE, ND, SD).',
  },
  {
    region: 'South',
    desc: 'South Atlantic (DE, DC, FL, GA, MD, NC, SC, VA, WV), East South Central (AL, KY, MS, TN) & West South Central (AR, LA, OK, TX).',
  },
  {
    region: 'West',
    desc: 'Mountain (AZ, CO, ID, MT, NV, NM, UT, WY) & Pacific (AK, CA, HI, OR, WA).',
  },
];

// Set to an empty array so you start completely from scratch
const SEED_PROJECTS = [];

// ============================================================================
// 🔥 FIREBASE SETUP (With fallback to local browser storage)
// ============================================================================
let db = null;
let auth = null;
const appId = 'watts-projects';

try {
  const firebaseConfig =
    typeof __firebase_config !== 'undefined'
      ? JSON.parse(__firebase_config)
      : null;
  if (firebaseConfig && firebaseConfig.apiKey) {
    const app =
      getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    auth = getAuth(app);
    db = getFirestore(app);
  }
} catch (e) {
  console.warn('Running in local storage fallback mode:', e);
}

const getWattsRange = (watts) => {
  const w = Number(watts);
  if (isNaN(w) || w < 25) return 'Under 25';
  if (w >= 25 && w <= 50) return '25-50';
  return 'Over 50';
};

export default function App() {
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal & Edit State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  const [filters, setFilters] = useState({
    wattsRanges: [],
    locations: [],
    goals: [],
    seasonals: [],
    types: [],
  });

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    watts: '',
    location: DEFAULT_LOCATIONS[0],
    goal: DEFAULT_GOALS[0],
    seasonal: DEFAULT_SEASONALS[0],
    type: DEFAULT_TYPES[0],
  });

  const [customInputs, setCustomInputs] = useState({
    location: '',
    goal: '',
    seasonal: '',
    type: '',
  });

  // 1. Initialize Auth
  useEffect(() => {
    if (!auth) {
      const saved = localStorage.getItem('watts_projects_local');
      if (saved) {
        try {
          setProjects(JSON.parse(saved));
        } catch {
          setProjects([]);
        }
      } else {
        setProjects([]);
      }
      setIsLoading(false);
      return;
    }

    const initAuth = async () => {
      try {
        if (
          typeof __initial_auth_token !== 'undefined' &&
          __initial_auth_token
        ) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  // 2. Fetch Projects Real-time from Firestore
  useEffect(() => {
    if (!db || !user) return;

    const projectsRef = collection(
      db,
      'artifacts',
      appId,
      'public',
      'data',
      'projects'
    );
    const unsubscribe = onSnapshot(
      projectsRef,
      (snapshot) => {
        const fetched = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .sort((a, b) => {
            const timeA = a.createdAt?.toMillis
              ? a.createdAt.toMillis()
              : a.createdAt || 0;
            const timeB = b.createdAt?.toMillis
              ? b.createdAt.toMillis()
              : b.createdAt || 0;
            return timeB - timeA;
          });
        setProjects(fetched);
        setIsLoading(false);
      },
      (error) => {
        console.error(
          'Error fetching projects from Firestore, falling back to local:',
          error
        );
        const saved = localStorage.getItem('watts_projects_local');
        setProjects(saved ? JSON.parse(saved) : []);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const dynamicLocations = useMemo(
    () =>
      Array.from(
        new Set([
          ...DEFAULT_LOCATIONS,
          ...projects.map((p) => p.location).filter(Boolean),
        ])
      ),
    [projects]
  );
  const dynamicGoals = useMemo(
    () =>
      Array.from(
        new Set([
          ...DEFAULT_GOALS,
          ...projects.map((p) => p.goal).filter(Boolean),
        ])
      ),
    [projects]
  );
  const dynamicSeasonals = useMemo(
    () =>
      Array.from(
        new Set([
          ...DEFAULT_SEASONALS,
          ...projects.map((p) => p.seasonal).filter(Boolean),
        ])
      ),
    [projects]
  );
  const dynamicTypes = useMemo(
    () =>
      Array.from(
        new Set([
          ...DEFAULT_TYPES,
          ...projects.map((p) => p.type).filter(Boolean),
        ])
      ),
    [projects]
  );

  const toggleFilter = (category, value) => {
    setFilters((prev) => {
      const currentList = prev[category];
      if (currentList.includes(value)) {
        return {
          ...prev,
          [category]: currentList.filter((item) => item !== value),
        };
      } else {
        return { ...prev, [category]: [...currentList, value] };
      }
    });
  };

  const clearAllFilters = () => {
    setFilters({
      wattsRanges: [],
      locations: [],
      goals: [],
      seasonals: [],
      types: [],
    });
    setSearchQuery('');
  };

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const pWattsRange = getWattsRange(p.watts);

      const matchWatts =
        filters.wattsRanges.length === 0 ||
        filters.wattsRanges.includes(pWattsRange);
      const matchLocation =
        filters.locations.length === 0 ||
        filters.locations.includes(p.location);
      const matchGoal =
        filters.goals.length === 0 || filters.goals.includes(p.goal);
      const matchSeasonal =
        filters.seasonals.length === 0 ||
        filters.seasonals.includes(p.seasonal);
      const matchType =
        filters.types.length === 0 || filters.types.includes(p.type);

      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        (p.type && p.type.toLowerCase().includes(q)) ||
        (p.goal && p.goal.toLowerCase().includes(q)) ||
        (p.location && p.location.toLowerCase().includes(q));

      return (
        matchWatts &&
        matchLocation &&
        matchGoal &&
        matchSeasonal &&
        matchType &&
        matchSearch
      );
    });
  }, [projects, filters, searchQuery]);

  const activeFilterCount = Object.values(filters).reduce(
    (acc, arr) => acc + arr.length,
    0
  );

  // Open Modal in "Add" Mode
  const handleOpenAddModal = () => {
    setEditingProjectId(null);
    setFormData({
      name: '',
      description: '',
      watts: '',
      location: DEFAULT_LOCATIONS[0],
      goal: DEFAULT_GOALS[0],
      seasonal: DEFAULT_SEASONALS[0],
      type: DEFAULT_TYPES[0],
    });
    setCustomInputs({ location: '', goal: '', seasonal: '', type: '' });
    setIsModalOpen(true);
  };

  // Open Modal in "Edit" Mode
  const handleOpenEditModal = (project) => {
    setEditingProjectId(project.id);
    setFormData({
      name: project.name || '',
      description: project.description || '',
      watts: project.watts || '',
      location: project.location || DEFAULT_LOCATIONS[0],
      goal: project.goal || DEFAULT_GOALS[0],
      seasonal: project.seasonal || DEFAULT_SEASONALS[0],
      type: project.type || DEFAULT_TYPES[0],
    });
    setCustomInputs({ location: '', goal: '', seasonal: '', type: '' });
    setIsModalOpen(true);
  };

  // Delete a Project
  const handleDeleteProject = async (projectId) => {
    const confirmDelete = window.confirm(
      'Are you sure you want to permanently delete this project?'
    );
    if (!confirmDelete) return;

    try {
      if (db && user) {
        const projectDocRef = doc(
          db,
          'artifacts',
          appId,
          'public',
          'data',
          'projects',
          projectId
        );
        await deleteDoc(projectDocRef);
      } else {
        const updated = projects.filter((p) => p.id !== projectId);
        setProjects(updated);
        localStorage.setItem('watts_projects_local', JSON.stringify(updated));
      }
    } catch (err) {
      console.error('Error deleting project:', err);
      alert(
        'Failed to delete project. Please check permissions or connection.'
      );
    }
  };

  // Save (Add or Update) Project
  const handleSaveProject = async (e) => {
    e.preventDefault();

    const finalLocation = (
      formData.location === 'ADD_NEW'
        ? customInputs.location
        : formData.location
    ).trim();
    const finalGoal = (
      formData.goal === 'ADD_NEW' ? customInputs.goal : formData.goal
    ).trim();
    const finalSeasonal = (
      formData.seasonal === 'ADD_NEW'
        ? customInputs.seasonal
        : formData.seasonal
    ).trim();
    const finalType = (
      formData.type === 'ADD_NEW' ? customInputs.type : formData.type
    ).trim();

    if (
      !formData.name.trim() ||
      !formData.watts ||
      !finalLocation ||
      !finalGoal ||
      !finalSeasonal ||
      !finalType
    ) {
      return;
    }

    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      watts: Number(formData.watts),
      location: finalLocation,
      goal: finalGoal,
      seasonal: finalSeasonal,
      type: finalType,
    };

    try {
      if (editingProjectId) {
        // --- EDIT MODE ---
        if (db && user) {
          const projectDocRef = doc(
            db,
            'artifacts',
            appId,
            'public',
            'data',
            'projects',
            editingProjectId
          );
          await updateDoc(projectDocRef, payload);
        } else {
          const updated = projects.map((p) =>
            p.id === editingProjectId ? { ...p, ...payload } : p
          );
          setProjects(updated);
          localStorage.setItem('watts_projects_local', JSON.stringify(updated));
        }
      } else {
        // --- ADD MODE ---
        const newProject = {
          ...payload,
          createdAt: db ? serverTimestamp() : Date.now(),
          authorId: user ? user.uid : 'team-member',
        };

        if (db && user) {
          const projectsRef = collection(
            db,
            'artifacts',
            appId,
            'public',
            'data',
            'projects'
          );
          await addDoc(projectsRef, newProject);
        } else {
          const updated = [
            { ...newProject, id: 'local-' + Date.now() },
            ...projects,
          ];
          setProjects(updated);
          localStorage.setItem('watts_projects_local', JSON.stringify(updated));
        }
      }

      setIsModalOpen(false);
      setEditingProjectId(null);
    } catch (err) {
      console.error('Error saving project:', err);
    }
  };

  const exportToCSV = () => {
    if (projects.length === 0) return;
    const headers = [
      'Name',
      'Watts',
      'Location',
      'Goal',
      'Seasonal',
      'Type',
      'Description',
    ];
    const rows = projects.map((p) => [
      `"${(p.name || '').replace(/"/g, '""')}"`,
      p.watts,
      `"${p.location || ''}"`,
      `"${p.goal || ''}"`,
      `"${p.seasonal || ''}"`,
      `"${p.type || ''}"`,
      `"${(p.description || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `watts_projects_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const FilterGroup = ({ title, categoryKey, options, icon: Icon }) => (
    <div className="mb-5 pb-4 border-b border-gray-200 last:border-b-0 last:pb-0">
      <h3 className="text-xs font-black text-black uppercase tracking-wider mb-2.5 flex items-center gap-2">
        <Icon size={14} className="text-yellow-500" /> {title}
      </h3>
      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
        {options.map((option) => {
          const isChecked = filters[categoryKey].includes(option);
          return (
            <label
              key={option}
              className="flex items-center space-x-2.5 cursor-pointer group py-0.5 select-none"
            >
              <div className="relative flex items-center justify-center">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={isChecked}
                  onChange={() => toggleFilter(categoryKey, option)}
                />
                <div className="w-4 h-4 border-2 border-black rounded-sm bg-white peer-checked:bg-yellow-400 peer-checked:border-black transition-all"></div>
                <svg
                  className="absolute w-2.5 h-2.5 text-black pointer-events-none opacity-0 peer-checked:opacity-100"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <span
                className={`text-xs font-bold transition-colors ${
                  isChecked
                    ? 'text-black'
                    : 'text-gray-600 group-hover:text-black'
                }`}
              >
                {option}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900 font-sans flex flex-col">
      <header className="bg-black text-white sticky top-0 z-30 shadow-lg border-b-4 border-yellow-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="bg-yellow-400 text-black p-2 rounded shadow-[2px_2px_0px_0px_#ffffff]">
                <Zap size={22} fill="currentColor" strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                  Watts Projects
                  <span className="text-xs bg-yellow-400 text-black px-2 py-0.5 rounded font-bold tracking-widest hidden sm:inline-block">
                    CATALOGUE
                  </span>
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={exportToCSV}
                title="Export catalogue to CSV"
                className="flex items-center gap-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold py-2 px-3 rounded border border-neutral-600 text-xs uppercase tracking-wider transition-all"
              >
                <Download size={15} />
                <span className="hidden md:inline">Export</span>
              </button>

              <button
                onClick={handleOpenAddModal}
                className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-black font-black py-2 px-3 sm:px-4 rounded border-2 border-black shadow-[3px_3px_0px_0px_#ffffff] hover:shadow-[1px_1px_0px_0px_#ffffff] transition-all text-xs sm:text-sm uppercase tracking-wider"
              >
                <Plus size={18} strokeWidth={3} />
                Add Project
              </button>

              <button
                onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
                className="md:hidden bg-neutral-800 text-yellow-400 p-2 rounded border border-neutral-700"
                aria-label="Toggle filters"
              >
                <Filter size={20} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full flex flex-col md:flex-row gap-6">
        <aside
          className={`md:w-72 flex-shrink-0 ${
            isMobileFiltersOpen ? 'block' : 'hidden'
          } md:block`}
        >
          <div className="bg-white border-2 border-black rounded-lg p-5 mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex justify-between items-center mb-4 pb-3 border-b-2 border-black">
              <h2 className="text-sm font-black uppercase text-black flex items-center gap-2 tracking-wider">
                <Filter size={16} /> Filter Projects
              </h2>
              {(activeFilterCount > 0 || searchQuery) && (
                <button
                  onClick={clearAllFilters}
                  className="text-[11px] font-black text-red-600 hover:text-black flex items-center gap-1 uppercase tracking-wider transition-colors"
                >
                  <RotateCcw size={12} /> Clear All
                </button>
              )}
            </div>

            <FilterGroup
              title="Watts To Use"
              categoryKey="wattsRanges"
              options={WATTS_RANGES}
              icon={Activity}
            />
            <FilterGroup
              title="Location"
              categoryKey="locations"
              options={dynamicLocations}
              icon={MapPin}
            />
            <FilterGroup
              title="Goal"
              categoryKey="goals"
              options={dynamicGoals}
              icon={Target}
            />
            <FilterGroup
              title="Seasonal"
              categoryKey="seasonals"
              options={dynamicSeasonals}
              icon={Calendar}
            />
            <FilterGroup
              title="Type"
              categoryKey="types"
              options={dynamicTypes}
              icon={Tag}
            />
          </div>

          <div className="bg-black text-white rounded-lg p-5 border-2 border-yellow-400 shadow-[4px_4px_0px_0px_#FFD100]">
            <h2 className="text-sm font-black uppercase text-yellow-400 flex items-center gap-2 mb-3 tracking-wider">
              <Map size={16} /> Region Key
            </h2>
            <div className="space-y-3 text-xs leading-relaxed">
              {REGION_KEY_DATA.map((item) => (
                <div
                  key={item.region}
                  className="border-b border-neutral-800 last:border-b-0 pb-2 last:pb-0"
                >
                  <span className="text-yellow-400 font-black uppercase block tracking-wider">
                    {item.region}:
                  </span>
                  <span className="text-neutral-300 font-medium">
                    {item.desc}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <section className="flex-1 min-w-0">
          <div className="bg-white border-2 border-black rounded-lg p-4 mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search
                className="absolute left-3 top-2.5 text-neutral-400"
                size={16}
              />
              <input
                type="text"
                placeholder="Search projects, tags, descriptions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs font-semibold border-2 border-neutral-300 rounded focus:border-black focus:outline-none transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-black"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
              <span className="text-xs font-black uppercase tracking-wider text-neutral-600">
                Showing{' '}
                <span className="text-black font-extrabold text-sm">
                  {filteredProjects.length}
                </span>{' '}
                of {projects.length} Projects
              </span>
              {activeFilterCount > 0 && (
                <span className="bg-yellow-400 text-black text-[11px] font-black px-2 py-0.5 rounded-full border border-black">
                  {activeFilterCount} Filter{activeFilterCount > 1 ? 's' : ''}{' '}
                  Active
                </span>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="bg-white border-2 border-black rounded-lg p-12 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <Zap
                className="animate-bounce mx-auto text-yellow-400 mb-2"
                size={32}
              />
              <p className="text-sm font-bold uppercase tracking-wider">
                Loading Catalogue...
              </p>
            </div>
          ) : projects.length === 0 ? (
            <div className="bg-white border-2 border-black rounded-lg p-12 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="bg-yellow-400 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 border-2 border-black">
                <Zap size={22} className="text-black" fill="black" />
              </div>
              <h3 className="text-base font-black uppercase tracking-wider text-black mb-1">
                Your Catalogue is Empty
              </h3>
              <p className="text-xs text-neutral-500 max-w-sm mx-auto mb-5 font-medium">
                You're ready to start from scratch! Click below to add your
                team's first project.
              </p>
              <button
                onClick={handleOpenAddModal}
                className="bg-yellow-400 text-black text-xs font-black uppercase tracking-wider px-4 py-2.5 rounded border-2 border-black shadow-[3px_3px_0px_0px_#000000] hover:shadow-[1px_1px_0px_0px_#000000] transition-all inline-flex items-center gap-1.5"
              >
                <Plus size={16} strokeWidth={3} />
                Add Your First Project
              </button>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="bg-white border-2 border-black rounded-lg p-12 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="bg-yellow-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 border border-yellow-400">
                <Filter size={20} className="text-black" />
              </div>
              <h3 className="text-base font-black uppercase tracking-wider text-black mb-1">
                No Matching Projects
              </h3>
              <p className="text-xs text-neutral-500 max-w-sm mx-auto mb-4 font-medium">
                Try deselecting some filters or clearing your search term to see
                more results from the master list.
              </p>
              <button
                onClick={clearAllFilters}
                className="bg-black text-white text-xs font-black uppercase tracking-wider px-4 py-2 rounded border-2 border-yellow-400 hover:bg-neutral-900 transition-colors"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredProjects.map((project) => (
                <div
                  key={project.id}
                  className="bg-white border-2 border-black rounded-lg flex flex-col justify-between p-5 hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_#FFD100]"
                >
                  <div>
                    {/* Header: Watts, Type, and Edit/Delete Controls */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="bg-black text-yellow-400 text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded flex items-center gap-1.5 shadow-sm">
                          <Zap size={14} fill="#FFD100" />
                          {project.watts} Watts
                        </span>
                        <span className="text-[11px] font-black uppercase tracking-wider bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded border border-neutral-300">
                          {project.type}
                        </span>
                      </div>

                      {/* Edit & Delete Action Buttons */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditModal(project)}
                          title="Edit Project"
                          className="p-1 hover:bg-yellow-100 rounded text-neutral-600 hover:text-black border border-transparent hover:border-black transition-all"
                        >
                          <Pencil size={14} strokeWidth={2.5} />
                        </button>
                        <button
                          onClick={() => handleDeleteProject(project.id)}
                          title="Delete Project"
                          className="p-1 hover:bg-red-100 rounded text-neutral-400 hover:text-red-600 border border-transparent hover:border-red-300 transition-all"
                        >
                          <Trash2 size={14} strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>

                    {/* Project Title */}
                    <h3 className="text-base font-black text-black leading-snug mb-2 uppercase tracking-tight">
                      {project.name}
                    </h3>

                    {/* Short Description */}
                    <p className="text-xs font-medium text-neutral-600 line-clamp-3 mb-4 leading-relaxed">
                      {project.description ||
                        'No project description provided.'}
                    </p>
                  </div>

                  {/* Card Bottom Tags */}
                  <div className="pt-3 border-t border-neutral-200">
                    <div className="flex flex-wrap gap-1.5">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase bg-yellow-100 text-yellow-900 px-2 py-0.5 rounded border border-yellow-300">
                        <MapPin size={10} /> {project.location}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase bg-neutral-100 text-neutral-800 px-2 py-0.5 rounded border border-neutral-300">
                        <Target size={10} /> {project.goal}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase bg-neutral-100 text-neutral-800 px-2 py-0.5 rounded border border-neutral-300">
                        <Calendar size={10} /> {project.seasonal}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* ==================================================================== */}
      {/* 🚀 ADD / EDIT PROJECT MODAL                                          */}
      {/* ==================================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-white border-4 border-black rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto shadow-[8px_8px_0px_0px_#FFD100]">
            <div className="flex justify-between items-center pb-4 mb-4 border-b-2 border-black">
              <div className="flex items-center gap-2">
                <div className="bg-yellow-400 p-1.5 rounded border-2 border-black">
                  {editingProjectId ? (
                    <Pencil size={20} className="text-black" />
                  ) : (
                    <Zap size={20} className="text-black" fill="black" />
                  )}
                </div>
                <h2 className="text-lg font-black uppercase text-black tracking-tight">
                  {editingProjectId
                    ? 'Edit Project'
                    : 'Add Project to Catalogue'}
                </h2>
              </div>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingProjectId(null);
                }}
                className="text-neutral-500 hover:text-black p-1"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveProject} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-black uppercase tracking-wider mb-1 text-black">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Electric Van Wrap Recruitment Campaign"
                    className="w-full px-3 py-2 text-xs font-semibold border-2 border-neutral-300 rounded focus:border-black focus:outline-none"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1 text-black">
                    Watts Needed *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g., 45"
                    className="w-full px-3 py-2 text-xs font-semibold border-2 border-neutral-300 rounded focus:border-black focus:outline-none"
                    value={formData.watts}
                    onChange={(e) =>
                      setFormData({ ...formData, watts: e.target.value })
                    }
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider mb-1 text-black">
                  Short Description *
                </label>
                <textarea
                  required
                  rows="2"
                  placeholder="Outline who this project targets, key deliverables, and campaign intent..."
                  className="w-full px-3 py-2 text-xs font-semibold border-2 border-neutral-300 rounded focus:border-black focus:outline-none"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1 text-black">
                    Location / Region *
                  </label>
                  <select
                    className="w-full px-3 py-2 text-xs font-semibold border-2 border-neutral-300 rounded focus:border-black focus:outline-none bg-white mb-2"
                    value={formData.location}
                    onChange={(e) =>
                      setFormData({ ...formData, location: e.target.value })
                    }
                  >
                    {dynamicLocations.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                    <option
                      value="ADD_NEW"
                      className="font-black text-amber-600 bg-yellow-50"
                    >
                      + Create New Location...
                    </option>
                  </select>
                  {formData.location === 'ADD_NEW' && (
                    <input
                      type="text"
                      required
                      placeholder="Type new region/location name..."
                      className="w-full px-3 py-2 text-xs font-bold border-2 border-yellow-400 bg-yellow-50 rounded focus:border-black focus:outline-none"
                      value={customInputs.location}
                      onChange={(e) =>
                        setCustomInputs({
                          ...customInputs,
                          location: e.target.value,
                        })
                      }
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1 text-black">
                    Goal *
                  </label>
                  <select
                    className="w-full px-3 py-2 text-xs font-semibold border-2 border-neutral-300 rounded focus:border-black focus:outline-none bg-white mb-2"
                    value={formData.goal}
                    onChange={(e) =>
                      setFormData({ ...formData, goal: e.target.value })
                    }
                  >
                    {dynamicGoals.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                    <option
                      value="ADD_NEW"
                      className="font-black text-amber-600 bg-yellow-50"
                    >
                      + Create New Goal...
                    </option>
                  </select>
                  {formData.goal === 'ADD_NEW' && (
                    <input
                      type="text"
                      required
                      placeholder="Type new goal name..."
                      className="w-full px-3 py-2 text-xs font-bold border-2 border-yellow-400 bg-yellow-50 rounded focus:border-black focus:outline-none"
                      value={customInputs.goal}
                      onChange={(e) =>
                        setCustomInputs({
                          ...customInputs,
                          goal: e.target.value,
                        })
                      }
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1 text-black">
                    Seasonal *
                  </label>
                  <select
                    className="w-full px-3 py-2 text-xs font-semibold border-2 border-neutral-300 rounded focus:border-black focus:outline-none bg-white mb-2"
                    value={formData.seasonal}
                    onChange={(e) =>
                      setFormData({ ...formData, seasonal: e.target.value })
                    }
                  >
                    {dynamicSeasonals.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                    <option
                      value="ADD_NEW"
                      className="font-black text-amber-600 bg-yellow-50"
                    >
                      + Create New Season...
                    </option>
                  </select>
                  {formData.seasonal === 'ADD_NEW' && (
                    <input
                      type="text"
                      required
                      placeholder="Type new seasonal category..."
                      className="w-full px-3 py-2 text-xs font-bold border-2 border-yellow-400 bg-yellow-50 rounded focus:border-black focus:outline-none"
                      value={customInputs.seasonal}
                      onChange={(e) =>
                        setCustomInputs({
                          ...customInputs,
                          seasonal: e.target.value,
                        })
                      }
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1 text-black">
                    Project Type *
                  </label>
                  <select
                    className="w-full px-3 py-2 text-xs font-semibold border-2 border-neutral-300 rounded focus:border-black focus:outline-none bg-white mb-2"
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({ ...formData, type: e.target.value })
                    }
                  >
                    {dynamicTypes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                    <option
                      value="ADD_NEW"
                      className="font-black text-amber-600 bg-yellow-50"
                    >
                      + Create New Type...
                    </option>
                  </select>
                  {formData.type === 'ADD_NEW' && (
                    <input
                      type="text"
                      required
                      placeholder="Type new project type..."
                      className="w-full px-3 py-2 text-xs font-bold border-2 border-yellow-400 bg-yellow-50 rounded focus:border-black focus:outline-none"
                      value={customInputs.type}
                      onChange={(e) =>
                        setCustomInputs({
                          ...customInputs,
                          type: e.target.value,
                        })
                      }
                    />
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t-2 border-black">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingProjectId(null);
                  }}
                  className="px-4 py-2 text-xs font-black uppercase tracking-wider text-black bg-neutral-200 hover:bg-neutral-300 rounded border-2 border-black transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-black uppercase tracking-wider text-black bg-yellow-400 hover:bg-yellow-500 rounded border-2 border-black shadow-[3px_3px_0px_0px_#000000] hover:shadow-[1px_1px_0px_0px_#000000] transition-all flex items-center gap-1.5"
                >
                  <Plus size={16} strokeWidth={3} />
                  {editingProjectId ? 'Save Changes' : 'Add to Catalogue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
