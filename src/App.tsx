import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Plus, Filter, Zap, Map, X, Search, Activity, Tag, Calendar, MapPin, Target, RotateCcw, Download, Pencil, Trash2 } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description: string;
  watts: number;
  location: string;
  goal: string;
  seasonal: string;
  type: string;
  createdAt?: any;
  authorId?: string;
}

interface FilterState {
  wattsRanges: string[];
  locations: string[];
  goals: string[];
  seasonals: string[];
  types: string[];
}

const WATTS_RANGES = ['Under 25', '25-50', 'Over 50'];
const DEFAULT_LOCATIONS = ['Northeast', 'Midwest', 'South', 'West'];
const DEFAULT_GOALS = ['Recruitment', 'Company Culture', 'Brand Awareness', 'New Customers', 'Existing Customers', 'Events'];
const DEFAULT_SEASONALS = ['General Holiday', 'Fall', 'Winter', 'Spring', 'Summer'];
const DEFAULT_TYPES = ['Collateral', 'OOH', 'Apparel', 'Vehicle', 'Digital/Social Marketing', 'Print Marketing'];

const REGION_KEY_DATA = [
  { region: 'Northeast', desc: 'New England (CT, ME, MA, NH, RI, VT) & Middle Atlantic (NJ, NY, PA).' },
  { region: 'Midwest', desc: 'East North Central (IL, IN, MI, OH, WI) & West North Central (IA, KS, MN, MO, NE, ND, SD).' },
  { region: 'South', desc: 'South Atlantic (DE, DC, FL, GA, MD, NC, SC, VA, WV), East South Central (AL, KY, MS, TN) & West South Central (AR, LA, OK, TX).' },
  { region: 'West', desc: 'Mountain (AZ, CO, ID, MT, NV, NM, UT, WY) & Pacific (AK, CA, HI, OR, WA).' }
];

// ============================================================================
// 🔥 FIREBASE SETUP
// ============================================================================
const firebaseConfig = {
  apiKey: "AIzaSyD5DXCgPr59ZJ_2KtvdeIu-B36LoKTeQyE",
  authDomain: "watts-library-tracker.firebaseapp.com",
  projectId: "watts-library-tracker",
  storageBucket: "watts-library-tracker.firebasestorage.app",
  messagingSenderId: "516069496416",
  appId: "1:516069496416:web:6b779b69566c1da8fcd505"
};

let db: any = null;
let auth: any = null;

try {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
} catch (e) {
  console.warn("Running in local storage fallback mode:", e);
}

