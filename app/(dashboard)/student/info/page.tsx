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
    <div className="space-y-8">
      <PageHeader
        eyebrow="Общая инфа"
        title="Баллы и разбалловка"
        description="Краткая справка по первичным и тестовым баллам ЕГЭ."
        metrics={[
          { label: "Максимум", value: "32 первичных" },
          { label: "100 тестовых", value: "от 30", tone: "accent" }
        ]}
        aside={
          <div className="ui-page-header-panel rounded-[18px] p-4 sm:p-5">
            <p className="ui-kicker">Коротко</p>
            <p className="mt-2 font-display text-[1.7rem] font-semibold text-[var(--theme-text-strong)]">30+ = 100</p>
            <p className="mt-2 text-sm leading-6 text-[var(--theme-text-muted)]">Начиная с 30 первичных баллов тестовый результат уже равен 100.</p>
          </div>
        }
      />

      <SectionCard title="Соответствие баллов">
        <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white">
          <div className="grid grid-cols-2 border-b border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700">
            <div className="px-4 py-3 sm:px-5">Первичный балл</div>
            <div className="border-l border-slate-200 px-4 py-3 sm:px-5">Тестовый балл</div>
          </div>
          <div className="divide-y divide-slate-200">
            {scoreTable.map(([primary, test]) => (
              <div key={primary} className="grid grid-cols-2 text-sm text-slate-700 odd:bg-white even:bg-slate-50/60">
                <div className="px-4 py-3 font-semibold text-slate-950 sm:px-5">{primary}</div>
                <div className="border-l border-slate-100 px-4 py-3 sm:px-5">{test}</div>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Разбалловка номеров ЕГЭ">
        <div className="grid gap-3 md:grid-cols-2">
          {taskScoring.map((item) => (
            <article key={item} className="ui-mini-stat-card">
              <p className="text-sm leading-6 text-slate-700 sm:text-[0.95rem]">{item}</p>
            </article>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
