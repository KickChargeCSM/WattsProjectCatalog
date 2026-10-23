import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Plus, Filter, Zap, Map, X, Search, Activity, Tag, Calendar, MapPin, Target, RotateCcw, Download, Pencil, Trash2, Wifi, WifiOff, ChevronDown, ChevronUp, Briefcase } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description: string;
  watts: number | string;
  industry?: string | string[];
  location: string | string[];
  goal: string | string[];
  seasonal: string | string[];
  type: string | string[];
  createdAt?: any;
}

interface FilterState {
  wattsRanges: string[];
  industries: string[];
  locations: string[];
  goals: string[];
  seasonals: string[];
  types: string[];
}

interface FormDataState {
  name: string;
  description: string;
  watts: string;
  isCustomQuote: boolean;
  industries: string[];
  locations: string[];
  goals: string[];
  seasonals: string[];
  types: string[];
}

interface CustomFilterOptions {
  industries?: string[];
  locations?: string[];
  goals?: string[];
  seasonals?: string[];
  types?: string[];
}

const WATTS_RANGES = ['Any', 'Under 25', '25-50', 'Over 50', 'Custom Quote'];
const DEFAULT_INDUSTRIES = ['Any', 'Electric', 'Solar', 'Roofing', 'Plumbing', 'Gutters', 'Garage Doors', 'HVAC', 'Pest Control', 'Home Improvement', 'Other'];
const DEFAULT_LOCATIONS = ['Any', 'Northeast', 'Midwest', 'South', 'West'];
const DEFAULT_GOALS = ['Any', 'Recruitment', 'Company Culture', 'Brand Awareness', 'New Customers', 'Existing Customers', 'Events'];
const DEFAULT_SEASONALS = ['Any', 'General Holiday', 'Fall', 'Winter', 'Spring', 'Summer'];
const DEFAULT_TYPES = ['Any', 'Collateral', 'OOH', 'Apparel', 'Vehicle', 'Digital/Social Marketing', 'Print Marketing'];

const REGION_KEY_DATA = [
  { 
    region: 'Northeast', 
    color: '#38bdf8',
    desc: 'CT, ME, MA, NH, RI, VT, NJ, NY, PA' 
  },
  { 
    region: 'Midwest', 
    color: '#34d399',
    desc: 'IL, IN, MI, OH, WI, IA, KS, MN, MO, NE, ND, SD' 
  },
  { 
    region: 'South', 
    color: '#fb923c',
    desc: 'DE, DC, FL, GA, MD, NC, SC, VA, WV, AL, KY, MS, TN, AR, LA, OK, TX' 
  },
  { 
    region: 'West', 
    color: '#facc15',
    desc: 'AZ, CO, ID, MT, NV, NM, UT, WY, AK, CA, HI, OR, WA' 
  }
];