const getWattsRange = (watts: number | string): string => {
  const w = Number(watts);
  if (isNaN(w) || w < 25) return 'Under 25';
  if (w >= 25 && w <= 50) return '25-50';
  return 'Over 50';
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState<boolean>(false);
  
  const [filters, setFilters] = useState<FilterState>({
    wattsRanges: [],
    locations: [],
    goals: [],
    seasonals: [],
    types: []
  });

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    watts: '',
    location: DEFAULT_LOCATIONS[0],
    goal: DEFAULT_GOALS[0],
    seasonal: DEFAULT_SEASONALS[0],
    type: DEFAULT_TYPES[0]
  });

  const [customInputs, setCustomInputs] = useState({
    location: '',
    goal: '',
    seasonal: '',
    type: ''
  });

  // 1. Authenticate anonymously with Firebase
  useEffect(() => {
    if (!auth) {
      const saved = localStorage.getItem('wattslibrarytracker_local');
      setProjects(saved ? JSON.parse(saved) : []);
      setIsLoading(false);
      return;
    }

    signInAnonymously(auth).catch((err) => {
      console.error("Anonymous authentication error:", err);
    });

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  // 2. Real-time Firebase Sync across all team members
  useEffect(() => {
    if (!db || !user) return;

    const projectsRef = collection(db, 'projects');
    const unsubscribe = onSnapshot(projectsRef, (snapshot) => {
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
    }, (error) => {
      console.error("Error fetching projects from Firestore:", error);
      const saved = localStorage.getItem('wattslibrarytracker_local');
      setProjects(saved ? JSON.parse(saved) : []);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const dynamicLocations = useMemo(() => Array.from(new Set([...DEFAULT_LOCATIONS, ...projects.map(p => p.location).filter(Boolean)])), [projects]);
  const dynamicGoals = useMemo(() => Array.from(new Set([...DEFAULT_GOALS, ...projects.map(p => p.goal).filter(Boolean)])), [projects]);
  const dynamicSeasonals = useMemo(() => Array.from(new Set([...DEFAULT_SEASONALS, ...projects.map(p => p.seasonal).filter(Boolean)])), [projects]);
  const dynamicTypes = useMemo(() => Array.from(new Set([...DEFAULT_TYPES, ...projects.map(p => p.type).filter(Boolean)])), [projects]);

  const toggleFilter = (category: keyof FilterState, value: string) => {
    setFilters(prev => {
      const currentList = prev[category];
      if (currentList.includes(value)) {
        return { ...prev, [category]: currentList.filter(item => item !== value) };
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
      types: []
    });
    setSearchQuery('');
  };

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const pWattsRange = getWattsRange(p.watts);
      
      const matchWatts = filters.wattsRanges.length === 0 || filters.wattsRanges.includes(pWattsRange);
      const matchLocation = filters.locations.length === 0 || filters.locations.includes(p.location);
      const matchGoal = filters.goals.length === 0 || filters.goals.includes(p.goal);
      const matchSeasonal = filters.seasonals.length === 0 || filters.seasonals.includes(p.seasonal);
      const matchType = filters.types.length === 0 || filters.types.includes(p.type);

      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || (
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        (p.type && p.type.toLowerCase().includes(q)) ||
        (p.goal && p.goal.toLowerCase().includes(q)) ||
        (p.location && p.location.toLowerCase().includes(q))
      );

      return matchWatts && matchLocation && matchGoal && matchSeasonal && matchType && matchSearch;
    });
  }, [projects, filters, searchQuery]);

  const activeFilterCount = Object.values(filters).reduce((acc, arr) => acc + arr.length, 0);

  const handleOpenAddModal = () => {
    setEditingProjectId(null);
    setFormData({
      name: '',
      description: '',
      watts: '',
      location: DEFAULT_LOCATIONS[0],
      goal: DEFAULT_GOALS[0],
      seasonal: DEFAULT_SEASONALS[0],
      type: DEFAULT_TYPES[0]
    });
    setCustomInputs({ location: '', goal: '', seasonal: '', type: '' });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (project: Project) => {
    setEditingProjectId(project.id);
    setFormData({
      name: project.name || '',
      description: project.description || '',
      watts: String(project.watts || ''),
      location: project.location || DEFAULT_LOCATIONS[0],
      goal: project.goal || DEFAULT_GOALS[0],
      seasonal: project.seasonal || DEFAULT_SEASONALS[0],
      type: project.type || DEFAULT_TYPES[0]
    });
    setCustomInputs({ location: '', goal: '', seasonal: '', type: '' });
    setIsModalOpen(true);
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!window.confirm("Are you sure you want to delete this project?")) return;

    try {
      if (db && user) {
        await deleteDoc(doc(db, 'projects', projectId));
      } else {
        const updated = projects.filter(p => p.id !== projectId);
        setProjects(updated);
        localStorage.setItem('wattslibrarytracker_local', JSON.stringify(updated));
      }
    } catch (err) {
      console.error("Error deleting project:", err);
    }
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();

    const finalLocation = (formData.location === 'ADD_NEW' ? customInputs.location : formData.location).trim();
    const finalGoal = (formData.goal === 'ADD_NEW' ? customInputs.goal : formData.goal).trim();
    const finalSeasonal = (formData.seasonal === 'ADD_NEW' ? customInputs.seasonal : formData.seasonal).trim();
    const finalType = (formData.type === 'ADD_NEW' ? customInputs.type : formData.type).trim();

    if (!formData.name.trim() || !formData.watts || !finalLocation || !finalGoal || !finalSeasonal || !finalType) {
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
        if (db && user) {
          await updateDoc(doc(db, 'projects', editingProjectId), payload);
        } else {
          const updated = projects.map(p => p.id === editingProjectId ? { ...p, ...payload } : p);
          setProjects(updated);
          localStorage.setItem('wattslibrarytracker_local', JSON.stringify(updated));
        }
      } else {
        const newProject = {
          ...payload,
          createdAt: db ? serverTimestamp() : Date.now(),
          authorId: user ? user.uid : 'team-member'
        };

        if (db && user) {
          await addDoc(collection(db, 'projects'), newProject);
        } else {
          const updated = [{ ...newProject, id: 'local-' + Date.now() } as Project, ...projects];
          setProjects(updated);
          localStorage.setItem('wattslibrarytracker_local', JSON.stringify(updated));
        }
      }

      setIsModalOpen(false);
      setEditingProjectId(null);
    } catch (err) {
      console.error("Error saving project:", err);
    }
  };

  const exportToCSV = () => {
    if (projects.length === 0) return;
    const headers = ['Name', 'Watts', 'Location', 'Goal', 'Seasonal', 'Type', 'Description'];
    const rows = projects.map(p => [
      `"${(p.name \vert{}\vert{} '').replace(/"/g, '""')}"`, p.watts, `"${p.location || ''}"`,
      `"${p.goal \vert{}\vert{} ''}"`, `"${p.seasonal || ''}"`,
      `"${p.type \vert{}\vert{} ''}"`, `"${(p.description || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `wattslibrarytracker
