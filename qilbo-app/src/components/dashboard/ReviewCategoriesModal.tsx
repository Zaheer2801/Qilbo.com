import { useState, useEffect, useMemo } from 'react';
import { Check, X, Sparkles, CheckCheck, RefreshCw, ChevronRight } from 'lucide-react';

export interface CategorySuggestion {
  product_id: number;
  name: string;
  clean_name?: string;
  size?: string;
  department?: string;
  current_category: string;
  current_sub_category: string;
  suggested_category: string;
  suggested_sub_category: string;
  suggested_brand?: string;
  confidence: number;
  reason?: string;
  source?: string;
  status?: string;
}

const TAXONOMY: Record<string, string[]> = {
  'Spirits': ['Vodka', 'Tequila/Mezcal', 'Whiskey', 'Cognac/Brandy', 'Rum', 'Gin', 'Liqueur', 'Other Spirits – review'],
  'Beer & RTD': ['Beer', 'RTD/Seltzer'],
  'Wine': ['Wine'],
  'Drinks & Mixers': ['Drinks & Mixers'],
  'Snacks & Grocery': ['Snacks & Grocery'],
  'Tobacco': ['Cigarettes', 'Cigars/Cigarillos', 'Vapes', 'Accessories'],
  'Lottery': ['Lottery']
};

