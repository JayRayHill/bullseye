// Native range input gives us free keyboard support and the right semantics.
// `aria-valuetext` is what assistive tech speaks — without it, screen readers
// announce a bare number, which is uninformative ("50" vs "50 miles").

import { useFilters } from '../../context/FiltersContext';

export function RadiusSlider() {
  const { filters, setRadiusMiles } = useFilters();
  return (
    <label className="flex items-center gap-3 text-sm text-slate-800">
      <span className="whitespace-nowrap">
        Radius: <span className="font-semibold">{filters.radiusMiles} mi</span>
      </span>
      <input
        type="range"
        min={10}
        max={200}
        step={5}
        value={filters.radiusMiles}
        onChange={(e) => setRadiusMiles(Number(e.target.value))}
        aria-valuetext={`${filters.radiusMiles} miles`}
        className="h-2 w-44 cursor-pointer appearance-none rounded-full bg-slate-200 accent-blue-600"
      />
    </label>
  );
}
