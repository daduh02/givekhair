"use client";

import { useEffect, useMemo, useState } from "react";
import { AppealCard, type AppealCardAppeal } from "@/components/appeal/AppealCard";

type TrendingAppeal = AppealCardAppeal & { raisedAmount: number };

function getCardsPerPage(width: number) {
  if (width >= 1440) {
    return 6;
  }

  if (width >= 1024) {
    return 4;
  }

  if (width >= 640) {
    return 2;
  }

  return 1;
}

export function TrendingAppealsPager({ appeals }: { appeals: TrendingAppeal[] }) {
  const [pageIndex, setPageIndex] = useState(0);
  const [cardsPerPage, setCardsPerPage] = useState(6);

  useEffect(() => {
    function syncLayout() {
      setCardsPerPage(getCardsPerPage(window.innerWidth));
    }

    syncLayout();
    window.addEventListener("resize", syncLayout);
    return () => window.removeEventListener("resize", syncLayout);
  }, []);

  const pages = useMemo(() => {
    const chunks: TrendingAppeal[][] = [];

    for (let index = 0; index < appeals.length; index += cardsPerPage) {
      chunks.push(appeals.slice(index, index + cardsPerPage));
    }

    return chunks.length > 0 ? chunks : [appeals];
  }, [appeals, cardsPerPage]);

  useEffect(() => {
    setPageIndex((current) => Math.min(current, pages.length - 1));
  }, [pages.length]);

  const canGoPrevious = pageIndex > 0;
  const canGoNext = pageIndex < pages.length - 1;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-[color:var(--color-ink-muted)]">
          {appeals.length} appeal{appeals.length === 1 ? "" : "s"} available
        </p>
        <div className="flex items-center gap-3">
          <span className="text-sm text-[color:var(--color-ink-soft)]">
            Page {Math.min(pageIndex + 1, pages.length)} of {pages.length}
          </span>
          <button
            type="button"
            className="btn-outline"
            style={{ paddingInline: "0.95rem", paddingBlock: "0.6rem", fontSize: "0.82rem", opacity: canGoPrevious ? 1 : 0.45 }}
            aria-label="Show previous appeals"
            onClick={() => setPageIndex((current) => Math.max(current - 1, 0))}
            disabled={!canGoPrevious}
          >
            Previous
          </button>
          <button
            type="button"
            className="btn-outline"
            style={{ paddingInline: "0.95rem", paddingBlock: "0.6rem", fontSize: "0.82rem", opacity: canGoNext ? 1 : 0.45 }}
            aria-label="Show next appeals"
            onClick={() => setPageIndex((current) => Math.min(current + 1, pages.length - 1))}
            disabled={!canGoNext}
          >
            Next
          </button>
        </div>
      </div>

      <div className="overflow-hidden">
        {/* Each page is rendered as a full-width slide so we can page through
            grouped cards client-side without changing routes or restyling cards. */}
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${pageIndex * 100}%)` }}
        >
          {pages.map((page, index) => (
            <div key={`page-${index}`} className="min-w-full">
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {page.map((appeal) => (
                  <AppealCard key={appeal.id} appeal={appeal} raisedAmount={appeal.raisedAmount} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
