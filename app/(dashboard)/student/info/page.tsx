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
        description="Краткая справка по первичным и тестовым баллам ЕГЭ."
        metrics={[
          { label: "Максимум", value: "32 первичных" },
          { label: "100 тестовых", value: "от 30", tone: "accent" }
        ]}
        aside={
          <div className="ui-page-header-panel rounded-[14px] p-3.5 sm:rounded-[16px] sm:p-4">
            <p className="ui-kicker">Коротко</p>
            <p className="mt-1.5 font-display text-[1.3rem] font-semibold text-[var(--theme-text-strong)] sm:text-[1.5rem]">30+ = 100</p>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--theme-text-muted)]">Начиная с 30 первичных баллов тестовый результат уже равен 100.</p>
          </div>
        }
      />

      <SectionCard title="Соответствие баллов">
        <div className="overflow-hidden rounded-[12px] border border-slate-200 bg-white sm:rounded-[16px]">
          <div className="grid grid-cols-2 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 sm:text-sm">
            <div className="px-3 py-2.5 sm:px-4 sm:py-3">Первичный балл</div>
            <div className="border-l border-slate-200 px-3 py-2.5 sm:px-4 sm:py-3">Тестовый балл</div>
          </div>
          <div className="divide-y divide-slate-200">
            {scoreTable.map(([primary, test]) => (
              <div key={primary} className="grid grid-cols-2 text-xs text-slate-700 odd:bg-white even:bg-slate-50/60 sm:text-sm">
                <div className="px-3 py-2 font-semibold text-slate-950 sm:px-4 sm:py-2.5">{primary}</div>
                <div className="border-l border-slate-100 px-3 py-2 sm:px-4 sm:py-2.5">{test}</div>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Разбалловка номеров ЕГЭ">
        <div className="grid gap-2.5 sm:gap-3 md:grid-cols-2">
          {taskScoring.map((item) => (
            <article key={item} className="ui-mini-stat-card">
              <p className="text-sm leading-relaxed text-slate-700">{item}</p>
            </article>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
