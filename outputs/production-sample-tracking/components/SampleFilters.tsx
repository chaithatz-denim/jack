"use client";

import { Search } from "lucide-react";
import type { ChangeEvent } from "react";
import { LocalizedInput, LocalizedSelect } from "@/components/LocalizedSelect";

type FilterOption = {
  value: string;
  th: string;
  en: string;
};

type SampleFiltersProps = {
  query: string;
  status: string;
  priority: string;
  overdue: string;
  statusOptions: FilterOption[];
  priorityOptions: FilterOption[];
  overdueOptions: FilterOption[];
};

function submitFilterForm(form: HTMLFormElement) {
  if (typeof form.requestSubmit === "function") {
    form.requestSubmit();
    return;
  }
  form.submit();
}

export function SampleFilters({ query, status, priority, overdue, statusOptions, priorityOptions, overdueOptions }: SampleFiltersProps) {
  function handleFilterChange(event: ChangeEvent<HTMLFormElement>) {
    if (!(event.target instanceof HTMLSelectElement)) return;
    submitFilterForm(event.currentTarget);
  }

  return <form className="filters" action="/samples" method="get" onChange={handleFilterChange}>
    <div className="search-box">
      <button className="search-submit" type="submit" aria-label="Search samples"><Search size={22}/></button>
      <LocalizedInput
        id="sampleSearch"
        name="q"
        defaultValue={query}
        placeholderTh="ค้นหา"
        placeholderEn="Search"
        type="search"
        autoComplete="off"
        enterKeyHint="search"
      />
    </div>
    <LocalizedSelect className="select" name="status" defaultValue={status} options={statusOptions}/>
    <LocalizedSelect className="select" name="priority" defaultValue={priority} options={priorityOptions}/>
    <LocalizedSelect className="select" name="overdue" defaultValue={overdue} options={overdueOptions}/>
  </form>;
}
