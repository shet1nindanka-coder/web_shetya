import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";

const scoreTable = [
  [1, 6], [2, 11], [3, 17], [4, 22], [5, 27], [6, 34], [7, 40], [8, 46],
  [9, 52], [10, 58], [11, 64], [12, 70], [13, 72], [14, 74], [15, 76], [16, 78],
  [17, 80], [18, 82], [19, 84], [20, 86], [21, 88], [22, 90], [23, 92], [24, 94],
  [25, 95], [26, 96], [27, 97], [28, 98], [29, 99], [30, 100], [31, 100], [32, 100]
] as const;

const taskScoring = [
  "№ 1-12 оцениваются в 1 первичный балл.",
  "№ 13, 15, 16 оцениваются в 2 первичных балла.",
  "№ 14 и 17 оцениваются в 3 первичных балла.",
  "№ 18 и 19 оцениваются в 4 первичных балла каждая."
];

export default function StudentInfoPage() {
  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        eyebrow="Общая инфа"
        title="Баллы и разбалловка"
      />

      <SectionCard title="Соответствие баллов">
        <div className="ui-table-shell">
          <div className="ui-table-head grid grid-cols-2 text-xs font-semibold text-[var(--theme-text-default)] sm:text-sm">
            <div className="ui-table-cell">Первичный балл</div>
            <div className="ui-table-cell border-l border-[var(--theme-border-soft)]">Тестовый балл</div>
          </div>
          <div>
            {scoreTable.map(([primary, test]) => (
              <div key={primary} className="ui-table-row grid grid-cols-2 text-xs sm:text-sm">
                <div className="ui-table-cell font-semibold text-[var(--theme-text-strong)]">{primary}</div>
                <div className="ui-table-cell border-l border-[var(--theme-border-soft)]">{test}</div>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Разбалловка номеров ЕГЭ">
        <div className="grid gap-2.5 sm:gap-3 md:grid-cols-2">
          {taskScoring.map((item) => (
            <article key={item} className="ui-mini-stat-card">
              <p className="text-sm leading-relaxed text-[var(--theme-text-default)]">{item}</p>
            </article>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
