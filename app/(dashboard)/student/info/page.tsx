import { Badge } from "@/components/badge";
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
      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="page-header-panel rounded-[36px] border border-white/70 bg-slate-950 px-6 py-8 text-white shadow-glow">
          <Badge className="border-brand-300/40 bg-white/10 text-brand-100">Общая инфа</Badge>
          <h1 className="font-display mt-4 text-4xl font-semibold">Шкала баллов и разбалловка ЕГЭ по математике</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
            Здесь собрана быстрая справка, чтобы сразу понимать, во что переводятся первичные баллы и сколько дают
            конкретные задания на экзамене.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Badge className="border-white/15 bg-white/10 text-slate-100">Первичные и тестовые</Badge>
            <Badge className="border-white/15 bg-white/10 text-slate-100">Разбалловка номеров</Badge>
            <Badge className="border-white/15 bg-white/10 text-slate-100">Быстрая справка</Badge>
          </div>
        </div>

        <div className="rounded-[36px] border border-brand-100 bg-white/90 p-6 shadow-glow">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Коротко</p>
          <p className="mt-4 text-3xl font-semibold text-slate-950">Максимум — 32 первичных балла</p>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Начиная с 30 первичных баллов тестовый результат уже равен 100. Используйте эту вкладку как быструю
            опору во время подготовки.
          </p>
        </div>
      </section>

      <SectionCard
        title="Соответствие баллов"
        description="Таблица перевода первичных баллов в тестовые."
      >
        <div className="overflow-hidden rounded-[28px] border border-slate-200">
          <div className="grid grid-cols-2 bg-slate-950 text-sm font-semibold uppercase tracking-[0.18em] text-white">
            <div className="px-5 py-4">Первичный балл</div>
            <div className="border-l border-white/10 px-5 py-4">Тестовый балл</div>
          </div>
          <div className="divide-y divide-slate-200 bg-white">
            {scoreTable.map(([primary, test]) => (
              <div key={primary} className="grid grid-cols-2 text-sm text-slate-700">
                <div className="px-5 py-3 font-semibold text-slate-950">{primary}</div>
                <div className="border-l border-slate-100 px-5 py-3">{test}</div>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Разбалловка номеров ЕГЭ"
        description="Сколько первичных баллов дают разные задания профильной математики."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {taskScoring.map((item) => (
            <article key={item} className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-5">
              <p className="text-base leading-7 text-slate-700">{item}</p>
            </article>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