export default function ReviewCategoriesModal({
  isOpen,
  onClose,
  onApplied
}: {
  isOpen: boolean;
  onClose: () => void;
  onApplied?: () => void;
}) {
  const [suggestions, setSuggestions] = useState<CategorySuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');
  const [confidenceFilter, setConfidenceFilter] = useState<'all' | 'high' | 'review'>('all');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [message, setMessage] = useState<string | null>(null);

  // Custom user edits: product_id -> { category, sub_category, brand }
  const [edits, setEdits] = useState<Record<number, { category: string; sub_category: string; brand: string }>>({});

  useEffect(() => {
    if (isOpen) {
      loadSuggestions();
    }
  }, [isOpen]);

  async function loadSuggestions() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/categories/suggestions');
      if (res.ok) {
        const data = await res.json();
        const list: CategorySuggestion[] = data.suggestions || [];
        setSuggestions(list);

        // Pre-check high confidence (>= 0.90) by default as required
        const prechecked = new Set<number>();
        for (const item of list) {
          if (item.confidence >= 0.90) {
            prechecked.add(item.product_id);
          }
        }
        setSelectedIds(prechecked);
      }
    } catch (err) {
      console.error('Failed to load category suggestions', err);
    } finally {
      setLoading(false);
    }
  }

  function handleEditChange(productId: number, field: 'category' | 'sub_category' | 'brand', value: string) {
    const orig = suggestions.find(s => s.product_id === productId);
    if (!orig) return;

    setEdits(prev => {
      const current = prev[productId] || {
        category: orig.suggested_category,
        sub_category: orig.suggested_sub_category,
        brand: orig.suggested_brand || ''
      };

      if (field === 'category') {
        const defaultSub = TAXONOMY[value]?.[0] || value;
        return {
          ...prev,
          [productId]: { ...current, category: value, sub_category: defaultSub }
        };
      }
      return {
        ...prev,
        [productId]: { ...current, [field]: value }
      };
    });
  }

  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(filtered.map(s => s.product_id)));
  }

  function deselectAll() {
    setSelectedIds(new Set());
  }

  function selectAllHighConf() {
    setSelectedIds(new Set(suggestions.filter(s => s.confidence >= 0.90).map(s => s.product_id)));
  }

  async function applySelected(idsToApply?: number[]) {
    const targetIds = idsToApply || Array.from(selectedIds);
    if (!targetIds.length) return;

    setSubmitting(true);
    setMessage(null);

    const items = targetIds.map(id => {
      const orig = suggestions.find(s => s.product_id === id)!;
      const edit = edits[id];
      return {
        product_id: id,
        category: edit?.category || orig.suggested_category,
        sub_category: edit?.sub_category || orig.suggested_sub_category,
        brand: edit?.brand || orig.suggested_brand || ''
      };
    });

    try {
      const res = await fetch('/api/categories/apply', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items })
      });

      if (res.ok) {
        const appliedSet = new Set(targetIds);
        setSuggestions(prev => prev.filter(s => !appliedSet.has(s.product_id)));
        setSelectedIds(prev => {
          const next = new Set(prev);
          targetIds.forEach(id => next.delete(id));
          return next;
        });
        setMessage(`Successfully applied ${targetIds.length} category classifications!`);
        if (onApplied) onApplied();
      } else {
        setMessage('Error applying changes. Please try again.');
      }
    } catch (err) {
      console.error(err);
      setMessage('Network error while saving changes.');
    } finally {
      setSubmitting(false);
    }
  }

  const filtered = useMemo(() => {
    return suggestions.filter(s => {
      if (confidenceFilter === 'high' && s.confidence < 0.90) return false;
      if (confidenceFilter === 'review' && s.confidence >= 0.90) return false;

      const edit = edits[s.product_id];
      const cat = edit?.category || s.suggested_category;
      if (groupFilter !== 'all' && cat !== groupFilter) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const text = `${s.name} ${s.suggested_brand || ''} ${s.suggested_category} ${s.suggested_sub_category}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [suggestions, confidenceFilter, groupFilter, search, edits]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 dark:text-white">Review Category Suggestions</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                  {suggestions.length} pending
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                AI and brand-matching categorizations for items previously in &quot;Other Spirits – review&quot;. High confidence (&ge;90%) are pre-checked.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message Banner */}
        {message && (
          <div className="px-6 py-2.5 bg-blue-50 dark:bg-blue-950/60 border-b border-blue-100 dark:border-blue-900/50 text-blue-800 dark:text-blue-200 text-xs font-semibold flex items-center justify-between">
            <span>{message}</span>
            <button onClick={() => setMessage(null)} className="text-blue-500 hover:text-blue-800">×</button>
          </div>
        )}

        {/* Toolbar & Filters */}
        <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap gap-3 items-center justify-between text-xs">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
            <input
              type="text"
              placeholder="Filter by name, brand, category..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs w-56 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />

            <select
              value={confidenceFilter}
              onChange={e => setConfidenceFilter(e.target.value as any)}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium"
            >
              <option value="all">All Confidence</option>
              <option value="high">High (&ge; 90%)</option>
              <option value="review">Review Needed (&lt; 90%)</option>
            </select>

            <select
              value={groupFilter}
              onChange={e => setGroupFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium"
            >
              <option value="all">All Groups</option>
              {Object.keys(TAXONOMY).map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={selectAllHighConf}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold rounded-xl text-slate-700 dark:text-slate-300 transition flex items-center gap-1"
            >
              <CheckCheck className="w-3.5 h-3.5 text-blue-600" /> Pre-check High (&ge;90%)
            </button>
            <button
              onClick={selectAll}
              className="px-2.5 py-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              Select All
            </button>
            <button
              onClick={deselectAll}
              className="px-2.5 py-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Content Table / List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
              <span className="text-xs font-medium">Loading category suggestions...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              No suggestions found matching the current filters.
            </div>
          ) : (
            filtered.map(item => {
              const edit = edits[item.product_id];
              const curGroup = edit?.category || item.suggested_category;
              const curSub = edit?.sub_category || item.suggested_sub_category;
              const curBrand = edit?.brand ?? (item.suggested_brand || '');
              const isChecked = selectedIds.has(item.product_id);
              const isHigh = item.confidence >= 0.90;

              return (
                <div
                  key={item.product_id}
                  className={`p-3.5 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isChecked
                      ? 'bg-blue-50/40 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900'
                      : 'bg-white dark:bg-slate-800/60 border-slate-200/70 dark:border-slate-800'
                  }`}
                >
                  {/* Left: Checkbox & Product Details */}
                  <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleSelect(item.product_id)}
                      className="mt-1 sm:mt-0 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white text-xs truncate">
                          {item.name}
                        </span>
                        {item.size && (
                          <span className="px-1.5 py-0.2 bg-slate-100 dark:bg-slate-800 text-[10px] font-mono text-slate-500 rounded">
                            {item.size}
                          </span>
                        )}
                        <span className={`px-2 py-0.2 rounded-full text-[10px] font-extrabold ${
                          isHigh
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                            : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                        }`}>
                          {(item.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span className="text-slate-400 line-through">Other Spirits – review</span>
                        <ChevronRight className="w-3 h-3 text-slate-400" />
                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                          {item.source === 'brand_match' ? 'Brand Match' : 'Gemini AI'}: {item.reason || 'Classification'}
                          {curBrand ? ` • Brand: ${curBrand}` : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Middle: Category & Subcategory Selectors (Allows Change) */}
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={curGroup}
                      onChange={e => handleEditChange(item.product_id, 'category', e.target.value)}
                      className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200"
                    >
                      {Object.keys(TAXONOMY).map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>

                    <select
                      value={curSub}
                      onChange={e => handleEditChange(item.product_id, 'sub_category', e.target.value)}
                      className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-300"
                    >
                      {(TAXONOMY[curGroup] || [curSub]).map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>

                    {/* Single Approve Button */}
                    <button
                      onClick={() => applySelected([item.product_id])}
                      disabled={submitting}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shrink-0"
                    >
                      <Check className="w-3.5 h-3.5" /> Approve
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            <span className="font-bold text-slate-900 dark:text-white">{selectedIds.size}</span> of {suggestions.length} items selected
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 font-bold rounded-xl text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Close
            </button>
            <button
              onClick={() => applySelected()}
              disabled={submitting || selectedIds.size === 0}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-extrabold rounded-xl text-xs transition flex items-center gap-1.5 shadow-sm"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Applying...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Approve Selected ({selectedIds.size})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