const firebaseConfig = {
  apiKey: "AIzaSyD5DXCgPr59ZJ_2KtvdeIu-B36LoKTeQyE",
  authDomain: "watts-library-tracker.firebaseapp.com",
  projectId: "watts-library-tracker",
  storageBucket: "watts-library-tracker.firebasestorage.app",
  messagingSenderId: "516069496416",
  appId: "1:516069496416:web:6b779b69566c1da8fcd505"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

const toArray = (val: string | string[] | undefined | null): string[] => {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  return [val].filter(Boolean);
};

const getWattsRange = (watts: number | string): string => {
  if (typeof watts === 'string' && (watts.toLowerCase().includes('quote') || isNaN(Number(watts)))) {
    return 'Custom Quote';
  }
  const w = Number(watts);
  if (w < 25) return 'Under 25';
  if (w >= 25 && w <= 50) return '25-50';
  return 'Over 50';
};

function RegionKeyBanner({ isCollapsible = false }: { isCollapsible?: boolean }) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="bg-black text-white border-2 border-yellow-400 rounded-lg p-4 shadow-[4px_4px_0px_0px_#FFD100]">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="bg-yellow-400 p-1 rounded border border-black">
            <Map size={14} className="text-black" />
          </div>
          <span className="text-xs font-black uppercase tracking-wider text-yellow-400">
            Region Key Reference
          </span>
        </div>
        {isCollapsible && (
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="text-neutral-400 hover:text-white text-[11px] font-bold flex items-center gap-1 uppercase tracking-wider transition-colors"
          >
            {isOpen ? (
              <><span>Hide</span> <ChevronUp size={14} /></>
            ) : (
              <><span>Show</span> <ChevronDown size={14} /></>
            )}
          </button>
        )}
      </div>

      {isOpen && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-neutral-800">
          {REGION_KEY_DATA.map(item => (
            <div key={item.region} className="bg-neutral-900 border border-neutral-800 rounded p-2.5">
              <span className="font-black uppercase tracking-wider text-yellow-400 block mb-1 text-xs">
                {item.region}:
              </span>
              <span className="text-neutral-300 text-[11px] font-medium leading-relaxed block">
                {item.desc}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
  onCustomAdd,
  icon: Icon,
  placeholder
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (items: string[]) => void;
  onCustomAdd?: (newOption: string) => void;
  icon: any;
  placeholder: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (opt: string) => {
    if (selected.includes(opt)) {
      onChange(selected.filter(item => item !== opt));
    } else {
      onChange([...selected, opt]);
    }
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const val = customInput.trim();
    if (val && !selected.includes(val)) {
      onChange([...selected, val]);
      if (onCustomAdd) {
        onCustomAdd(val);
      }
      setCustomInput('');
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-1.5">
          <Icon size={13} className="text-yellow-500" /> {label} *
        </label>
        {selected.length > 0 && (
          <span className="text-[10px] font-bold bg-yellow-400 text-black px-1.5 py-0.2 rounded border border-black">
            {selected.length} selected
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left px-3 py-2 text-xs font-semibold border-2 border-neutral-300 rounded focus:border-black focus:outline-none bg-white flex items-center justify-between shadow-sm hover:border-neutral-400 transition-colors"
      >
        <span className="truncate text-neutral-800">
          {selected.length === 0 ? (
            <span className="text-neutral-400 font-normal">{placeholder}</span>
          ) : (
            selected.join(', ')
          )}
        </span>
        <ChevronDown size={14} className={`transform transition-transform ml-2 shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {selected.map(item => (
            <span
              key={item}
              className="inline-flex items-center gap-1 text-[11px] font-bold bg-yellow-100 text-neutral-900 border border-yellow-400 px-2 py-0.5 rounded"
            >
              {item}
              <button
                type="button"
                onClick={() => toggleOption(item)}
                className="hover:text-red-600 font-black ml-0.5 text-xs leading-none"
                title={`Remove ${item}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border-2 border-black rounded-lg shadow-2xl p-2.5 max-h-56 overflow-y-auto">
          <div className="space-y-1 mb-2">
            {options.map(opt => {
              const isChecked = selected.includes(opt);
              return (
                <label
                  key={opt}
                  className="flex items-center space-x-2 text-xs font-bold p-1 rounded hover:bg-neutral-100 cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleOption(opt)}
                    className="rounded border-neutral-400 text-yellow-400 focus:ring-0"
                  />
                  <span className={isChecked ? 'text-black' : 'text-neutral-700'}>{opt}</span>
                </label>
              );
            })}
          </div>

          <div className="pt-2 border-t border-neutral-200">
            <div className="flex gap-1.5">
              <input
                type="text"
                placeholder="+ Add custom option..."
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustom(e);
                  }
                }}
                className="flex-1 px-2 py-1 text-xs border border-neutral-300 rounded font-semibold focus:outline-none focus:border-black"
              />
              <button
                type="button"
                onClick={handleAddCustom}
                disabled={!customInput.trim()}
                className="bg-black text-white text-[11px] font-bold px-2 py-1 rounded disabled:opacity-40 hover:bg-neutral-800"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterDropdownGroup({
  title,
  categoryKey,
  options,
  icon: Icon,
  selectedList,
  onToggle,
  onSelectAll,
  onClear
}: {
  title: string;
  categoryKey: keyof FilterState;
  options: string[];
  icon: any;
  selectedList: string[];
  onToggle: (cat: keyof FilterState, val: string) => void;
  onSelectAll: (cat: keyof FilterState, allOptions: string[]) => void;
  onClear: (cat: keyof FilterState) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showAll, setShowAll] = useState(false);
  
  const listWithOptions = useMemo(() => {
    const rawWithoutAny = options.filter(o => o !== 'Any');
    return ['Any', ...rawWithoutAny];
  }, [options]);

  const specificSelected = selectedList.filter(o => o !== 'Any');
  const isAnyActive = specificSelected.length === 0 || selectedList.includes('Any');

  const visibleOptions = showAll ? listWithOptions : listWithOptions.slice(0, 4);
  const hasMore = listWithOptions.length > 4;

  return (
    <div className="mb-4 pb-3 border-b border-gray-200 last:border-b-0 last:pb-0">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs font-black text-black uppercase tracking-wider flex items-center gap-2 hover:text-neutral-700 select-none text-left"
        >
          <Icon size={14} className="text-yellow-500" />
          <span>{title}</span>
          {specificSelected.length > 0 ? (
            <span className="text-[10px] bg-yellow-400 text-black px-1.5 py-0.2 rounded font-black border border-black">
              {specificSelected.length}
            </span>
          ) : (
            <span className="text-[10px] bg-neutral-200 text-neutral-800 px-1.5 py-0.2 rounded font-black border border-neutral-400">
              Any
            </span>
          )}
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        <div className="flex items-center gap-1.5 text-[10px] font-bold">
          {specificSelected.length > 0 && (
            <button
              type="button"
              onClick={() => onClear(categoryKey)}
              className="text-neutral-600 hover:text-black hover:underline"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-1.5 overflow-y-auto pr-1 mt-2">
          {visibleOptions.map((option: string) => {
            const isChecked = option === 'Any' ? isAnyActive : selectedList.includes(option);
            return (
              <label 
                key={option} 
                className={`flex items-center space-x-2.5 cursor-pointer group py-0.5 select-none ${
                  option === 'Any' ? 'pb-1.5 mb-1.5 border-b-2 border-neutral-200' : ''
                }`}
              >
                <div className="relative flex items-center justify-center">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={isChecked}
                    onChange={() => onToggle(categoryKey, option)}
                  />
                  <div className={`w-4 h-4 border-2 border-black rounded-sm bg-white transition-all ${
                    isChecked ? (option === 'Any' ? 'bg-black' : 'bg-yellow-400') : ''
                  }`}></div>
                  <svg className={`absolute w-2.5 h-2.5 pointer-events-none opacity-0 peer-checked:opacity-100 ${
                    option === 'Any' ? 'text-yellow-400' : 'text-black'
                  }`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className={`text-xs transition-colors ${
                  isChecked 
                    ? (option === 'Any' ? 'text-black font-black uppercase tracking-wider' : 'text-black font-bold') 
                    : 'text-gray-600 group-hover:text-black font-medium'
                }`}>
                  {option === 'Any' ? 'Any' : option}
                </span>
              </label>
            );
          })}

          {hasMore && (
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              className="text-[11px] font-black text-neutral-600 hover:text-black pt-1.5 flex items-center gap-1 uppercase tracking-wider transition-colors select-none"
            >
              {showAll ? (
                <>
                  <ChevronUp size={13} /> Show Less
                </>
              ) : (
                <>
                  <ChevronDown size={13} /> Show More ({listWithOptions.length - 4} More)
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState<boolean>(false);
  const [isModalRegionKeyOpen, setIsModalRegionKeyOpen] = useState<boolean>(false);

  // Shared persistent custom filter tags stored in Firestore
  const [savedCustomTags, setSavedCustomTags] = useState<CustomFilterOptions>({
    industries: [],
    locations: [],
    goals: [],
    seasonals: [],
    types: []
  });
  
  const [filters, setFilters] = useState<FilterState>({
    wattsRanges: [],
    industries: [],
    locations: [],
    goals: [],
    seasonals: [],
    types: []
  });

  const [formData, setFormData] = useState<FormDataState>({
    name: '',
    description: '',
    watts: '',
    isCustomQuote: false,
    industries: [DEFAULT_INDUSTRIES.find(i => i !== 'Any') || 'Electric'],
    locations: [DEFAULT_LOCATIONS.find(l => l !== 'Any') || 'Northeast'],
    goals: [DEFAULT_GOALS.find(g => g !== 'Any') || 'Recruitment'],
    seasonals: [DEFAULT_SEASONALS.find(s => s !== 'Any') || 'General Holiday'],
    types: [DEFAULT_TYPES.find(t => t !== 'Any') || 'Collateral']
  });

  useEffect(() => {
    const projectsRef = collection(db, 'projects');
    const unsubscribeProjects = onSnapshot(
      projectsRef,
      (snapshot) => {
        const fetched = snapshot.docs.map(docSnapshot => ({
          id: docSnapshot.id,
          ...(docSnapshot.data() as Omit<Project, 'id'>)
        })).sort((a, b) => {
          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt || 0);
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt || 0);
          return timeB - timeA;
        });
        setProjects(fetched);
        setIsLoading(false);
        setDbError(null);
      },
      (error) => {
        console.error("Firestore error:", error);
        setDbError(error.message);
        setIsLoading(false);
      }
    );

    const customTagsDoc = doc(db, 'metadata', 'custom_tags');
    const unsubscribeTags = onSnapshot(
      customTagsDoc,
      (docSnap) => {
        if (docSnap.exists()) {
          setSavedCustomTags(docSnap.data() as CustomFilterOptions);
        }
      },
      (error) => {
        console.warn("Custom tags sync note:", error.message);
      }
    );

    return () => {
      unsubscribeProjects();
      unsubscribeTags();
    };
  }, []);

  const saveCustomTagToCloud = async (category: keyof CustomFilterOptions, newTag: string) => {
    try {
      const existing = savedCustomTags[category] || [];
      if (!existing.includes(newTag)) {
        const updatedList = Array.from(new Set([...existing, newTag]));
        await setDoc(doc(db, 'metadata', 'custom_tags'), {
          ...savedCustomTags,
          [category]: updatedList
        }, { merge: true });
      }
    } catch (err) {
      console.error("Error saving custom tag:", err);
    }
  };

  const dynamicIndustries = useMemo(() => Array.from(new Set([
    ...DEFAULT_INDUSTRIES,
    ...(savedCustomTags.industries || []),
    ...projects.flatMap(p => toArray(p.industry))
  ])).filter(Boolean), [projects, savedCustomTags]);

  const dynamicLocations = useMemo(() => Array.from(new Set([
    ...DEFAULT_LOCATIONS,
    ...(savedCustomTags.locations || []),
    ...projects.flatMap(p => toArray(p.location))
  ])).filter(Boolean), [projects, savedCustomTags]);

  const dynamicGoals = useMemo(() => Array.from(new Set([
    ...DEFAULT_GOALS,
    ...(savedCustomTags.goals || []),
    ...projects.flatMap(p => toArray(p.goal))
  ])).filter(Boolean), [projects, savedCustomTags]);

  const dynamicSeasonals = useMemo(() => Array.from(new Set([
    ...DEFAULT_SEASONALS,
    ...(savedCustomTags.seasonals || []),
    ...projects.flatMap(p => toArray(p.seasonal))
  ])).filter(Boolean), [projects, savedCustomTags]);

  const dynamicTypes = useMemo(() => Array.from(new Set([
    ...DEFAULT_TYPES,
    ...(savedCustomTags.types || []),
    ...projects.flatMap(p => toArray(p.type))
  ])).filter(Boolean), [projects, savedCustomTags]);

  const toggleFilter = (category: keyof FilterState, value: string) => {
    setFilters(prev => {
      if (value === 'Any') {
        return { ...prev, [category]: [] };
      }
      const withoutAny = prev[category].filter(item => item !== 'Any');
      let updated: string[];
      if (withoutAny.includes(value)) {
        updated = withoutAny.filter(item => item !== value);
      } else {
        updated = [...withoutAny, value];
      }
      return { ...prev, [category]: updated };
    });
  };

  const selectAllFilter = (category: keyof FilterState, allOptions: string[]) => {
    setFilters(prev => ({ ...prev, [category]: allOptions.filter(o => o !== 'Any') }));
  };

  const clearCategoryFilter = (category: keyof FilterState) => {
    setFilters(prev => ({ ...prev, [category]: [] }));
  };

  const clearAllFilters = () => {
    setFilters({
      wattsRanges: [],
      industries: [],
      locations: [],
      goals: [],
      seasonals: [],
      types: []
    });
    setSearchQuery('');
  };

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const pWattsRange = getWattsRange(p.watts);
      const pInds = toArray(p.industry);
      const pLocs = toArray(p.location);
      const pGoals = toArray(p.goal);
      const pSeasons = toArray(p.seasonal);
      const pTypes = toArray(p.type);
      
      const wattsFilterActive = filters.wattsRanges.filter(w => w !== 'Any');
      const industriesFilterActive = filters.industries.filter(i => i !== 'Any');
      const locsFilterActive = filters.locations.filter(l => l !== 'Any');
      const goalsFilterActive = filters.goals.filter(g => g !== 'Any');
      const seasonalsFilterActive = filters.seasonals.filter(s => s !== 'Any');
      const typesFilterActive = filters.types.filter(t => t !== 'Any');

      const matchWatts = wattsFilterActive.length === 0 || wattsFilterActive.includes(pWattsRange);
      const matchIndustry = industriesFilterActive.length === 0 || pInds.includes('Any') || pInds.some(ind => industriesFilterActive.includes(ind));
      const matchLocation = locsFilterActive.length === 0 || pLocs.includes('Any') || pLocs.some(loc => locsFilterActive.includes(loc));
      const matchGoal = goalsFilterActive.length === 0 || pGoals.includes('Any') || pGoals.some(g => goalsFilterActive.includes(g));
      const matchSeasonal = seasonalsFilterActive.length === 0 || pSeasons.includes('Any') || pSeasons.some(s => seasonalsFilterActive.includes(s));
      const matchType = typesFilterActive.length === 0 || pTypes.includes('Any') || pTypes.some(t => typesFilterActive.includes(t));

      const q = searchQuery.toLowerCase().trim();
      const terms = q.split(/\s+/).filter(Boolean);
      const matchSearch = terms.length === 0 || terms.every(term => {
        const inTitle = p.name && p.name.toLowerCase().includes(term);
        const inDesc = p.description && p.description.toLowerCase().includes(term);
        const inIndustry = pInds.some(i => i.toLowerCase().includes(term));
        const inType = pTypes.some(t => t.toLowerCase().includes(term));
        const inGoal = pGoals.some(g => g.toLowerCase().includes(term));
        const inLoc = pLocs.some(l => l.toLowerCase().includes(term));
        const inWatts = String(p.watts).toLowerCase().includes(term);
        return inTitle || inDesc || inIndustry || inType || inGoal || inLoc || inWatts;
      });

      return matchWatts && matchIndustry && matchLocation && matchGoal && matchSeasonal && matchType && matchSearch;
    });
  }, [projects, filters, searchQuery]);

  const activeFilterCount = Object.values(filters).reduce((acc, arr) => {
    return acc + arr.filter(i => i !== 'Any').length;
  }, 0);

  const handleOpenAddModal = () => {
    setEditingProjectId(null);
    setIsModalRegionKeyOpen(false);
    setFormData({
      name: '',
      description: '',
      watts: '',
      isCustomQuote: false,
      industries: [DEFAULT_INDUSTRIES.find(i => i !== 'Any') || 'Electric'],
      locations: [DEFAULT_LOCATIONS.find(l => l !== 'Any') || 'Northeast'],
      goals: [DEFAULT_GOALS.find(g => g !== 'Any') || 'Recruitment'],
      seasonals: [DEFAULT_SEASONALS.find(s => s !== 'Any') || 'General Holiday'],
      types: [DEFAULT_TYPES.find(t => t !== 'Any') || 'Collateral']
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (project: Project) => {
    setEditingProjectId(project.id);
    setIsModalRegionKeyOpen(false);
    const isQuote = typeof project.watts === 'string' && (project.watts.toLowerCase().includes('quote') || isNaN(Number(project.watts)));
    setFormData({
      name: project.name || '',
      description: project.description || '',
      watts: isQuote ? '' : String(project.watts || ''),
      isCustomQuote: isQuote,
      industries: toArray(project.industry).length > 0 ? toArray(project.industry) : [DEFAULT_INDUSTRIES.find(i => i !== 'Any') || 'Electric'],
      locations: toArray(project.location),
      goals: toArray(project.goal),
      seasonals: toArray(project.seasonal),
      types: toArray(project.type)
    });
    setIsModalOpen(true);
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this project?")) return;
    try {
      await deleteDoc(doc(db, 'projects', projectId));
    } catch (err: any) {
      alert("Error deleting from cloud database: " + err.message);
    }
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formData.name.trim() || 
      (!formData.isCustomQuote && !formData.watts) || 
      formData.industries.length === 0 || 
      formData.locations.length === 0 || 
      formData.goals.length === 0 || 
      formData.seasonals.length === 0 || 
      formData.types.length === 0
    ) {
      alert("Please fill in all required fields and select at least one option for Industry, Location, Goal, Seasonal, and Type.");
      return;
    }

    const payload = {
      name: formData.name.trim(),
      description: (formData.description || '').trim(),
      watts: formData.isCustomQuote ? 'Custom Quote' : Number(formData.watts),
      industry: formData.industries,
      location: formData.locations,
      goal: formData.goals,
      seasonal: formData.seasonals,
      type: formData.types,
    };

    try {
      const newCustomTags: CustomFilterOptions = {
        industries: Array.from(new Set([...(savedCustomTags.industries || []), ...formData.industries.filter(i => !DEFAULT_INDUSTRIES.includes(i))])),
        locations: Array.from(new Set([...(savedCustomTags.locations || []), ...formData.locations.filter(l => !DEFAULT_LOCATIONS.includes(l))])),
        goals: Array.from(new Set([...(savedCustomTags.goals || []), ...formData.goals.filter(g => !DEFAULT_GOALS.includes(g))])),
        seasonals: Array.from(new Set([...(savedCustomTags.seasonals || []), ...formData.seasonals.filter(s => !DEFAULT_SEASONALS.includes(s))])),
        types: Array.from(new Set([...(savedCustomTags.types || []), ...formData.types.filter(t => !DEFAULT_TYPES.includes(t))])),
      };
      await setDoc(doc(db, 'metadata', 'custom_tags'), newCustomTags, { merge: true });

      if (editingProjectId) {
        await updateDoc(doc(db, 'projects', editingProjectId), payload);
      } else {
        await addDoc(collection(db, 'projects'), {
          ...payload,
          createdAt: serverTimestamp()
        });
      }

      setIsModalOpen(false);
      setEditingProjectId(null);
    } catch (err: any) {
      alert("Error saving to cloud database: " + err.message);
    }
  };

  const exportToCSV = () => {
    if (projects.length === 0) return;
    const headers = ['Name', 'Watts', 'Industry', 'Locations', 'Goals', 'Seasonals', 'Types', 'Description'];
    const rows = projects.map(p => [
      `"${(p.name || '').replace(/"/g, '""')}"`,
      typeof p.watts === 'string' ? `"${p.watts}"` : p.watts,
      `"${toArray(p.industry).join('; ')}"`,
      `"${toArray(p.location).join('; ')}"`,
      `"${toArray(p.goal).join('; ')}"`,
      `"${toArray(p.seasonal).join('; ')}"`,
      `"${toArray(p.type).join('; ')}"`,
      `"${(p.description || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `watts_project_catalog_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900 font-sans flex flex-col">
      {dbError && (
        <div className="bg-red-600 text-white font-bold text-xs py-2 px-4 text-center border-b-2 border-black flex items-center justify-center gap-2">
          <WifiOff size={16} />
          <span>Cloud Connection Blocked: {dbError}</span>
        </div>
      )}

      <header className="bg-black text-white sticky top-0 z-30 shadow-lg border-b-4 border-yellow-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="bg-yellow-400 text-black p-2 rounded shadow-[2px_2px_0px_0px_#ffffff]">
                <Zap size={22} fill="currentColor" strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                  Watts Project
                  <span className="text-xs bg-yellow-400 text-black px-2 py-0.5 rounded font-bold tracking-widest hidden sm:inline-block">
                    CATALOG
                  </span>
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <div className={`hidden sm:flex items-center gap-1.5 text-[10px] font-black uppercase px-2 py-1 rounded border ${dbError ? 'bg-red-950 text-red-300 border-red-700' : 'bg-neutral-900 text-green-400 border-neutral-700'}`}>
                {dbError ? <WifiOff size={12} /> : <Wifi size={12} className="animate-pulse" />}
                <span>{dbError ? 'Disconnected' : 'Cloud Live'}</span>
              </div>

              <button
                onClick={exportToCSV}
                title="Export catalog to CSV"
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

      {/* TOP REGION KEY REFERENCE BANNER */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 w-full">
        <RegionKeyBanner isCollapsible={true} />
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full flex flex-col md:flex-row gap-6">
        <aside className={`md:w-72 flex-shrink-0 ${isMobileFiltersOpen ? 'block' : 'hidden'} md:block`}>
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
                  <RotateCcw size={12} /> Reset
                </button>
              )}
            </div>

            {/* 1. WATTS */}
            <FilterDropdownGroup 
              title="Watts" 
              categoryKey="wattsRanges" 
              options={WATTS_RANGES} 
              icon={Activity}
              selectedList={filters.wattsRanges}
              onToggle={toggleFilter}
              onSelectAll={selectAllFilter}
              onClear={clearCategoryFilter}
            />

            {/* 2. INDUSTRY */}
            <FilterDropdownGroup 
              title="Industry" 
              categoryKey="industries" 
              options={dynamicIndustries} 
              icon={Briefcase}
              selectedList={filters.industries}
              onToggle={toggleFilter}
              onSelectAll={selectAllFilter}
              onClear={clearCategoryFilter}
            />

            {/* 3. PROJECT TYPE */}
            <FilterDropdownGroup 
              title="Project Type" 
              categoryKey="types" 
              options={dynamicTypes} 
              icon={Tag}
              selectedList={filters.types}
              onToggle={toggleFilter}
              onSelectAll={selectAllFilter}
              onClear={clearCategoryFilter}
            />

            {/* 4. GOAL */}
            <FilterDropdownGroup 
              title="Goal" 
              categoryKey="goals" 
              options={dynamicGoals} 
              icon={Target}
              selectedList={filters.goals}
              onToggle={toggleFilter}
              onSelectAll={selectAllFilter}
              onClear={clearCategoryFilter}
            />

            {/* 5. LOCATION */}
            <FilterDropdownGroup 
              title="Location" 
              categoryKey="locations" 
              options={dynamicLocations} 
              icon={MapPin}
              selectedList={filters.locations}
              onToggle={toggleFilter}
              onSelectAll={selectAllFilter}
              onClear={clearCategoryFilter}
            />

            {/* 6. SEASONAL */}
            <FilterDropdownGroup 
              title="Seasonal" 
              categoryKey="seasonals" 
              options={dynamicSeasonals} 
              icon={Calendar}
              selectedList={filters.seasonals}
              onToggle={toggleFilter}
              onSelectAll={selectAllFilter}
              onClear={clearCategoryFilter}
            />
          </div>
        </aside>

        {/* MAIN PROJECTS SECTION */}
        <section className="flex-1 min-w-0">
          <div className="bg-white border-2 border-black rounded-lg p-4 mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="w-full md:w-96">
              <label className="block text-[11px] font-black uppercase tracking-wider text-black mb-1 flex items-center gap-1.5">
                <Search size={13} className="text-yellow-500" /> Search Project Types & Keywords
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 text-neutral-400" size={15} />
                <input 
                  type="text"
                  placeholder="Type any keyword to match title, industry, description, or type..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 text-xs font-semibold border-2 border-neutral-300 rounded focus:border-black focus:outline-none transition-all placeholder:text-neutral-400"
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
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end self-end md:self-center">
              <span className="text-xs font-black uppercase tracking-wider text-neutral-600">
                Showing <span className="text-black font-extrabold text-sm">{filteredProjects.length}</span> of {projects.length} Projects
              </span>
              {activeFilterCount > 0 && (
                <span className="bg-yellow-400 text-black text-[11px] font-black px-2 py-0.5 rounded-full border border-black">
                  {activeFilterCount} Filter{activeFilterCount > 1 ? 's' : ''} Active
                </span>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="bg-white border-2 border-black rounded-lg p-12 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <Zap className="animate-bounce mx-auto text-yellow-400 mb-2" size={32} />
              <p className="text-sm font-bold uppercase tracking-wider">Connecting to Cloud Database...</p>
            </div>
          ) : projects.length === 0 ? (
            <div className="bg-white border-2 border-black rounded-lg p-12 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="bg-yellow-400 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 border-2 border-black">
                <Zap size={22} className="text-black" fill="black" />
              </div>
              <h3 className="text-base font-black uppercase tracking-wider text-black mb-1">Your Shared Catalog is Empty</h3>
              <p className="text-xs text-neutral-500 max-w-sm mx-auto mb-5 font-medium">
                The cloud database is active! Click below to add the first project for your whole team to see.
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
              <h3 className="text-base font-black uppercase tracking-wider text-black mb-1">No Matching Projects</h3>
              <p className="text-xs text-neutral-500 max-w-sm mx-auto mb-4 font-medium">
                Try deselecting some filters or clearing your keyword search.
              </p>
              <button
                onClick={clearAllFilters}
                className="bg-black text-white text-xs font-black uppercase tracking-wider px-4 py-2 rounded border-2 border-yellow-400 hover:bg-neutral-900 transition-colors"
              >
                Reset All Filters & Search
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredProjects.map((project) => {
                const projectInds = toArray(project.industry);
                const projectLocs = toArray(project.location);
                const projectGoals = toArray(project.goal);
                const projectSeasons = toArray(project.seasonal);
                const projectTypes = toArray(project.type);
                const isCustom = typeof project.watts === 'string' && (project.watts.toLowerCase().includes('quote') || isNaN(Number(project.watts)));

                return (
                  <div 
                    key={project.id}
                    className="bg-white border-2 border-black rounded-lg flex flex-col justify-between p-5 hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_#FFD100]"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isCustom ? (
                            <span className="bg-amber-400 text-black text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded flex items-center gap-1.5 shadow-sm border border-black">
                              <Zap size={14} fill="currentColor" />
                              Custom Quote
                            </span>
                          ) : (
                            <span className="bg-black text-yellow-400 text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded flex items-center gap-1.5 shadow-sm">
                              <Zap size={14} fill="#FFD100" />
                              {project.watts} Watts
                            </span>
                          )}

                          {projectInds.map(ind => (
                            <span key={ind} className="text-[11px] font-black uppercase tracking-wider bg-yellow-400 text-black px-2 py-0.5 rounded border border-black">
                              {ind}
                            </span>
                          ))}

                          {projectTypes.map(t => (
                            <span key={t} className="text-[11px] font-black uppercase tracking-wider bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded border border-neutral-300">
                              {t}
                            </span>
                          ))}
                        </div>

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

                      <h3 className="text-base font-black text-black leading-snug mb-2 uppercase tracking-tight">
                        {project.name}
                      </h3>

                      <p className="text-xs font-medium text-neutral-600 line-clamp-3 mb-4 leading-relaxed">
                        {project.description || "No project description provided."}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-neutral-200">
                      <div className="flex flex-wrap gap-1.5">
                        {projectLocs.map(loc => (
                          <span key={loc} className="inline-flex items-center gap-1 text-[10px] font-bold uppercase bg-yellow-100 text-yellow-900 px-2 py-0.5 rounded border border-yellow-300">
                            <MapPin size={10} /> {loc}
                          </span>
                        ))}
                        {projectGoals.map(g => (
                          <span key={g} className="inline-flex items-center gap-1 text-[10px] font-bold uppercase bg-neutral-100 text-neutral-800 px-2 py-0.5 rounded border border-neutral-300">
                            <Target size={10} /> {g}
                          </span>
                        ))}
                        {projectSeasons.map(s => (
                          <span key={s} className="inline-flex items-center gap-1 text-[10px] font-bold uppercase bg-neutral-100 text-neutral-800 px-2 py-0.5 rounded border border-neutral-300">
                            <Calendar size={10} /> {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* ADD / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-white border-4 border-black rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto shadow-[8px_8px_0px_0px_#FFD100]">
            <div className="flex justify-between items-center pb-4 mb-4 border-b-2 border-black">
              <div className="flex items-center gap-2">
                <div className="bg-yellow-400 p-1.5 rounded border-2 border-black">
                  {editingProjectId ? <Pencil size={20} className="text-black" /> : <Zap size={20} className="text-black" fill="black" />}
                </div>
                <h2 className="text-lg font-black uppercase text-black tracking-tight">
                  {editingProjectId ? 'Edit Project' : 'Add Project to Catalog'}
                </h2>
              </div>
              <button 
                onClick={() => { setIsModalOpen(false); setEditingProjectId(null); }}
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
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-black uppercase tracking-wider text-black">
                      Watts *
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formData.isCustomQuote}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          isCustomQuote: e.target.checked,
                          watts: e.target.checked ? '' : formData.watts
                        })}
                        className="rounded border-neutral-400 text-yellow-400 focus:ring-0 w-3.5 h-3.5"
                      />
                      <span className="text-[11px] font-black uppercase text-amber-700">Custom Quote</span>
                    </label>
                  </div>

                  {formData.isCustomQuote ? (
                    <div className="w-full px-3 py-2 text-xs font-black text-amber-800 bg-amber-100 border-2 border-amber-400 rounded flex items-center justify-center uppercase tracking-wide">
                      Custom Quote Selected
                    </div>
                  ) : (
                    <input
                      type="number"
                      required={!formData.isCustomQuote}
                      min="1"
                      placeholder="e.g., 45"
                      className="w-full px-3 py-2 text-xs font-semibold border-2 border-neutral-300 rounded focus:border-black focus:outline-none"
                      value={formData.watts}
                      onChange={(e) => setFormData({ ...formData, watts: e.target.value })}
                    />
                  )}
                </div>
              </div>

              {/* Short Description */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider mb-1 text-black">
                  Short Description (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Outline who this targets, key deliverables, and campaign intent..."
                  className="w-full px-3 py-2 text-xs font-semibold border-2 border-neutral-300 rounded focus:border-black focus:outline-none"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              {/* COLLAPSIBLE REGION KEY: POSITIONED DIRECTLY BELOW DESCRIPTION & ABOVE FILTERS */}
              <div className="border-2 border-black rounded-lg overflow-hidden bg-neutral-900 shadow-sm">
                <button
                  type="button"
                  onClick={() => setIsModalRegionKeyOpen(!isModalRegionKeyOpen)}
                  className="w-full px-3 py-2 text-left flex items-center justify-between bg-black hover:bg-neutral-900 transition-colors select-none"
                >
                  <div className="flex items-center gap-1.5 text-[11px] font-black uppercase text-yellow-400 tracking-wider">
                    <Map size={13} className="text-yellow-400" />
                    <span>Region Key Reference (Need to check state locations?)</span>
                  </div>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-neutral-800 text-yellow-400 border border-neutral-700 flex items-center gap-1">
                    {isModalRegionKeyOpen ? 'Hide' : 'View'}
                    {isModalRegionKeyOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </span>
                </button>

                {isModalRegionKeyOpen && (
                  <div className="p-3 border-t-2 border-yellow-400 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] bg-neutral-950">
                    {REGION_KEY_DATA.map(item => (
                      <div key={item.region} className="bg-neutral-900 p-2 rounded border border-neutral-800">
                        <span className="font-black uppercase text-yellow-400 block mb-0.5">
                          {item.region}:
                        </span>
                        <span className="text-neutral-300 font-medium leading-relaxed">
                          {item.desc}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* FILTERS BEGIN HERE */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <MultiSelectDropdown
                  label="Industry"
                  options={dynamicIndustries}
                  selected={formData.industries}
                  onChange={(items) => setFormData({ ...formData, industries: items })}
                  onCustomAdd={(val) => saveCustomTagToCloud('industries', val)}
                  icon={Briefcase}
                  placeholder="Select one or more industries..."
                />

                <MultiSelectDropdown
                  label="Locations / Regions"
                  options={dynamicLocations}
                  selected={formData.locations}
                  onChange={(items) => setFormData({ ...formData, locations: items })}
                  onCustomAdd={(val) => saveCustomTagToCloud('locations', val)}
                  icon={MapPin}
                  placeholder="Select one or more regions..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <MultiSelectDropdown
                  label="Goals"
                  options={dynamicGoals}
                  selected={formData.goals}
                  onChange={(items) => setFormData({ ...formData, goals: items })}
                  onCustomAdd={(val) => saveCustomTagToCloud('goals', val)}
                  icon={Target}
                  placeholder="Select one or more goals..."
                />

                <MultiSelectDropdown
                  label="Seasonals"
                  options={dynamicSeasonals}
                  selected={formData.seasonals}
                  onChange={(items) => setFormData({ ...formData, seasonals: items })}
                  onCustomAdd={(val) => saveCustomTagToCloud('seasonals', val)}
                  icon={Calendar}
                  placeholder="Select one or more seasons..."
                />
              </div>

              <div>
                <MultiSelectDropdown
                  label="Project Types"
                  options={dynamicTypes}
                  selected={formData.types}
                  onChange={(items) => setFormData({ ...formData, types: items })}
                  onCustomAdd={(val) => saveCustomTagToCloud('types', val)}
                  icon={Tag}
                  placeholder="Select one or more types..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t-2 border-black">
                <button
                  type="button"
                  onClick={() => { setIsModalOpen(false); setEditingProjectId(null); }}
                  className="px-4 py-2 text-xs font-black uppercase tracking-wider text-black bg-neutral-200 hover:bg-neutral-300 rounded border-2 border-black transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-black uppercase tracking-wider text-black bg-yellow-400 hover:bg-yellow-500 rounded border-2 border-black shadow-[3px_3px_0px_0px_#000000] hover:shadow-[1px_1px_0px_0px_#000000] transition-all flex items-center gap-1.5"
                >
                  <Plus size={16} strokeWidth={3} />
                  {editingProjectId ? 'Save Changes' : 'Add to Catalog'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
