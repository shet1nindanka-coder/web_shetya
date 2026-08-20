import { HomeworkNumberStatus } from "@prisma/client";
import { Badge } from "@/components/badge";
import { homeworkStatusGlyph, homeworkStatusMeta } from "@/lib/utils";

type HomeworkStatusBadgeProps = {
  status: HomeworkNumberStatus | null;
};

export function HomeworkStatusBadge({ status }: HomeworkStatusBadgeProps) {
  if (!status) {
    return <Badge className="ui-badge-soft">Не отмечено</Badge>;
  }

  const meta = homeworkStatusMeta[status];

  return (
    <Badge className={meta.subtleClassName}>
      <span aria-hidden="true">{homeworkStatusGlyph[status]}</span> {meta.shortLabel}
    </Badge>
  );
}
