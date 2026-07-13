import { ShbzNumberSearch } from "@/components/shbz-number-search";
import { ShbzPageHeader } from "@/components/shbz-page-header";

const scoreTable = [
  [1, 6], [2, 11], [3, 17], [4, 22], [5, 27], [6, 34], [7, 40], [8, 46],
  [9, 52], [10, 58], [11, 64], [12, 70], [13, 72], [14, 74], [15, 76], [16, 78],
  [17, 80], [18, 82], [19, 84], [20, 86], [21, 88], [22, 90], [23, 92], [24, 94],
  [25, 95], [26, 96], [27, 97], [28, 98], [29, 99], [30, 100], [31, 100], [32, 100]
] as const;

const taskScoring = [
  { badge: "1", text: "№ 1–12 оцениваются в 1 первичный балл" },
  { badge: "2", text: "№ 13, 15, 16 оцениваются в 2 первичных балла" },
  { badge: "3", text: "№ 14 и 17 оцениваются в 3 первичных балла" },
  { badge: "4", text: "№ 18 и 19 оцениваются в 4 первичных балла каждая" }
];

export default function StudentInfoPage() {
  return (
    <div>
      <ShbzPageHeader kicker="Общая инфа" title="Баллы и разбалловка" aside={<ShbzNumberSearch endpoint="/api/student/homeworks/find-number" />} />

      <section className="mb-11">
        <h2 className="shbz-section-title">Соответствие баллов</h2>
        <div className="shbz-card shbz-section-pad">
          <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))" }}>
            {scoreTable.map(([primary, test]) => (
              <div
                key={primary}
                className="flex items-center justify-center gap-2 rounded-[16px] border px-3.5 py-3"
                style={{ background: "var(--shbz-soft-bg)", borderColor: "var(--shbz-soft-border)" }}
              >
                <span className="text-sm font-bold" style={{ color: "var(--shbz-kicker)" }}>
                  {primary}
                </span>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--shbz-week-dot-off)"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
                <span className="text-[17px] font-extrabold" style={{ color: "var(--shbz-text-strong)" }}>
                  {test}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <h2 className="shbz-section-title">Разбалловка номеров ЕГЭ</h2>
        <div className="shbz-card shbz-section-pad">
          <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
            {taskScoring.map((item) => (
              <div
                key={item.badge}
                className="flex items-center gap-3.5 rounded-[16px] border px-5 py-[18px]"
                style={{ background: "var(--shbz-soft-bg)", borderColor: "var(--shbz-soft-border)" }}
              >
                <span
                  className="min-w-[44px] shrink-0 rounded-[8px] px-3 py-[7px] text-center text-[13px] font-extrabold text-white"
                  style={{ background: "var(--shbz-accent-grad)" }}
                >
                  {item.badge}
                </span>
                <span className="text-[15px] font-semibold" style={{ color: "var(--shbz-text-strong)" }}>
                  {item.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
