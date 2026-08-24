/*
 * Вкладки панели разработчика — общий список для клиентского таббара самой
 * панели и серверного таббара страницы журнала (/teacher/panel/journal):
 * журнал живёт на своём URL из-за фильтров и пагинации в адресе, но визуально
 * остаётся вкладкой той же панели.
 */

export type DeveloperPanelTab = "status" | "actions" | "broadcast" | "settings";

export const DEVELOPER_PANEL_TABS: Array<{ key: DeveloperPanelTab; label: string }> = [
  { key: "status", label: "Статус" },
  { key: "actions", label: "Действия" },
  { key: "broadcast", label: "Рассылка" },
  { key: "settings", label: "Настройки" }
];

export function parseDeveloperPanelTab(raw: string | undefined): DeveloperPanelTab {
  return DEVELOPER_PANEL_TABS.some((tab) => tab.key === raw) ? (raw as DeveloperPanelTab) : "status";
}
